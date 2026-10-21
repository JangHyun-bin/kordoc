/**
 * 부서 서식 견본 HWPX 로 새 문서 만들기 (generate --template).
 *
 * 견본 고쳐 쓰기(patch_document)는 같은 문서의 편집본을 원본과 줄 맞춤해 제자리 치환하므로, 표 열 수·표 개수가 다른
 * 새 내용에선 견본 표·띠·그림이 옛 글로 남는다(열/병합 변경·개체 문단 삭제 미지원). 여기는 줄 맞춤 없이 역할 원형만
 * 빌려 새로 짠다 — 부호 갈래(markerClass)·문단 범위·splice·기본 표는 패치와 같은 부품을 쓴다.
 *
 * 견본의 header.xml(글자·문단 모양·테두리, 순서·id 그대로)·쪽 설정(secPr)·설정·BinData 를 두고 section0 본문만 새로 짠다.
 * 본문은 template-scan 이 고른 역할별 원형 문단을 복제해 글만 바꾼 것이다 — 마크다운 아웃라인(outline.ts)의
 *   # 제목 → 제목표(담당 줄 칸은 ☎ 줄로 채우고 없으면 비운다) · > 요약 → 요약 상자 · ## 장 → 장 띠(참고N 이면 참고 띠,
 *   장 띠가 없는 견본이면 □ 문단으로 내리고 그 아래를 한 단계씩 내린다) · □ ○ - · → L0~L3 · ※ → ref · ▶【 → 같은 기호 원형
 *   · 표 → 견본 데이터 표(머리행·본문·끝행 × 첫 열·가운데·끝 열 칸 서식, 견본 표 폭 안에서 내용 비례 열 너비).
 * 원형이 없는 역할은 가까운 원형(단계는 이웃 단계 + 부호 바꿈)이나 견본 바탕글(paraPr·charPr 0)로 쓴다. 표 원형이 없으면
 * 실선 테두리 하나를 header 끝에 덧붙여(기존 id 불변) 기본 표를 만든다.
 * 복제한 표·그림·도형은 id·instid·zOrder 를 새로 매긴다 — 견본 id 를 그대로 두면 한글이 개체를 잘못 집는다.
 */

import JSZip from "jszip"
import { parseMarkdownToBlocks, buildPrvText, beginInlineDoc, endInlineDoc, extractFootnoteDefs, parseInlineMarkdown, type MdBlock } from "./md-runs.js"
import { buildOutline, type OutlineNode } from "./outline.js"
import { polishGongmunBlock } from "./gongmun-typo.js"
import { cleanPastedMarkdown } from "./paste-clean.js"
import { escapeXml } from "./gen-ids.js"
import { computeColWidths, colRoles, placeTotalRow, resolveTotalRow, type TotalRowPosition } from "./gen-table.js"
import { measureTextWidth } from "./text-metrics.js"
import { parseHtmlTable, htmlCellInnerToLines } from "../roundtrip/markdown-units.js"
import { injectCellBorderFill, buildTableParagraphXml } from "../roundtrip/table-insert.js"
import { applySplices } from "../roundtrip/source-map.js"
import { topLevelParagraphs } from "../roundtrip/structure-edit.js"
import { resolveSectionPaths } from "./zip-sections.js"
import { readZipEntry } from "./parser-shared.js"
import {
  scanTemplate, fillParagraph, tableInfo, hostTable, elementAt, resetBreaks, lineRole,
  BAND_LABEL_RE, CONTACT_RE, type TemplateScan, type CellInfo, type RoleKey,
} from "./template-scan.js"

export { scanTemplate, type TemplateScan, type RoleKey } from "./template-scan.js"

const GLYPH = ["□", "○", "-", "·"]
const DATE_RE = /^\(?\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?(?:\s*\([^)]*\))?\)?$/u
const ROMAN = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ", "Ⅺ", "Ⅻ"]
/** 참고 장 제목 — "참고1 제목" "참고 2. 제목" "별첨 제목" */
const BAND_TITLE_RE = /^[<＜\[［]?(참고|별첨|붙임)\s*(\d*)[>＞\]］]?[.:：)]?\s*(.*)$/u
const OBJ_TAG_RE = /<hp:(tbl|pic|rect|ellipse|arc|polygon|curve|line|connectLine|container|textart|ole|equation|chart|video)\b[^>]*>/g

/** 인라인 마크다운 → 평문 (견본 header 에 굵게·기울임 짝 글자 모양이 없어 서식은 버린다) */
function plainInline(text: string): string {
  return parseInlineMarkdown(text).map((s) => s.text).join("")
}

interface GCell { r: number; c: number; rs: number; cs: number; lines: string[] }
interface Grid { rowCnt: number; colCnt: number; cells: GCell[] }

