/**
 * 쪽을 넘는 본문 표의 행 배치 — 표 그리기(drawTable)와 쪽 프리패스가 같은 계획을 쓴다.
 * 행 바닥이 본문 바닥을 넘으면: 칸 안 나눔(pageBreak=CELL) 표는 행을 칸 줄 경계에서 갈라 남은 줄을 다음 쪽 맨 위(머리 행 아래)에,
 * 그 밖의 표는 그 행부터 다음 쪽으로 넘긴다. 쪽마다 적어도 한 행(조각)은 놓는다. 칸을 가르는 규칙은 reflow 와 같다 —
 * 칸마다 (칸 위 여백 + 줄 바닥) ≤ 남은 높이 − 칸 아래 여백 인 줄까지 이 쪽, 남은 줄에 칸 위아래 여백을 더한 높이가 다음 쪽 조각.
 */

import { elements, ln, num, type CellModel } from "./para-model.js"
import { findChildByLocalName } from "../hwpx/parser-shared.js"

/** 행 하나가 한 쪽에 놓인 조각 — page 는 표 시작 쪽에서 센 쪽 차이, y 는 절대 위치. range 는 칸마다 이 조각에 그릴 내용 vertpos [from, to) */
export interface RowPiece { page: number; y: number; h: number; range?: Map<Element, [number, number]> }

/**
 * 칸 subList 최상위 문단 줄 — 연속 좌표 [위, 아래]와 그 줄. 한컴이 이미 칸을 쪽에서 갈라 저장한 칸은 줄 vertpos 가 다음 쪽 기준 0 으로
 * 되돌아간다(한컴 저장본: 20020 → 0) — 되돌아가는 곳마다 앞 줄 끝(+간격)에 잇는다
 */
export function cellLineBoxes(c: CellModel): Array<{ seg: Element; top: number; bottom: number; part: number }> {
  const out: Array<{ seg: Element; top: number; bottom: number; part: number }> = []
  let shift = 0, prevV = Number.NEGATIVE_INFINITY, prevEnd = 0, part = 0
  for (const p of c.sub ? elements(c.sub) : []) if (ln(p) === "p") {
    const lsa = findChildByLocalName(p, "linesegarray")
    for (const sg of lsa ? elements(lsa) : []) if (ln(sg) === "lineseg") {
      const v = num(sg, "vertpos")
      if (v < prevV) { shift = prevEnd - v; part++ }
      prevV = v
      const top = v + shift, bottom = top + num(sg, "vertsize")
      prevEnd = bottom + num(sg, "spacing")
      out.push({ seg: sg, top, bottom, part })
    }
  }
  return out
}
function cellLines(c: CellModel): [number, number][] {
  return cellLineBoxes(c).map(b => [b.top, b.bottom])
}

/**
 * @param rowH 행 높이(그리기와 같은 값)
 * @param ty 표 위(절대), MT·BODY_H 본문 위·높이. BODY_H 0 이면 나누지 않는다
 * @returns 행마다 조각 목록
 */
