/**
 * 레이아웃 보존 렌더 — 순수 계산 유틸 (XML 무접촉).
 * 좌표 산식은 .claude/plans/render-poc/findings.md에서 실측 검증된 모델.
 * 단위: HWPUNIT(1/7200in), pt 변환은 /100.
 */

/** HWPX 좌표 속성은 uint32로 저장된 음수가 섞여 있다 (예: vertOffset=4294967103 = -193) */
export function toInt32(v: string | undefined, fallback = 0): number {
  if (v == null || v === "") return fallback
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return n > 0x7fffffff ? n - 0x100000000 : n
}

/** 셀 하나가 주는 경계 제약: boundary[a] + size = boundary[b] */
export interface SpanConstraint {
  a: number
  b: number
  size: number
}

/**
 * 표 열 경계 솔버 — 경계 전파.
 * 결재문서 트레일러처럼 41열 그리드에 span-1 셀이 거의 없어도,
 * x[ca+cs] = x[ca] + w 제약을 고정점까지 전파하면 전 경계가 풀린다 (실측 검증).
 * 미해결 경계는 인접 확정 경계 사이 균등 보간.
 */
export function solveBoundaries(constraints: SpanConstraint[], count: number, total?: number): number[] {
  const x = new Array<number | undefined>(count + 1).fill(undefined)
  x[0] = 0
  if (total != null && total > 0) x[count] = total
  let changed = true
  let guard = 0
  while (changed && guard++ < count + 8) {
    changed = false
    for (const c of constraints) {
      if (c.a < 0 || c.b > count || c.a >= c.b) continue
      const xa = x[c.a]
      const xb = x[c.b]
      if (xa != null && xb == null) {
        x[c.b] = xa + c.size
        changed = true
      } else if (xb != null && xa == null) {
        x[c.a] = xb - c.size
        changed = true
      }
    }
  }
  // 잔여 미해결 경계 — 좌우 확정 경계 사이 균등 보간
  let i = 0
  while (i <= count) {
    if (x[i] != null) { i++; continue }
    let lo = i - 1
    let hi = i
    while (hi <= count && x[hi] == null) hi++
    const loV = x[lo] as number
    const hiV = hi <= count ? (x[hi] as number) : loV + (hi - lo) * 1000
    const n = hi - lo
    for (let k = 1; k < n; k++) x[lo + k] = loV + ((hiV - loV) * k) / n
    if (hi > count) x[count] = hiV
    i = hi
  }
  // 단조 보정 (모순 제약 방어)
  const out = x as number[]
  for (let k = 1; k <= count; k++) if (out[k] < out[k - 1]) out[k] = out[k - 1]
  return out
}

/**
 * 표 행 높이 솔버 — rowSpan=1 셀의 max가 기본, rowSpan>1은 잔여 균등분배.
 * h=1 더미 셀(헤어라인 행 장식)이 섞이므로 열과 달리 max 방식이 안전.
 * grow: 셀 콘텐츠(사진 등)가 설계 높이를 넘으면 초과분만큼 행이 자란다 —
 * 사진대지 실측: 설계 16441 + 사진 22209 → 행 22209, 표 sz 합치 정확 일치.
 */
export function solveRowHeights(
  cells: { rowAddr: number; rowSpan: number; height: number; contentH?: number }[],
  rowCount: number,
  maxTotal = Number.POSITIVE_INFINITY,
): number[] {
  const h = new Array<number>(rowCount).fill(0)
  for (const c of cells) {
    if (c.rowSpan === 1 && c.rowAddr >= 0 && c.rowAddr < rowCount) {
      h[c.rowAddr] = Math.max(h[c.rowAddr], c.height)
    }
  }
  // 콘텐츠 초과 성장 (rowSpan=1 셀만 — 사진 셀 케이스). 여러 행 칸의 잔여 분배보다 먼저 — 자란 행만큼 잔여가 준다
  // (한컴 PDF: 4행 병합 칸 17749 안의 사진 행이 10419 → 10690 으로 자라 병합 칸 마지막 행이 100, 먼저 나누면 384)
  for (const c of cells) {
    if (c.rowSpan === 1 && c.contentH != null && c.rowAddr >= 0 && c.rowAddr < rowCount) {
      if (c.contentH > h[c.rowAddr]) h[c.rowAddr] = c.contentH
    }
  }
  // rowSpan>1 셀 — 포함 행 중 미확정(0) 행에 잔여를 준다. 미확정 행이 하나뿐인 칸부터 되풀이해 풀고(엇갈려 병합한 표는 그것만으로
  // 행 높이가 다 정해진다), 더 못 풀 때만 남은 칸을 문서 순서로 균등 분배한다
  const spans = cells.filter(c => c.rowSpan > 1).map(c => {
    const rows: number[] = []
    for (let r = c.rowAddr; r < Math.min(c.rowAddr + c.rowSpan, rowCount); r++) rows.push(r)
    return { c, rows }
  })
  const done = new Set<number>()
  const solve = (k: number, evenOnly: boolean): boolean => {
    const { c, rows } = spans[k]
    const known = rows.reduce((s, r) => s + h[r], 0)
    const missing = rows.filter(r => h[r] === 0)
    if (missing.length === 0) { done.add(k); return false }
    if (evenOnly && missing.length !== 1) return false
    done.add(k)
    if (c.height <= known) return false
    const each = (c.height - known) / missing.length
    for (const r of missing) h[r] = each
    return true
  }
  for (let again = true; again;) { again = false; for (let k = 0; k < spans.length; k++) if (!done.has(k) && solve(k, true)) again = true }
  for (let k = 0; k < spans.length; k++) if (!done.has(k)) solve(k, false)
  // 여러 행 칸의 저장 높이가 (한 행 칸으로 이미 정해진) 그 행들 합보다 크면 모자란 만큼 마지막 행이 자란다 — 끝 행이 위인 칸부터
  // 채워 겹친 칸이 같은 모자람을 두 번 키우지 않게 하고, 표 높이(maxTotal, 저장 sz)를 넘겨 키우지 않는다(쪽을 넘는 표의 sz 는 첫 쪽 조각).
  // 한컴 저장 표 sz: 이런 칸이 있는 표 105개 중 78개가 키운 합과 같고, 키우지 않은 합과 같은 표는 없다
  // (같은 판 PDF: 2행 병합 칸 882 의 두 행이 2 + 782 → 8.75pt)
  let total = h.reduce((s, x) => s + x, 0)
  for (const { c, rows } of [...spans].sort((a, b) => a.rows[a.rows.length - 1] - b.rows[b.rows.length - 1] || b.rows[0] - a.rows[0])) {
    const known = rows.reduce((s, r) => s + h[r], 0)
    const add = Math.min(c.height - known, maxTotal - total)
    if (rows.length && add > 0) { h[rows[rows.length - 1]] += add; total += add }
  }
  return h
}

// 자연폭 계산은 hwpx/text-metrics.ts의 함초롬바탕 실측 advance 테이블(measureTextWidth)을 재사용한다.