function gridFromRows(rows: string[][]): Grid {
  const colCnt = Math.max(1, ...rows.map((r) => r.length))
  const cells: GCell[] = []
  rows.forEach((row, r) => {
    for (let c = 0; c < colCnt; c++) cells.push({ r, c, rs: 1, cs: 1, lines: (row[c] ?? "").split(/<br\s*\/?>/i).map((l) => plainInline(l.trim())) })
  })
  return { rowCnt: rows.length, colCnt, cells }
}

/** HTML 표(병합) → 격자. 점유 칸을 건너뛰며 놓고, 어느 칸에도 덮이지 않은 자리는 빈 칸으로 메운다 */
function gridFromHtml(html: string): Grid | null {
  const rows = parseHtmlTable(html)
  if (!rows || rows.length === 0) return null
  const taken = new Set<string>()
  const cells: GCell[] = []
  let colCnt = 0
  rows.forEach((row, r) => {
    let c = 0
    for (const cell of row.cells) {
      while (taken.has(`${r},${c}`)) c++
      const rs = Math.min(Math.max(1, cell.rowSpan), rows.length - r), cs = Math.max(1, cell.colSpan)
      const lines = htmlCellInnerToLines(cell.inner).lines.map(plainInline)
      cells.push({ r, c, rs, cs, lines: lines.length ? lines : [""] })
      for (let dr = 0; dr < rs; dr++) for (let dc = 0; dc < cs; dc++) taken.add(`${r + dr},${c + dc}`)
      c += cs
      colCnt = Math.max(colCnt, c)
    }
  })
  if (!colCnt) return null
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < colCnt; c++) {
    if (!taken.has(`${r},${c}`)) cells.push({ r, c, rs: 1, cs: 1, lines: [""] })
  }
  cells.sort((a, b) => a.r - b.r || a.c - b.c)
  return { rowCnt: rows.length, colCnt, cells }
}

/** 담당 줄 → 조각 — "|" 구분이 있으면 그것, 없으면 앞 날짜와 ☎번호 뒤 빈칸에서 나눈다 */
function splitContact(line: string): string[] {
  if (/[|｜]/.test(line)) return line.split(/\s*[|｜]\s*/).map((s) => s.trim()).filter(Boolean)
  const out: string[] = []
  let rest = line.trim()
  const d = /^\(?\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?(?:\s*\([^)]*\))?\)?[,，]?/u.exec(rest)
  if (d) { out.push(d[0].replace(/[,，]$/, "")); rest = rest.slice(d[0].length).trim() }
  out.push(...rest.split(/(?<=☎\s*[\d-]+)[\s,，]+/u).map((s) => s.trim()).filter(Boolean))
  return out
}

/** 칸 문단을 줄마다 첫 문단 원형으로 다시 짠 표 XML 조각 (편집은 표 문자열 좌표) */
function fillCells(xml: string, edits: Array<{ cell: CellInfo; lines: string[] }>): string {
  return applySplices(xml, edits.filter((e) => e.cell.paras.length).map(({ cell, lines }) => {
    const first = xml.slice(cell.paras[0].start, cell.paras[0].end)
    return {
      start: cell.paras[0].start, end: cell.paras[cell.paras.length - 1].end,
      replacement: (lines.length ? lines : [""]).map((l) => fillParagraph(first, l)).join(""),
    }
  }))
}

interface EmitCtx {
  scan: TemplateScan
  warnings: string[]
  /** 표 원형이 없어 header 에 덧붙일 실선 테두리 id (필요할 때 한 번 정한다) */
  fallbackBf: { id: number; used: boolean }
  /** 원형이 없어 가까운 서식으로 대신한 역할 — 경고 한 줄로 모은다 */
  missing: Set<string>
  /** 표 합계 행 위치 — 견본 표 행 서식을 그대로 쓰므로 미지정이면 keep (서식 프로필과 같은 판단) */
  totalRow: TotalRowPosition
}

/** 견본 바탕글 문단 — 본문 원형이 없을 때 */
function defaultPara(text: string): string {
  return `<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0">${text ? `<hp:t>${escapeXml(text).replace(/\n/g, "<hp:lineBreak/>")}</hp:t>` : ""}</hp:run></hp:p>`
}

function bodyPara(ctx: EmitCtx, text: string): string {
  const body = ctx.scan.protos.get("body")
  return body ? fillParagraph(body, text) : defaultPara(text)
}

