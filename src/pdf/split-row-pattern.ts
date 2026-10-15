import type { IRCell, IRTable } from "../types.js"
import { IMAGE_CELLS } from "./table-meta.js"

type Owner = { r: number; c: number; rs: number; cs: number }
const textOf = (cell: IRCell): string => cell.text.replace(/<\/?u>|~~/g, "").trim()
const plain = (cell: IRCell): boolean => !cell.blocks?.length && !IMAGE_CELLS.has(cell)

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
