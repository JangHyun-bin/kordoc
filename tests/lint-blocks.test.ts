/** 블록 단위 검수 — 문단·표 칸 블록 id 와 블록 안 위치로 지적 (열린 문서 편집 도구 연계, 2026-10-21) */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { lintBlocks, blocksToLines, type LintBlock } from "../src/hwpx/lint-blocks.js"

const doc: LintBlock[] = [
  { id: "p1", text: "□ 추진 배경" },
  { id: "p2", text: "○ 2026.10.15 회의 개최 및 컨텐츠 점검" },
  { id: "t1-a1", text: "구분", table: { id: "t1", row: 0, col: 0 } },
  { id: "t1-b1", text: "금액", table: { id: "t1", row: 0, col: 1 } },
  { id: "t1-a2", text: "합계", table: { id: "t1", row: 1, col: 0 } },
  { id: "t1-b2", text: "400", table: { id: "t1", row: 1, col: 1 } },
  { id: "t1-a3", text: "인건비|기타", table: { id: "t1", row: 2, col: 0 } },
  { id: "t1-b3", text: "100", table: { id: "t1", row: 2, col: 1 } },
  { id: "p3", text: "- 사업비: 단가 10,000원 × 3명 × 2개월 = 70,000원" },
]

describe("lintBlocks", () => {
  it("문단 지적은 그 문단 id 와 문단 안 위치", () => {
    const r = lintBlocks(doc)
    const date = r.findings.find((f) => f.rule === "DATE_NO_SPACE")!
    assert.equal(date.block, "p2")
    assert.equal(date.offset, doc[1].text.indexOf("2026.10.15"))
    const loan = r.findings.find((f) => f.rule === "LOANWORD_ERROR")!
    assert.equal(loan.block, "p2")
    assert.equal(doc[1].text.slice(loan.offset!, loan.offset! + loan.length), "컨텐츠")
  })

  it("표 칸 지적은 칸 id 와 칸 안 위치 — 칸 글의 | 도 길이를 바꾸지 않는다", () => {
    const r = lintBlocks(doc, { budget: true })
    const total = r.findings.find((f) => f.rule === "BUDGET_TOTAL_MISMATCH")!
    assert.equal(total.block, "t1-b2")
    assert.equal(total.offset, 0)
    assert.match(total.suggest!, /400 → 100/)
    const calc = r.findings.find((f) => f.rule === "BUDGET_CALC_MISMATCH")!
    assert.equal(calc.block, "p3")
    assert.equal(doc[8].text.slice(calc.offset!, calc.offset! + calc.length), calc.match)
  })

  it("마크다운 구조로 읽히는 문단(펜스·제목·표·인용)은 글자로 읽고 뒤 문단도 계속 검수", () => {
    const r = lintBlocks([{ id: "a", text: "~~~~~~~~" }, { id: "b", text: "# 머리 아닌 문단" }, { id: "c", text: "금번 회의 2026.1.6 개최" }])
    const after = r.findings.filter((f) => f.block === "c").map((f) => f.rule)
    assert.ok(after.includes("DATE_NO_SPACE"), "펜스 같은 문단 뒤도 검수")
    assert.equal(blocksToLines([{ id: "b", text: "# x" }])[0].text, "\\# x")
  })

  it("칸 하나뿐인 표(요약 상자)는 본문으로 — 표 칸 예외 없이 '금번' 같은 쉬운 말 지적", () => {
    const r = lintBlocks([{ id: "box", text: "금번 회의를 통해 결정하고자 함", table: { id: "s", row: 0, col: 0 } }])
    const plain = r.findings.find((f) => f.rule === "PLAIN_LANGUAGE")!
    assert.equal(plain.block, "box")
    assert.equal(plain.offset, 0)
  })

  it("줄 단위 지적(문체)은 블록만, 위치는 지적 글이 그 블록에 한 번뿐일 때", () => {
    const r = lintBlocks([{ id: "x", text: "○ 행정 서비스를 개선하는 것이 필요하다." }], { munche: true })
    const f = r.findings.find((g) => g.category === "munche")
    assert.ok(f, "문체 지적이 있어야 함")
    assert.equal(f!.block, "x")
  })

  it("판정은 runLintSuite 와 같다(요약·게이트)", () => {
    const r = lintBlocks([{ id: "a", text: "21,400원 × 1,400명 × 12월 = 359,600천원" }], { budget: true })
    assert.equal(r.summary.ok, false)
    assert.equal(r.summary.errors, 1)
  })
})