function levelPara(ctx: EmitCtx, depth: number, text: string, glyph?: string): string {
  const d = Math.max(0, Math.min(depth, 3))
  for (const k of [d, d - 1, d + 1, d - 2, d + 2, d - 3, d + 3]) {
    const proto = k >= 0 && k <= 3 ? ctx.scan.protos.get(`L${k}` as RoleKey) : undefined
    if (!proto) continue
    if (k !== d) ctx.missing.add(`${GLYPH[d]} 항목`)
    return fillParagraph(proto, text, { marker: true, glyph: glyph ?? (k === d ? undefined : GLYPH[d]) })
  }
  ctx.missing.add(`${GLYPH[d]} 항목`)
  return bodyPara(ctx, `${glyph ?? GLYPH[d]} ${text}`)
}

/** 기호로 시작하는 문단(▶ 【 ⇒ …) — 같은 기호 원형이 있으면 그 서식 */
function symbolPara(ctx: EmitCtx, text: string): string | null {
  const role = lineRole(text)
  if (!role?.startsWith("sym:")) return null
  const proto = ctx.scan.protos.get(role)
  if (!proto) return null
  const ch = role.slice(4)
  return fillParagraph(proto, text.replace(/^\s+/, "").slice(ch.length).trim(), { marker: true })
}

/** 장·참고 띠 — 첫 칸 번호, 가장 넓은 칸 제목, 나머지 칸 비움 */
function bandXml(proto: string, label: string, title: string): string {
  const el = hostTable(proto)!
  const info = tableInfo(proto, el, new Map())
  const first = info.cells.find((c) => c.row === 0 && c.col === 0)!
  const titleCell = info.cells.filter((c) => c !== first).sort((a, b) => b.width - a.width)[0]
  // 견본 번호 칸 꼴 따르기 — "Ⅰ." 처럼 마침표, "[Ⅰ]" 처럼 괄호
  const m = /^(\s*[\[［<＜]?)(?:[^\s\]］>＞.)]+)([.)]?[\]］>＞]?\s*)$/u.exec(first.text)
  const lab = m ? `${m[1]}${label}${m[2]}` : label
  const lead = /^\s*/.exec(titleCell?.text ?? "")?.[0] ?? ""
  return fillCells(proto, info.cells.map((c) => ({ cell: c, lines: [c === first ? lab : c === titleCell ? lead + title : ""] })))
}

function chapterPara(ctx: EmitCtx, node: Extract<OutlineNode, { kind: "chapter" }>): { xml: string; shift: boolean } {
  const text = plainInline(node.text)
  const band = BAND_TITLE_RE.exec(text)
  const { protos } = ctx.scan
  if (band) {
    const label = `${band[1]}${band[2]}`
    const proto = protos.get("band") ?? protos.get("chapter")
    if (proto) return { xml: bandXml(proto, label, band[3]), shift: false }
    return { xml: levelPara(ctx, 0, text), shift: false }
  }
  const chap = protos.get("chapter")
  if (chap) return { xml: resetBreaks(bandXml(chap, node.label ?? ROMAN[(node.index - 1) % ROMAN.length], text)), shift: false }
  return { xml: levelPara(ctx, 0, text), shift: true }
}

