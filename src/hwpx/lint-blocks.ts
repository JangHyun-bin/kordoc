/**
 * 블록 단위 검수 — 문단·표 칸을 id 가 붙은 블록으로 받아, 지적을 "블록 id + 블록 안 글자 위치"로 돌려준다.
 *
 * 열린 문서를 고치는 도구(한/글 실시간 편집 kordoc-auto, 내장 편집기 kordoc-ai)는 문서를 마크다운 줄로 펼쳤다가 줄·글자
 * 위치를 다시 문단·칸으로 되짚어야 했다. 그 펼치기·되짚기를 여기 한곳에 둔다:
 *  - 문단은 한 줄. 마크다운 구조(펜스·제목·표·인용)로 읽히는 줄은 앞에 \ 를 붙여 글자로 읽게 하고 위치를 그만큼 민다
 *  - 표는 GFM 표(앞뒤 빈 줄, 머리행 뒤 구분 줄). 칸 글의 | 는 같은 길이의 전각 막대로, 줄바꿈은 빈칸으로(길이 불변)
 *  - 칸이 하나뿐인 표(요약 상자·글 상자)는 데이터 표가 아니라 본문 — 표 줄로 쓰면 표 칸 예외(쉬운 말·쌍점)가 적용돼 놓친다
 * 위치는 모두 UTF-16 단위(자바스크립트 문자열 위치)다.
 */

import { runLintSuite, type LintSuiteOptions, type LintSuiteResult } from "./lint-suite.js"

export interface LintBlock {
  /** 호출 쪽이 정한 블록 id (문단·칸 위치를 되찾는 열쇠) */
  id: string
  /** 문단 글 또는 칸 글 */
  text: string
  /** 표 칸이면 표 id 와 0부터 센 행·열 — 같은 표 id 의 칸들이 한 표로 묶인다 */
  table?: { id: string; row: number; col: number }
}

export interface BlockFinding {
  /** 걸린 블록 id — 블록을 정할 수 없는 지적(문서 단위)은 null */
  block: string | null
  /** 블록 글 안 위치(0부터, UTF-16) — 블록 전체에 걸린 지적(문체 등)은 null */
  offset: number | null
  /** match 길이(UTF-16) */
  length: number
  category: "notation" | "munche" | "slop" | "logic" | "budget"
  rule: string
  severity: "error" | "warning"
  match: string
  message: string
  suggest?: string
}

export interface LintBlocksResult {
  findings: BlockFinding[]
  /** 표에서 찾지 못한 본문 수치(확인 목록) — numbers 를 켰을 때 */
  numbers?: LintSuiteResult["numbers"]
  summary: LintSuiteResult["summary"]
}

