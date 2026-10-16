import type { IRCell, IRTable } from "../types.js"
import { IMAGE_CELLS } from "./table-meta.js"

type Owner = { r: number; c: number; rs: number; cs: number }
const textOf = (cell: IRCell): string => cell.text.replace(/<\/?u>|~~/g, "").trim()
const plain = (cell: IRCell): boolean => !cell.blocks?.length && !IMAGE_CELLS.has(cell)

/** 같은 표의 다른 위치에서 이미 독립된 두 행으로 반복된 내용 쌍은 새 행 증거다. */
export function matchesIndependentRowPair(table: IRTable, owner: (Owner | null)[][], first: number): boolean {
  const norm = (cell: IRCell): string => textOf(cell).replace(/\s+/g, "")
  const pairs: Array<{ c: number; cs: number; upper: string; lower: string }> = []
  for (let c = 0; c < table.cols;) {
    const u = owner[first - 1]?.[c], d = owner[first]?.[c]
    if (u && u === d) { c = u.c + u.cs; continue }
    const upper = u ? table.cells[u.r][u.c] : undefined, lower = d ? table.cells[d.r][d.c] : undefined
    if (!upper?.text.trim() && !lower?.text.trim()) { c++; continue }
    if (!u || !d || !upper || !lower || u.r !== first - 1 || d.r !== first || u.c !== c || d.c !== c
      || u.rs !== 1 || d.rs !== 1 || u.cs !== d.cs || !plain(upper) || !plain(lower) || !norm(upper) || !norm(lower)) return false
    pairs.push({ c, cs: u.cs, upper: norm(upper), lower: norm(lower) })
    c += u.cs
  }
  if (pairs.length < 2 || pairs.every(p => p.upper === p.lower)) return false
  return table.cells.some((_, r) => {
    if (r + 1 >= table.rows || r + 1 >= first - 1 && r <= first) return false
    return pairs.every(p => [p.upper, p.lower].every((text, i) => {
      const a = owner[r + i]?.[p.c], cell = table.cells[r + i]?.[p.c]
      return a?.r === r + i && a.c === p.c && a.rs === 1 && a.cs === p.cs && !!cell && plain(cell) && norm(cell) === text
    }))
  })
}

/** 상위 항목과 하위 목록이 쪽 경계에서 갈렸는지, 같은 표의 완성행 전체를 근거로 확인한다. */
export function matchesCompleteSiblingRow(table: IRTable, owner: (Owner | null)[][], first: number): boolean {
  const pairs: Array<{ c: number; cs: number; upper: IRCell; lower: IRCell }> = []
  for (let c = 0; c < table.cols;) {
    const u = owner[first - 1][c], d = owner[first][c]
    if (u && u === d) { c = u.c + u.cs; continue }
    if (!u || !d || u.r !== first - 1 || d.r !== first || u.c !== c || d.c !== c || u.rs !== 1 || d.rs !== 1 || u.cs !== d.cs) return false
    const upper = table.cells[u.r][c], lower = table.cells[d.r][c]
    if (!plain(upper) || !plain(lower)) return false
    pairs.push({ c, cs: u.cs, upper, lower })
    c += u.cs
  }
  const filled = pairs.filter(p => textOf(p.upper) && textOf(p.lower))
  if (filled.length !== 1) return false
  const main = filled[0], upper = textOf(main.upper), lower = textOf(main.lower)
  if (!/^[가-힣]\.\s*\S/.test(upper) || /(?:^|\n)\s*\d+\)/.test(upper)) return false
  const marks = lower.split("\n").map(s => /^\s*(\d+)\)/.exec(s)).filter(m => m !== null)
  if (!/^1\)/.test(lower) || marks.length < 2 || marks.some((m, i) => +m[1] !== i + 1)) return false
  if (pairs.some(p => p !== main && textOf(p.lower) && !/^[○●◯✓✔]+$/.test(textOf(p.lower)))) return false
  if (!pairs.some(p => p !== main && textOf(p.upper) && !textOf(p.lower))) return false
  const norm = (s: string, title: boolean): string => (title ? s.replace(/^[가-힣]\.\s*/, "") : s).replace(/\s+/g, "")
  return table.cells.some((row, r) => r !== first - 1 && r !== first && pairs.every(p => {
    const anchor = owner[r][p.c], peer = row[p.c]
    return anchor?.r === r && anchor.c === p.c && anchor.rs === 1 && anchor.cs === p.cs && plain(peer)
      && norm(textOf(peer), p === main) === norm(textOf(p.upper) + "\n" + textOf(p.lower), p === main)
  }))
}