/** 견본 데이터 표 원형으로 표 짜기 */
function tableXml(ctx: EmitCtx, grid: Grid): string {
  const proto = ctx.scan.protos.get("table")
  if (!proto) { ctx.missing.add("데이터 표"); return fallbackTable(ctx, grid) }
  const el = hostTable(proto)!
  const info = tableInfo(proto, el, ctx.scan.heights)
  const rowKind = (r: number, rs: number) => (r === 0 ? "header" : r + rs === grid.rowCnt && grid.rowCnt > 2 ? "last" : "body")
  const colKind = (c: number, cs: number) => (c === 0 ? "first" : c + cs === grid.colCnt ? "last" : "middle")
  const pick = (rk: string, ck: string): CellInfo => {
    const n = info.rowCnt
    const rows = rk === "header" ? [...Array(n).keys()]
      : rk === "last" ? [...Array(n).keys()].reverse()
      : [...Array(n).keys()].slice(1).concat(0)
    const fits: Record<string, (c: CellInfo) => boolean> = {
      first: (c) => c.col === 0,
      last: (c) => c.col + c.colSpan === info.colCnt && c.col > 0,
      middle: (c) => c.col > 0 && c.col + c.colSpan < info.colCnt,
    }
    const order = ck === "middle" ? ["middle", "last", "first"] : ck === "last" ? ["last", "middle", "first"] : ["first", "middle", "last"]
    for (const k of order) for (const r of rows) {
      const hit = info.cells.find((c) => c.row === r && fits[k](c))
      if (hit) return hit
    }
    return info.cells[0]
  }
  const bodyCell = pick("body", "middle")
  const charH = ctx.scan.heights.get(/\bcharPrIDRef="(\d+)"/.exec(proto.slice(bodyCell.el.start, bodyCell.el.end))?.[1] ?? "") ?? 1000
  // 열 너비 — 견본 표 폭 안에서 gen-table 과 같은 내용 비례 배분
  const colMax = Array<number>(grid.colCnt).fill(0)
  const colMinWord = Array<number>(grid.colCnt).fill(0)
  for (const g of grid.cells) {
    const w = Math.max(0, ...g.lines.map((l) => measureTextWidth(l, charH, 100))) / g.cs
    for (let c = g.c; c < g.c + g.cs; c++) colMax[c] = Math.max(colMax[c], w)
    if (g.cs === 1) colMinWord[g.c] = Math.max(colMinWord[g.c], ...g.lines.flatMap((l) => l.split(/[ \t]+/)).map((wd) => measureTextWidth(wd, charH, 100)))
  }
  const headers = Array.from({ length: grid.colCnt }, (_, c) => grid.cells.find((g) => g.r === 0 && g.c === c)?.lines.join("") ?? "")
  const widths = computeColWidths(colMax, info.width || 42000, colMinWord, colRoles(headers, false))
  const rowH = Array.from({ length: grid.rowCnt }, (_, r) => pick(rowKind(r, 1), "first").height || 1500)

  const trs = Array.from({ length: grid.rowCnt }, (_, r) => grid.cells.filter((g) => g.r === r).map((g) => {
    const pc = pick(rowKind(g.r, g.rs), colKind(g.c, g.cs))
    const tcXml = proto.slice(pc.el.start, pc.el.end)
    let tc = applySplices(tcXml, pc.paras.length ? [{
      start: pc.paras[0].start - pc.el.start, end: pc.paras[pc.paras.length - 1].end - pc.el.start,
      replacement: g.lines.map((l) => fillParagraph(proto.slice(pc.paras[0].start, pc.paras[0].end), l)).join(""),
    }] : [])
    const w = widths.slice(g.c, g.c + g.cs).reduce((a, b) => a + b, 0)
    const h = rowH.slice(g.r, g.r + g.rs).reduce((a, b) => a + b, 0)
    tc = tc.replace(/<hp:cellAddr\b[^>]*\/>/, `<hp:cellAddr colAddr="${g.c}" rowAddr="${g.r}"/>`)
      .replace(/<hp:cellSpan\b[^>]*\/>/, `<hp:cellSpan colSpan="${g.cs}" rowSpan="${g.rs}"/>`)
      .replace(/<hp:cellSz\b[^>]*\/>/, `<hp:cellSz width="${w}" height="${h}"/>`)
    return tc
  }).join(""))
  const tblXml = proto.slice(info.el.start, info.el.end)
  const firstTr = info.trs[0].start - info.el.start, lastTr = info.trs[info.trs.length - 1].end - info.el.start
  const tblW = widths.reduce((a, b) => a + b, 0), tblH = rowH.reduce((a, b) => a + b, 0)
  const headPart = tblXml.slice(0, firstTr)
    .replace(/\browCnt="\d+"/, `rowCnt="${grid.rowCnt}"`).replace(/\bcolCnt="\d+"/, `colCnt="${grid.colCnt}"`)
    .replace(/(<hp:sz\b[^>]*?)\bwidth="\d+"/, `$1width="${tblW}"`).replace(/(<hp:sz\b[^>]*?)\bheight="\d+"/, `$1height="${tblH}"`)
  const tbl = headPart + trs.map((t) => `<hp:tr>${t}</hp:tr>`).join("") + tblXml.slice(lastTr)
  return resetBreaks(proto.slice(0, info.el.start) + tbl + proto.slice(info.el.end))
}

/** 견본에 표 원형이 없을 때 — 실선 테두리 기본 표 (header 에 borderFill 하나 덧붙임) */
function fallbackTable(ctx: EmitCtx, grid: Grid): string {
  ctx.fallbackBf.used = true
  const rows = Array.from({ length: grid.rowCnt }, (_, r) => Array.from({ length: grid.colCnt }, (_, c) =>
    grid.cells.find((g) => g.r === r && g.c === c)?.lines.join(" ") ?? ""))
  return buildTableParagraphXml(rows, { borderFillId: ctx.fallbackBf.id, outerParaPrId: 0, cellParaPrId: 0, cellCharPrId: 0, tableId: 0 })
}