export function planTableRows(tbl: Element, cells: CellModel[], rowH: number[], ty: number, MT: number, BODY_H: number): RowPiece[][] {
  const nRows = rowH.length
  const rowY = [0]
  for (const h of rowH) rowY.push(rowY[rowY.length - 1] + h)
  const plain = (): RowPiece[][] => rowH.map((h, r) => [{ page: 0, y: ty + rowY[r], h }])
  const pageBottom = MT + BODY_H
  if (BODY_H <= 0 || ty + rowY[nRows] <= pageBottom) return plain()
  let hdrRows = 0
  if (tbl.getAttribute("repeatHeader") === "1") while (hdrRows < nRows && cells.some(c => c.ra === hdrRows) && cells.filter(c => c.ra === hdrRows).every(c => c.el.getAttribute("header") === "1")) hdrRows++
  const contTop = MT + rowY[hdrRows]
  const cellSplit = tbl.getAttribute("pageBreak") === "CELL"
  const out: RowPiece[][] = []
  let page = 0, y = ty, first = true
  for (let r = 0; r < nRows; r++) {
    let h = rowH[r]
    const pieces: RowPiece[] = []
    // 칸 안 나눔은 이 행의 한 행짜리 칸 줄로 가른다(reflow 와 같다) — 여러 행에 걸친 칸은 가르지 않고 그 행 위치에 그린다
    const rowCells = cells.filter(c => c.ra === r && c.rs === 1)
    const splittable = cellSplit && r >= hdrRows && rowCells.length > 0
    // 한컴이 이 행을 이미 쪽에서 갈라 저장했으면(칸 줄 vertpos 되돌아감) 그 자리 그대로 가른다
    const boxes = splittable ? new Map(rowCells.map(c => [c.el, cellLineBoxes(c)] as const)) : undefined
    const hParts = boxes ? Math.max(0, ...[...boxes.values()].flatMap(bs => bs.map(b => b.part))) : 0
    if (boxes && hParts > 0) {
      for (let k = 0; k <= hParts; k++) {
        const range = new Map<Element, [number, number]>()
        let ext = 0
        for (const c of rowCells) {
          const bs = boxes.get(c.el) ?? []
          const inK = bs.filter(b => b.part === k), next = bs.find(b => b.part > k)
          const from = inK[0]?.top ?? next?.top ?? Number.POSITIVE_INFINITY
          range.set(c.el, [from, next?.top ?? Number.POSITIVE_INFINITY])
          if (inK.length) ext = Math.max(ext, inK[inK.length - 1].bottom - inK[0].top + c.marginT + c.marginB)
        }
        const last = k === hParts
        const ph = last ? ext : k === 0 ? pageBottom - y : pageBottom - contTop
        pieces.push({ page, y, h: ph, range })
        if (!last) { page++; y = contTop; first = true } else h = ph
      }
      out.push(pieces)
      y += h; first = false
      continue
    }
    if (splittable && y + h > pageBottom) {
      const from = new Map<Element, number>()
      const lines = new Map(rowCells.map(c => [c.el, cellLines(c)] as const))
      while (y + h > pageBottom && BODY_H > rowY[hdrRows]) {
        const avail = pageBottom - y
        let rem = 0, placed = false, allFit = true
        const cuts: [Element, number, number][] = []
        for (const c of rowCells) {
          const off = from.get(c.el) ?? 0
          const ls = (lines.get(c.el) ?? []).filter(l => l[0] >= off)
          if (!ls.length) { cuts.push([c.el, off, off]); continue }
          const end = Math.max(...ls.map(l => l[1]))
          const k = ls.findIndex(l => c.marginT + (l[1] - off) > avail - c.marginB)
          if (k < 0) { cuts.push([c.el, off, end + 1]); continue }
          allFit = false
          if (k > 0) placed = true
          cuts.push([c.el, off, ls[k][0]])
          rem = Math.max(rem, end - ls[k][0] + c.marginT + c.marginB)
        }
        if (allFit) {
          // 칸 글은 다 들어가고 행 높이만 쪽을 넘는다 — 행은 이 쪽 바닥까지(남는 높이는 버린다)
          h = avail
          break
        }
        if (!placed) {
          // 이 쪽에 한 줄도 못 놓는다 — 쪽 맨 위면 그대로 넘치게 두고, 아니면 행째 다음 쪽
          if (first) break
          page++; y = contTop; first = true
          continue
        }
        pieces.push({ page, y, h: avail, range: new Map(cuts.map(([el, a, b]) => [el, [a, b]])) })
        for (const [el, , b] of cuts) from.set(el, b)
        page++; y = contTop; first = true; h = rem
      }
      pieces.push({ page, y, h, range: new Map(rowCells.map(c => [c.el, [from.get(c.el) ?? 0, Number.POSITIVE_INFINITY]])) })
      out.push(pieces)
      y += h; first = false
      continue
    }
    if (!first && y + h > pageBottom && r >= hdrRows) { page++; y = contTop; first = true }
    out.push([{ page, y, h }])
    y += h; first = false
  }
  return out
}
