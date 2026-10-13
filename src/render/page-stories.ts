/** Page decorations are separate stories: their line positions never split body pages. */
import { findChildByLocalName } from "../hwpx/parser-shared.js"
import { elements, findFirst, isDeletedControl, ln, num } from "./para-model.js"

export interface PageStory { sub: Element; page: number; x: number; y: number; width: number; layer?: -2 | 2 }
export function pageStories(root: Element, masters: Element[], paraPages: Map<Element, number[]>, pageCount: number, pageBase: number,
  geom: { ML: number; MT: number; PH: number; BODY_W: number }): PageStory[] {
  const secPr = findFirst(root, "secPr"), visibility = secPr && findChildByLocalName(secPr, "visibility")
  const pagePr = secPr && findChildByLocalName(secPr, "pagePr"), margin = pagePr && findChildByLocalName(pagePr, "margin")
  const declarations: Array<{ el: Element; page: number; kind: string }> = []
  const hidden = new Map<number, Set<string>>()
  for (const p of elements(root)) if (ln(p) === "p") {
    const page = paraPages.get(p)?.[0] ?? 0
    for (const run of elements(p)) if (ln(run) === "run") for (const ctrl of elements(run)) if (ln(ctrl) === "ctrl") {
      for (const el of elements(ctrl)) {
        if (isDeletedControl(el)) continue
        const kind = ln(el)
        if (kind === "header" || kind === "footer") declarations.push({ el, page, kind })
        else if (kind === "pageHiding") {
          const kinds = hidden.get(page) ?? new Set<string>()
          for (const name of ["Header", "Footer", "MasterPage"]) if (num(el, `hide${name}`)) kinds.add(name)
          hidden.set(page, kinds)
        }
      }
    }
  }
  const parity = (type: string, n: number): boolean => type === "BOTH" || (type === "ODD" && n % 2 === 1) || (type === "EVEN" && n % 2 === 0)
  const out: PageStory[] = []
  for (let page = 0; page < pageCount; page++) {
    const n = pageBase + page + 1
    const hides = (name: string): boolean => hidden.get(page)?.has(name) === true || (page === 0 && num(visibility, `hideFirst${name}`) !== 0)
    if (!hides("MasterPage")) {
      // ODD/EVEN replace BOTH on their pages; they are not an overlay.
      const matching = masters.filter(m => m.getAttribute("type") === (n % 2 ? "ODD" : "EVEN"))
      const both = masters.filter(m => (m.getAttribute("type") || "BOTH") === "BOTH")
      const normal = (matching.length ? matching : both).slice(-1)
      const specific = masters.filter(m => m.getAttribute("type") === "LAST_PAGE" ? page === pageCount - 1 : m.getAttribute("type") === "OPTIONAL_PAGE" && num(m, "pageNumber") === page + 1)
      const special = specific.slice(-1)
      const selected = special.length && !num(special[0], "pageDuplicate") ? special : [...normal, ...special]
      for (const master of selected) {
        const sub = findChildByLocalName(master, "subList")
        if (sub) out.push({ sub, page, x: geom.ML, y: geom.MT, width: geom.BODY_W, layer: num(master, "pageFront") ? 2 : -2 })
      }
    }
    for (const kind of ["header", "footer"]) {
      if (hides(kind === "header" ? "Header" : "Footer")) continue
      const eligible = declarations.filter(d => d.kind === kind && d.page <= page && parity(d.el.getAttribute("applyPageType") || "BOTH", n))
      const decl = eligible[eligible.length - 1]
      const sub = decl && findChildByLocalName(decl.el, "subList")
      if (sub) out.push({ sub, page, x: geom.ML, y: kind === "header" ? num(margin, "top", 5668) : geom.PH - num(margin, "bottom", 4252) - num(margin, "footer"), width: geom.BODY_W })
    }
  }
  return out
}

/** 각주 구분선 — 쪽 아래 각주 영역 맨 위 */
export interface NoteRule { page: number; x: number; y: number; length: number; widthMm: number; color: string }

/**
 * 쪽 아래 각주 — 쪽마다 그 쪽에 놓인 문단의 각주를 모아 본문 바닥에서 각주 영역만큼 위에 놓는다(reflow 의 쪽 바닥 계산과 같은 모양):
 * 영역 = 구분선 위 간격(aboveLine) + 구분선 아래 간격(belowLine) + 각주 높이 합 + 각주 사이 간격(betweenNotes) × (개수 − 1).
 * 구분선은 왼쪽 여백에서 길이만큼(length −1 = 기본 5cm, 한컴 PDF 실측 14173). 각주 높이는 하위 목록 lineseg 바닥
 */
export function footNoteStories(root: Element, paraPages: Map<Element, number[]>, geom: { ML: number; MT: number; BODY_W: number; BODY_H: number }): { stories: PageStory[]; rules: NoteRule[] } {
  const pr = findFirst(root, "footNotePr")
  const sp = pr ? findChildByLocalName(pr, "noteSpacing") : null, line = pr ? findChildByLocalName(pr, "noteLine") : null
  const above = num(sp, "aboveLine", 850), below = num(sp, "belowLine", 567), between = num(sp, "betweenNotes", 283)
  const byPage = new Map<number, Array<{ sub: Element; h: number }>>()
  for (const p of elements(root)) if (ln(p) === "p") {
    const page = paraPages.get(p)?.[0] ?? 0
    for (const run of elements(p)) if (ln(run) === "run") for (const ctrl of elements(run)) if (ln(ctrl) === "ctrl") {
      const fn = findChildByLocalName(ctrl, "footNote")
      const sub = fn && !isDeletedControl(fn) ? findChildByLocalName(fn, "subList") : null
      if (!sub) continue
      let h = 0
      for (const q of elements(sub)) if (ln(q) === "p") {
        const lsa = findChildByLocalName(q, "linesegarray")
        for (const seg of lsa ? elements(lsa) : []) if (ln(seg) === "lineseg") h = Math.max(h, num(seg, "vertpos") + num(seg, "vertsize"))
      }
      const list = byPage.get(page) ?? []
      list.push({ sub, h })
      byPage.set(page, list)
    }
  }
  const stories: PageStory[] = [], rules: NoteRule[] = []
  const lenAttr = num(line, "length", -1), widthMm = Number.parseFloat(line?.getAttribute("width") ?? "0.12") || 0.12
  const lineType = line?.getAttribute("type") ?? "SOLID"
  for (const [page, notes] of byPage) {
    const area = above + below + notes.reduce((a, n) => a + n.h, 0) + between * (notes.length - 1)
    const top = geom.MT + geom.BODY_H - area
    if (lineType !== "NONE") rules.push({ page, x: geom.ML, y: top + above, length: lenAttr > 0 ? lenAttr : 14173, widthMm, color: line?.getAttribute("color") ?? "#000000" })
    let y = top + above + below
    for (const n of notes) { stories.push({ sub: n.sub, page, x: geom.ML, y, width: geom.BODY_W }); y += n.h + between }
  }
  return { stories, rules }
}