/** 제목표 — 제목 칸(가장 큰 글자)에 제목, 담당 줄 칸에 ☎ 조각(없으면 비움) */
function titleXml(ctx: EmitCtx, title: string, contact: string | null): string {
  const proto = ctx.scan.protos.get("title")!
  const el = hostTable(proto)
  if (!el) return fillParagraph(proto, title)
  const info = tableInfo(proto, el, ctx.scan.heights)
  const contactCells = info.cells.filter((c) => CONTACT_RE.test(c.text))
  const titleCell = info.cells.filter((c) => !contactCells.includes(c) && c.text).sort((a, b) => b.maxH - a.maxH)[0] ?? info.cells[0]
  // 담당 줄 행의 나머지 칸도 담당 줄 칸 (날짜만 든 칸 등)
  const contactRows = new Set(contactCells.map((c) => c.row))
  const slots = info.cells.filter((c) => c !== titleCell && contactRows.has(c.row)).sort((a, b) => a.row - b.row || a.col - b.col)
  const edits = [{ cell: titleCell, lines: [title] }, ...assignContacts(slots, contact)]
  return resetBreaks(fillCells(proto, edits))
}

/** 담당 줄 조각을 칸에 — 날짜 조각은 날짜 칸, '담당' 조각은 담당 칸, 나머지는 차례로. 남는 칸은 비운다 */
function assignContacts(slots: CellInfo[], contact: string | null): Array<{ cell: CellInfo; lines: string[] }> {
  const out = new Map<CellInfo, string>(slots.map((c) => [c, ""]))
  if (contact && slots.length) {
    const pieces = slots.length === 1 ? [splitContact(contact).join("  ")] : splitContact(contact)
    const free = [...slots]
    const take = (pred: (c: CellInfo) => boolean) => { const i = free.findIndex(pred); return i >= 0 ? free.splice(i, 1)[0] : undefined }
    let last: CellInfo | undefined
    for (const piece of pieces) {
      const cell = (DATE_RE.test(piece) ? take((c) => /\d{4}\.\s*\d{1,2}\./.test(c.text)) : /^담당/.test(piece) ? take((c) => /^\s*담당/.test(c.text)) : undefined)
        ?? take((c) => !/\d{4}\.\s*\d{1,2}\./.test(c.text) || DATE_RE.test(piece)) ?? take(() => true)
      if (cell) { out.set(cell, piece); last = cell } else if (last) out.set(last, `${out.get(last)}  ${piece}`)
    }
  }
  return [...out].map(([cell, text]) => ({ cell, lines: [text] }))
}

function contactXml(ctx: EmitCtx, contact: string): string {
  const proto = ctx.scan.protos.get("contact")
  if (!proto) return bodyPara(ctx, contact)
  const el = hostTable(proto)
  if (!el) return fillParagraph(proto, contact)
  const info = tableInfo(proto, el, ctx.scan.heights)
  return resetBreaks(fillCells(proto, assignContacts(info.cells.filter((c) => c.text || info.cells.length === 1), contact)))
}

function summaryXml(ctx: EmitCtx, text: string): string {
  const proto = ctx.scan.protos.get("summary")
  const lines = text.split("\n").map((l) => plainInline(l.trim())).filter(Boolean)
  if (!proto) ctx.missing.add("요약 상자")
  if (!proto) return ctx.scan.protos.get("ref") ? fillParagraph(ctx.scan.protos.get("ref")!, lines.join(" "), { marker: true }) : bodyPara(ctx, lines.join(" "))
  const info = tableInfo(proto, hostTable(proto)!, ctx.scan.heights)
  return resetBreaks(fillCells(proto, [{ cell: info.cells[0], lines }]))
}