/** 분류칸이 이어지고, 완성된 평가행의 번호·점수열·마지막 항목까지 같을 때만 목록 조각을 잇는다. */
export function matchesCompleteRubricRow(table: IRTable, owner: (Owner | null)[][], first: number): boolean {
  const pairs: Array<{ c: number; cs: number; upper: IRCell; lower: IRCell }> = []
  let carriedLabel = false
  for (let c = 0; c < table.cols;) {
    const u = owner[first - 1][c], d = owner[first][c]
    if (u && u === d) {
      if (u.r === first - 1 && u.rs === 2 && textOf(table.cells[u.r][u.c])) carriedLabel = true
      c = u.c + u.cs
      continue
    }
    if (!u || !d || u.r !== first - 1 || d.r !== first || u.c !== c || d.c !== c || u.rs !== 1 || d.rs !== 1 || u.cs !== d.cs) return false
    const upper = table.cells[u.r][c], lower = table.cells[d.r][c]
    if (!plain(upper) || !plain(lower) || !textOf(upper) || !textOf(lower)) return false
    pairs.push({ c, cs: u.cs, upper, lower })
    c += u.cs
  }
  if (!carriedLabel || pairs.length !== 2) return false
  const values = (cell: IRCell): string[] => textOf(cell).split("\n").map(s => s.trim()).filter(Boolean)
  const score = pairs.find(p => [...values(p.upper), ...values(p.lower)].every(s => /^-?\d+(?:\.\d+)?$/.test(s)))
  if (!score) return false
  const main = pairs.find(p => p !== score)!
  const items = (s: string) => [...s.matchAll(/(?:^|\n)\s*([A-Z])\.\s+/g)].map(m => ({ n: m[1].charCodeAt(0), at: m.index! + m[0].lastIndexOf(m[1]) }))
  const upper = textOf(main.upper), lower = textOf(main.lower), um = items(upper), dm = items(lower), marks = [...um, ...dm]
  if (!/^A\.\s/.test(upper) || !/^B\.\s/.test(lower) || um.length !== 1 || dm.length < 2 || marks.some((m, i) => m.n !== 65 + i)) return false
  const upScores = values(score.upper), downScores = values(score.lower), scores = [...upScores, ...downScores]
  if (upScores.length !== um.length || downScores.length !== dm.length) return false
  const norm = (s: string): string => s.replace(/\s+/g, "")
  const tail = norm(lower.slice(dm[dm.length - 1].at))
  return table.cells.some((row, r) => {
    if (r === first - 1 || r === first || !pairs.every(p => {
      const a = owner[r][p.c]
      return a?.r === r && a.c === p.c && a.rs === 1 && a.cs === p.cs && plain(row[p.c])
    })) return false
    const peer = textOf(row[main.c]), peerMarks = items(peer)
    return peerMarks.length === marks.length && peerMarks.every((m, i) => m.n === marks[i].n)
      && values(row[score.c]).join("|") === scores.join("|") && norm(peer.slice(peerMarks[peerMarks.length - 1].at)) === tail
  })
}

/** 한글 항목 번호 차례 */
const KO_ORDER = "가나다라마바사아자차카타파하"
/** 줄 머리 항목 번호 — 꼴(1.·1)·(1)·가.·가)·(가)·①·A.)과 차례 */
export function itemMark(line: string): { style: string; n: number } | null {
  line = line.replace(/<\/?u>|~~/g, "").trim()
  let m = /^(\d{1,2})([.)])(?!\d)/.exec(line)
  if (m) return { style: "1" + m[2], n: +m[1] }
  if ((m = /^\((\d{1,2})\)/.exec(line))) return { style: "(1)", n: +m[1] }
  if ((m = /^([가-하])([.)])/.exec(line)) && KO_ORDER.includes(m[1])) return { style: "가" + m[2], n: KO_ORDER.indexOf(m[1]) }
  if ((m = /^\(([가-하])\)/.exec(line)) && KO_ORDER.includes(m[1])) return { style: "(가)", n: KO_ORDER.indexOf(m[1]) }
  if ((m = /^[①-⑳]/.exec(line))) return { style: "①", n: m[0].charCodeAt(0) }
  if ((m = /^([A-Z])\.\s/.exec(line))) return { style: "A.", n: m[1].charCodeAt(0) }
  return null
}

/** 연속된 네 완성행이 각각 항목 하나와 독립된 옆칸을 가지면, 쪽 경계도 새 항목 행이다. */
export function hasNumberedRowSequence(table: IRTable, owner: (Owner | null)[][], first: number): boolean {
  if (first < 3) return false
  const rows = [first - 3, first - 2, first - 1, first]
  const separate = (c: number, cs: number): boolean => rows.every(r => {
    const a = owner[r]?.[c], cell = table.cells[r]?.[c]
    return a?.r === r && a.c === c && a.rs === 1 && a.cs === cs && !!cell && plain(cell) && !!textOf(cell)
  })
  for (let c = 0; c < table.cols; c++) {
    const a = owner[first]?.[c]
    if (!a || !separate(c, a.cs)) continue
    const marks = rows.map(r => {
      const lines = textOf(table.cells[r][c]).split("\n"), firstMark = itemMark(lines[0])
      return firstMark && lines.slice(1).every(l => !itemMark(l)) ? firstMark : null
    })
    const head = marks[0]
    if (!head || marks.some((m, i) => !m || m.style !== head.style || m.n !== head.n + i)) continue
    for (let d = 0; d < table.cols; d++) {
      const side = owner[first]?.[d]
      if (side && (d + side.cs <= c || d >= c + a.cs) && separate(d, side.cs)) return true
    }
  }
  return false
}