const MARKDOWN_STRUCTURE = /^\s*(?:```|~~~|#|\||>)/
const safeLine = (text: string) => text.replace(/[\r\n]/g, " ")
const safeCell = (text: string) => safeLine(text).replace(/\|/g, "｜")

interface Segment { start: number; length: number; block: string }
interface Line { text: string; segments: Segment[] }

/** 블록 → 검수 입력 줄과 위치 지도 */
export function blocksToLines(blocks: readonly LintBlock[]): Line[] {
  const lines: Line[] = []
  const paragraph = (block: LintBlock) => {
    const text = safeLine(block.text)
    const prefix = MARKDOWN_STRUCTURE.test(text) ? "\\" : ""
    lines.push({ text: prefix + text, segments: [{ start: prefix.length, length: text.length, block: block.id }] })
  }
  // 표 칸은 처음 나온 자리에 표 하나로 모은다(문서 순서 유지)
  const tables = new Map<string, LintBlock[]>()
  for (const b of blocks) if (b.table) (tables.get(b.table.id) ?? tables.set(b.table.id, []).get(b.table.id)!).push(b)
  const emitted = new Set<string>()
  for (const b of blocks) {
    if (!b.table) { paragraph(b); continue }
    if (emitted.has(b.table.id)) continue
    emitted.add(b.table.id)
    const cells = tables.get(b.table.id)!
    if (cells.length === 1) { paragraph(cells[0]); continue }
    const rows = cells.reduce((n, c) => Math.max(n, c.table!.row + 1), 0)
    const cols = cells.reduce((n, c) => Math.max(n, c.table!.col + 1), 0)
    const at = new Map(cells.map((c) => [`${c.table!.row},${c.table!.col}`, c]))
    lines.push({ text: "", segments: [] })
    for (let r = 0; r < rows; r++) {
      let text = "|"
      const segments: Segment[] = []
      for (let c = 0; c < cols; c++) {
        text += " "
        const cell = at.get(`${r},${c}`)
        if (cell) {
          const t = safeCell(cell.text)
          segments.push({ start: text.length, length: t.length, block: cell.id })
          text += t
        }
        text += " |"
      }
      lines.push({ text, segments })
      if (r === 0) lines.push({ text: "|" + " --- |".repeat(cols), segments: [] })
    }
    lines.push({ text: "", segments: [] })
  }
  return lines
}

type RawFinding = { line: number; column?: number; match: string; rule: string; severity: "error" | "warning"; message: string; suggest?: string }

/** 줄·글자 위치 → 블록·블록 안 위치. 글자 위치가 없으면 그 줄의 블록이 하나뿐일 때만 블록을 정하고, 지적 글이 그 블록에 한 번뿐이면 위치까지 */
function locate(lines: readonly Line[], f: RawFinding): { block: string | null; offset: number | null } {
  const line = lines[f.line - 1]
  if (!line) return { block: null, offset: null }
  if (f.column !== undefined) {
    const at = f.column - 1
    // 지적 조각이 빈칸으로 시작하면(trim 전 위치) 글이 시작하는 자리로
    const seg = line.segments.find((s) => at >= s.start && at < s.start + Math.max(1, s.length))
      ?? line.segments.find((s) => line.text.indexOf(f.match, s.start) >= s.start && line.text.indexOf(f.match, s.start) < s.start + s.length)
    if (seg) {
      const found = line.text.indexOf(f.match, Math.max(seg.start, at))
      const start = found >= seg.start && found < seg.start + seg.length ? found : at
      return { block: seg.block, offset: Math.min(Math.max(0, start - seg.start), seg.length) }
    }
    return { block: null, offset: null }
  }
  if (line.segments.length !== 1) return { block: null, offset: null }
  const seg = line.segments[0]
  const body = line.text.slice(seg.start, seg.start + seg.length)
  const first = f.match ? body.indexOf(f.match) : -1
  const unique = first >= 0 && body.indexOf(f.match, first + 1) < 0
  return { block: seg.block, offset: unique ? first : null }
}

/** 블록 단위 검수 — 검수 판정은 runLintSuite(CLI·MCP 와 같음), 위치만 블록으로 */
export function lintBlocks(blocks: readonly LintBlock[], opts: LintSuiteOptions = {}): LintBlocksResult {
  const lines = blocksToLines(blocks)
  const suite = runLintSuite(lines.map((l) => l.text).join("\n") + "\n", opts)
  const findings: BlockFinding[] = []
  const take = (category: BlockFinding["category"], list: RawFinding[] | undefined) => {
    for (const f of list ?? []) {
      const { block, offset } = locate(lines, f)
      findings.push({
        block, offset, length: f.match.length, category, rule: f.rule, severity: f.severity, match: f.match, message: f.message,
        ...(f.suggest ? { suggest: f.suggest } : {}),
      })
    }
  }
  take("notation", suite.findings)
  take("munche", suite.munche as RawFinding[] | undefined)
  take("slop", suite.slop)
  take("logic", suite.logic)
  take("budget", suite.budget)
  return { findings, ...(suite.numbers ? { numbers: suite.numbers } : {}), summary: suite.summary }
}