/** 마크다운 블록 → 견본 원형 문단들 */
function emitBody(ctx: EmitCtx, blocks: MdBlock[], head: { title: string | null; contact: string | null; sub: string | null }): string[] {
  const outline = buildOutline(blocks, { gaejosik: true, consumeTitle: true, summaryFromQuote: true, listUnderMarker: true, keepMarkers: true })
  const out: string[] = []
  const { protos } = ctx.scan
  const title = outline.title ?? head.title
  if (title && !protos.get("title")) ctx.missing.add("제목표")
  if (title) out.push(protos.get("title") ? titleXml(ctx, plainInline(title), ctx.scan.contactInTitle ? head.contact : null) : levelPara(ctx, 0, plainInline(title)))
  if (head.sub) out.push(bodyPara(ctx, plainInline(head.sub)))
  if (head.contact && !(title && protos.get("title") && ctx.scan.contactInTitle)) out.push(contactXml(ctx, plainInline(head.contact)))
  // 장 띠가 없는 견본에서 ## 장을 □ 로 내렸으면 그 아래 항목을 한 단계 내린다 (명시 □ 부호를 쓴 원고는 그대로)
  let shift = 0
  for (const node of outline.nodes) {
    switch (node.kind) {
      case "title": break
      case "summary": out.push(summaryXml(ctx, node.text)); break
      case "chapter": {
        const r = chapterPara(ctx, node)
        out.push(r.xml)
        shift = r.shift && !outline.hasBoxMarkers ? 1 : 0
        break
      }
      case "item": {
        const text = plainInline(node.text)
        const depth = node.depth + shift
        if (node.legalMarker) { out.push(levelPara(ctx, depth + 1, text, node.legalMarker)); break }
        if (node.marker && node.marker !== "▸") {
          out.push(symbolPara(ctx, `${node.marker} ${text}`) ?? levelPara(ctx, depth, text, node.marker))
          break
        }
        out.push(levelPara(ctx, node.marker === "▸" ? 3 : depth, text))
        break
      }
      case "ref": {
        const text = plainInline(node.text)
        const ref = protos.get("ref")
        out.push(ref ? fillParagraph(ref, text, { marker: true }) : bodyPara(ctx, `※ ${text}`))
        break
      }
      case "heading": out.push(levelPara(ctx, node.level - 3 + shift, plainInline(node.text))); break
      case "para": {
        const text = plainInline(node.text)
        out.push(symbolPara(ctx, text) ?? bodyPara(ctx, text))
        break
      }
      case "attach": out.push(bodyPara(ctx, plainInline(node.text))); break
      case "block": {
        const b = node.block
        if (b.type === "table" && b.rows?.length) {
          const g = gridFromRows(placeTotalRow(b.rows, ctx.totalRow))
          const first = g.cells[0]?.lines.join("").replace(/\s+/g, "") ?? ""
          if (g.rowCnt === 1 && g.colCnt >= 2 && g.colCnt <= 4 && BAND_LABEL_RE.test(first) && (protos.get("band") ?? protos.get("chapter"))) {
            const rest = g.cells.slice(1).map((c) => c.lines.join(" ")).join(" ").trim()
            out.push(bandXml((protos.get("band") ?? protos.get("chapter"))!, first.replace(/[<＜>＞\[［\]］]/g, ""), rest))
          } else out.push(tableXml(ctx, g))
        } else if (b.type === "html_table") {
          const g = gridFromHtml(b.text ?? "")
          if (g) out.push(tableXml(ctx, g))
        } else if (b.type === "code_block") {
          if ((b.lang ?? "").toLowerCase() === "chart") { ctx.warnings.push("template: 차트(```chart)는 견본 모드에서 그리지 않습니다 — 건너뜀"); break }
          for (const line of (b.text ?? "").split("\n")) out.push(bodyPara(ctx, line))
        } else if (b.type === "equation") {
          ctx.warnings.push("template: 수식은 견본 모드에서 글자 그대로 둡니다")
          out.push(bodyPara(ctx, b.text ?? ""))
        }
        break
      }
    }
  }
  return out
}

/** 제목 바로 뒤 담당 줄(☎)·작성일·부제(- … -)를 빼 둔다 — 아웃라인 전에 빼야 뒤 인용문이 요약 상자가 된다 */
function takeHeadLines(blocks: MdBlock[]): { blocks: MdBlock[]; contact: string | null; sub: string | null } {
  const h1 = blocks.findIndex((b) => b.type === "heading" && (b.level ?? 1) === 1)
  let contact: string | null = null, date: string | null = null, sub: string | null = null
  const drop = new Set<number>()
  // 제목(#)이 없는 원고는 첫 줄이 날짜·☎ 로 시작해도 본문이다 — 담당 줄로 빼지 않는다
  if (h1 < 0) return { blocks, contact, sub }
  for (let k = h1 + 1; k < blocks.length && k <= h1 + 4; k++) {
    const b = blocks[k]
    if (b.type !== "paragraph" && b.type !== "list_item" && b.type !== "blockquote") break
    if (b.type === "blockquote") continue
    // "2026. 10. 21.(수) …" 는 마크다운에서 번호 목록("2026.")으로 읽힌다 — 부호를 되붙여 원문 줄로
    const t = (b.type === "list_item" ? `${b.marker ?? "-"} ${b.text ?? ""}` : b.text ?? "").trim()
    if (!sub && /^-\s*\S.*\s-$/.test(t) && t.length < 60) sub = t
    else if (!contact && CONTACT_RE.test(t) && !DATE_RE.test(t)) contact = t
    else if (!date && DATE_RE.test(t)) date = t
    else break
    drop.add(k)
  }
  // 따로 쓴 작성일은 담당 줄 앞 조각으로 — "|" 구분 원고면 같은 구분으로 잇는다
  if (date) contact = !contact ? date : /[|｜]/.test(contact) ? `${date} | ${contact}` : `${date} ${contact}`
  return { blocks: blocks.filter((_, i) => !drop.has(i)), contact, sub }
}

