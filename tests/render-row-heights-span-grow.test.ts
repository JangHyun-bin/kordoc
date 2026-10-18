import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { solveRowHeights } from "../src/render/layout.js"

describe("render: 여러 행 칸이 행들보다 높으면 행이 자란다", () => {
  it("저장 높이가 한 행 칸으로 정해진 그 행들 합보다 크면 모자란 만큼 마지막 행이 자란다", () => {
    // 법령 서식 제목: 5행 병합 칸 4406, 그 행들은 한 행 칸 666 씩(합 3330) — 한컴 표 sz 는 키운 합과 같다(+1076)
    const h = solveRowHeights([
      { rowAddr: 0, rowSpan: 5, height: 4406 },
      { rowAddr: 0, rowSpan: 5, height: 2995 },
      ...[0, 1, 2, 3, 4].map(r => ({ rowAddr: r, rowSpan: 1, height: 666 })),
    ], 5)
    assert.deepEqual(h, [666, 666, 666, 666, 1742])
  })
  it("끝 행이 위인 칸부터 채워 겹친 칸이 같은 모자람을 두 번 키우지 않는다", () => {
    // 행 0~3 칸 5000 이 먼저 나와도 행 0~1 칸 3000 이 행 1 을 키운 뒤면 이미 찬다 — 합 5000(문서 순서로 키우면 6000)
    const h = solveRowHeights([
      { rowAddr: 0, rowSpan: 4, height: 5000 },
      { rowAddr: 0, rowSpan: 2, height: 3000 },
      ...[0, 1, 2, 3].map(r => ({ rowAddr: r, rowSpan: 1, height: 1000 })),
    ], 4)
    assert.deepEqual(h, [1000, 2000, 1000, 1000])
  })
  it("표 높이(저장 sz)를 넘겨 키우지 않는다 — 쪽을 넘는 표의 sz 는 첫 쪽 조각이라 이미 넘으면 그대로", () => {
    const cells = [{ rowAddr: 0, rowSpan: 2, height: 3000 }, { rowAddr: 0, rowSpan: 1, height: 1000 }, { rowAddr: 1, rowSpan: 1, height: 1000 }]
    assert.deepEqual(solveRowHeights(cells, 2, 2500), [1000, 1500])
    assert.deepEqual(solveRowHeights(cells, 2, 1800), [1000, 1000])
  })
})