/**
 * 마크다운 + 견본 HWPX → HWPX. markdownToHwpx({ template }) 의 구현.
 */
export async function markdownToHwpxFromTemplate(markdown: string, template: Uint8Array | ArrayBuffer, warnings: string[] = [], totalRow?: TotalRowPosition): Promise<ArrayBuffer> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(template)
  } catch {
    throw new Error("견본이 HWPX(zip)가 아닙니다 — 한글에서 .hwpx 로 저장한 파일을 쓰세요 (.hwp 는 kordoc 으로 먼저 변환)")
  }
  const sections = await resolveSectionPaths(zip)
  const headerFile = zip.file("Contents/header.xml")
  if (!sections.length || !zip.file(sections[0]) || !headerFile) throw new Error("견본 HWPX 에 Contents/header.xml 또는 section0.xml 이 없습니다")
  let used = 0
  const read = async (name: string) => { const s = await readZipEntry(zip.file(name)!, "text", used); used += s.length; return s }
  const sectionXml = await read(sections[0])
  let headerXml = await read("Contents/header.xml")
  const scan = scanTemplate(sectionXml, headerXml)

  const pasted = cleanPastedMarkdown(markdown)
  if (pasted.removed > 0) warnings.push(`붙여넣기 흔적 ${pasted.removed}개 정리 (보이지 않는 글자·인용 표시·이스케이프된 굵게)`)
  const { md, defs } = extractFootnoteDefs(pasted.md)
  if (defs.size) warnings.push(`template: 각주 ${defs.size}개는 견본 모드에서 넣지 않습니다`)
  const parsed = parseMarkdownToBlocks(md).map(polishGongmunBlock)
  const imageOnly = parsed.filter((b) => b.type === "paragraph" && /^!\[[^\]]*\]\([^)]*\)$/.test((b.text ?? "").trim()))
  if (imageOnly.length) warnings.push(`template: 그림 ${imageOnly.length}개는 견본 모드에서 넣지 않습니다`)
  const { blocks, contact, sub } = takeHeadLines(parsed.filter((b) => !imageOnly.includes(b)))

  const maxBf = Math.max(0, ...[...headerXml.matchAll(/<hh:borderFill\b[^>]*\bid="(\d+)"/g)].map((m) => Number(m[1])))
  const ctx: EmitCtx = { scan, warnings, fallbackBf: { id: maxBf + 1, used: false }, missing: new Set(), totalRow: resolveTotalRow(totalRow, true) }
  beginInlineDoc(new Map())
  let paras: string[]
  try {
    paras = emitBody(ctx, blocks, { title: null, contact, sub })
  } finally {
    endInlineDoc()
  }
  if (!paras.length) paras.push(defaultPara(""))
  if (ctx.missing.size) warnings.push(`template: 견본에 ${[...ctx.missing].join("·")} 서식이 없어 가까운 서식으로 대신했습니다`)

  // 구역 정의·쪽 컨트롤은 첫 문단 첫 run 에 한 번만
  const first = elementAt(paras[0], 0)!
  paras[0] = paras[0].slice(0, first.openEnd) + `<hp:run charPrIDRef="${scan.headCharPr}">${scan.head}</hp:run>` + paras[0].slice(first.openEnd)

  // 개체 id·instid·zOrder 새로 매기기 — 머리말·꼬리말 개체와도 겹치지 않게 견본 최댓값 다음부터
  let nextId = 1 + Math.max(0, ...[...sectionXml.matchAll(OBJ_TAG_RE)].flatMap((m) => [/\bid="(\d+)"/.exec(m[0])?.[1], /\binstid="(\d+)"/.exec(m[0])?.[1]]).map((v) => Number(v ?? 0)))
  let z = 1 + Math.max(-1, ...[...scan.head.matchAll(OBJ_TAG_RE)].map((m) => Number(/\bzOrder="(-?\d+)"/.exec(m[0])?.[1] ?? -1)))
  const body = paras.join("").replace(OBJ_TAG_RE, (tag) => tag
    .replace(/\bid="\d*"/, () => `id="${nextId++}"`)
    .replace(/\binstid="\d*"/, () => `instid="${nextId++}"`)
    .replace(/\bzOrder="-?\d+"/, () => `zOrder="${z++}"`))
  const tops = topLevelParagraphs(sectionXml)
  const newSection = sectionXml.slice(0, tops[0]?.start ?? sectionXml.lastIndexOf("</")) + body + sectionXml.slice(tops.at(-1)?.end ?? sectionXml.lastIndexOf("</"))

  if (ctx.fallbackBf.used) {
    const inj = injectCellBorderFill(headerXml, ctx.fallbackBf.id)
    if (inj) headerXml = applySplices(headerXml, inj.headerSplices)
  }
  if (sections.length > 1) {
    warnings.push(`template: 견본의 구역 ${sections.length}개 중 첫 구역 서식만 씁니다`)
    headerXml = headerXml.replace(/(<(?:\w+:)?head\b[^>]*?\bsecCnt=")\d+"/, (_, open: string) => `${open}1"`)
  }
  const title = blocks.find((b) => b.type === "heading" && (b.level ?? 1) === 1)?.text ?? null
  return packZip(zip, { sections, newSection, headerXml, title: title && plainInline(title), prvText: buildPrvText(blocks) })
}

/** 견본 zip 을 바탕으로 새 zip — mimetype 무압축 첫 엔트리, 바꾼 파일만 갈아 끼우고 안 쓰는 구역·그림·미리보기 그림은 뺀다 */
async function packZip(zip: JSZip, p: { sections: string[]; newSection: string; headerXml: string; title: string | null; prvText: string }): Promise<ArrayBuffer> {
  const hpfName = zip.file("Contents/content.hpf") ? "Contents/content.hpf" : Object.keys(zip.files).find((n) => /content\.hpf$/i.test(n))
  let hpf = hpfName ? await readZipEntry(zip.file(hpfName)!, "text") : ""
  const drop = new Set<string>([...p.sections.slice(1), "Preview/PrvImage.png"])
  const sameFile = (href: string, name: string) => href === name || `Contents/${href}` === name
  // 안 쓰는 BinData — 새 section·header·남는 XML 어디에서도 binaryItemIDRef 로 안 부르는 항목
  const refs = new Set<string>()
  const scanRefs = (xml: string) => { for (const m of xml.matchAll(/\bbinaryItemIDRef="([^"]+)"/g)) refs.add(m[1]) }
  scanRefs(p.newSection); scanRefs(p.headerXml)
  for (const name of Object.keys(zip.files)) {
    if (/^Contents\/masterpage\d*\.xml$/i.test(name)) scanRefs(await readZipEntry(zip.file(name)!, "text"))
  }
  for (const m of hpf.matchAll(/<opf:item\b[^>]*>/g)) {
    const id = /\bid="([^"]*)"/.exec(m[0])?.[1] ?? "", href = /\bhref="([^"]*)"/.exec(m[0])?.[1] ?? ""
    const name = Object.keys(zip.files).find((n) => sameFile(href, n)) ?? href
    if (/^BinData\//i.test(name) && !refs.has(id)) drop.add(name)
  }
  if (hpf) {
    // 뺀 파일의 manifest 항목과 spine 참조를 함께 지운다 (id 를 먼저 모으고 itemref 는 따로)
    const droppedIds = new Set<string>()
    hpf = hpf.replace(/<opf:item\b[^>]*>/g, (tag) => {
      const href = /\bhref="([^"]*)"/.exec(tag)?.[1] ?? ""
      if (![...drop].some((n) => sameFile(href, n))) return tag
      const id = /\bid="([^"]*)"/.exec(tag)?.[1]
      if (id) droppedIds.add(id)
      return ""
    })
    hpf = hpf.replace(/<opf:itemref\b[^>]*\bidref="([^"]*)"[^>]*\/>/g, (tag, id: string) => (droppedIds.has(id) ? "" : tag))
    if (p.title) hpf = hpf.replace(/<opf:title>[\s\S]*?<\/opf:title>|<opf:title\/>/, `<opf:title>${escapeXml(p.title)}</opf:title>`)
  }
  const replaced = new Map<string, string>([
    [p.sections[0], p.newSection], ["Contents/header.xml", p.headerXml], ["Preview/PrvText.txt", p.prvText],
  ])
  if (hpfName) replaced.set(hpfName, hpf)
  const out = new JSZip()
  out.file("mimetype", "application/hwp+zip", { compression: "STORE" })
  let used = 0
  for (const name of Object.keys(zip.files)) {
    const f = zip.files[name]
    if (f.dir || name === "mimetype" || drop.has(name)) continue
    if (replaced.has(name)) { out.file(name, replaced.get(name)!, { compression: "DEFLATE" }); replaced.delete(name); continue }
    let data: string | Uint8Array = await readZipEntry(f, "uint8array", used)
    used += data.length
    // 커서 자리는 견본 문단을 가리킨다 — 문서 첫머리로
    if (name === "settings.xml") data = new TextDecoder().decode(data).replace(/<ha:CaretPosition\b[^>]*\/>/, `<ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/>`)
    out.file(name, data, { compression: "DEFLATE" })
  }
  for (const [name, data] of replaced) out.file(name, data, { compression: "DEFLATE" })
  return out.generateAsync({ type: "arraybuffer" })
}
