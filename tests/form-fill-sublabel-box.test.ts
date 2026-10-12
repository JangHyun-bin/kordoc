/**
 * 서식 채움 회귀 (#145·#146) — 입찰 별지 서식 모양을 합성 문서로 고정한다.
 *  1. 행 머리("신청인"·위임장 "대표자") 옆 하위 라벨 칸("상호 또는 법인명칭"·"성 명")은 값 자리가 아니다 — 덮어쓰지 않고,
 *     배열 값 순서가 다른 키("성명")를 함께 주는지에 따라 바뀌지 않는다. 원본 보존·markdown 두 경로가 같다
 *  2. 열 머리 아래 날짜 자리표시("년 월 - 년 월")는 값 칸 — 머리 행 보호가 풀려 옆 머리 칸("직 위")에 값이 들어가지 않는다
 *  3. 한 칸짜리 상자의 "업 체 명 :"·"대 표 자 : (인)" 줄을 채우고, 날인 표시 "(인)" 은 남긴다
 *  4. patch 가 서식의 빈 행 2개를 실적 3건으로 바꾼다(짝지은 행 수정 + 남는 행 추가)
 *  5. 2단 머리("기 간"·"근 무 처" 세로 병합 + "담당업무" → "분야"·"내용")의 네 열을 데이터 행에 채운다 — 두 경로·필드 인식이 같다
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { markdownToHwpx, parse, patchHwpx, fillForm, extractFormFields } from "../src/index.js"
import { isDatePlaceholder } from "../src/form/recognize.js"

const BID_FORM = [
  "입찰참가신청서", "",
  "<table>\n<tr><td rowspan=\"2\">신청인</td><td>상호 또는 법인명칭</td><td></td></tr>\n<tr><td>대표자</td><td></td></tr>\n</table>", "",
  "위임장", "",
  "<table>\n<tr><td rowspan=\"2\">대표자</td><td>성 명</td><td></td></tr>\n<tr><td>주 소</td><td></td></tr>\n</table>", "",
  "회사 일반현황", "",
  "<table>\n<tr><td>회사명</td><td></td><td>대표자</td><td></td></tr>\n<tr><td>주소</td><td colspan=\"3\"></td></tr>\n</table>", "",
].join("\n")

async function fillBoth(md: string, values: Record<string, string | string[]>) {
  const doc = Buffer.from(await markdownToHwpx(md))
  const out: Record<string, { markdown: string; unmatched: string[] }> = {}
  for (const fmt of ["hwpx-preserve", "markdown"] as const) {
    const r = await fillForm(doc, values, fmt)
    const markdown = fmt === "markdown" ? r.output as string : (await parse(Buffer.from(r.output as ArrayBuffer), { layoutTables: "keep" })).markdown
    out[fmt] = { markdown, unmatched: r.fill.unmatched }
  }
  return out
}

describe("서식 채움 — 하위 라벨·자리표시·상자 줄 (#145·#146)", () => {
  it("행 머리 옆 하위 라벨 칸을 덮어쓰지 않고, 배열 순서가 다른 키와 무관하다", async () => {
    for (const values of [{ 대표자: ["D0", "D1", "D2"] }, { 성명: ["S0"], 대표자: ["D0", "D1", "D2"] }]) {
      for (const [fmt, r] of Object.entries(await fillBoth(BID_FORM, values))) {
        assert.match(r.markdown, /대표자(<\/t[dh]>|\s*\|)\s*(<t[dh]>)?D0/, `${fmt}: 신청서 대표자`)
        assert.match(r.markdown, /대표자(<\/t[dh]>|\s*\|)\s*(<t[dh]>)?D1/, `${fmt}: 회사 일반현황 대표자`)
        assert.ok(r.markdown.includes("성 명"), `${fmt}: 하위 라벨 보존`)
        assert.ok(!r.markdown.includes("D2"), `${fmt}: 위임장 쪽에 소진하지 않음`)
      }
    }
    for (const [fmt, r] of Object.entries(await fillBoth(BID_FORM, { 신청인: "S" }))) {
      assert.ok(r.markdown.includes("상호 또는 법인명칭"), `${fmt}: 하위 라벨 보존`)
      assert.deepEqual(r.unmatched, ["신청인"], `${fmt}: 쓸 칸이 없으면 알린다`)
    }
  })

  it("열 머리 아래 날짜 자리표시는 값 칸 — 옆 머리 칸에 값이 들어가지 않는다", async () => {
    const md = "<table>\n<tr><td>기 간</td><td>근 무 처</td><td>직 위</td><td>비 고</td></tr>\n<tr><td>년 월 - 년 월</td><td></td><td>( )</td><td>년 월</td></tr>\n</table>\n"
    for (const [fmt, r] of Object.entries(await fillBoth(md, { 기간: "2019.03 - 2023.02", 근무처: "곰돌이건축" }))) {
      assert.ok(r.markdown.includes("직 위"), `${fmt}: 머리 칸 보존`)
      assert.ok(r.markdown.includes("2019.03 - 2023.02") && r.markdown.includes("곰돌이건축"), `${fmt}: ${r.markdown}`)
      assert.deepEqual(r.unmatched, [])
    }
  })

  it("날짜 자리표시 판정 — 실제 날짜 값과 날짜 라벨은 아니다", () => {
    for (const t of ["년 월 - 년 월", "년 월 일 ~ 년 월 일", "년 월", "20 년 월 일", "년 월부터 년 월까지"]) assert.ok(isDatePlaceholder(t), t)
    for (const t of ["8월 31일", "2024년 3월", "생년월일", "년월일", "기 간", "2024. 3. 1."]) assert.ok(!isDatePlaceholder(t), t)
  })

  it("상자 안 '업 체 명 :' 줄을 채우고 날인 표시는 남긴다", async () => {
    const md = "서약서\n\n<table>\n<tr><td>위 사항을 서약합니다.<br>업 체 명 :<br>주 소 :<br>대 표 자 : (인)</td></tr>\n</table>\n\n대표자 : (인)\n"
    for (const [fmt, r] of Object.entries(await fillBoth(md, { 업체명: "곰돌이", 주소: "서울 광진구", 대표자: ["홍길동", "김철수"] }))) {
      assert.ok(r.markdown.includes("업 체 명 : 곰돌이"), `${fmt}: ${r.markdown}`)
      assert.ok(r.markdown.includes("주 소 : 서울 광진구"), fmt)
      assert.ok(r.markdown.includes("대 표 자 : 홍길동 (인)"), fmt)
      assert.ok(r.markdown.includes("대표자 : 김철수 (인)"), fmt)
      assert.deepEqual(r.unmatched, [])
    }
  })

  it("patch — 서식 빈 행 2개를 실적 3건으로 바꾼다", async () => {
    const md = "| 기 간 | 근무처 | 직 위 | 담당업무 |\n| --- | --- | --- | --- |\n| 년 월 - 년 월 |  |  |  |\n| 년 월 - 년 월 |  |  |  |\n"
    const doc = new Uint8Array(await markdownToHwpx(md))
    const keep = (await parse(Buffer.from(doc), { layoutTables: "keep" })).markdown
    const row = "| 년 월 - 년 월 |  |  |  |"
    const edited = keep.replace(`${row}\n${row}`, [
      "| 2019.03 - 2023.02 | 가 | 과장 | 설계 |", "| 2023.03 - 2025.02 | 나 | 차장 | 감리 |", "| 2025.03 - 2026.02 | 다 | 부장 | 총괄 |",
    ].join("\n"))
    assert.notEqual(edited, keep)
    const p = await patchHwpx(doc, edited)
    assert.ok(p.success, p.error)
    assert.deepEqual(p.skipped, [])
    const re = (await parse(Buffer.from(p.data!), { layoutTables: "keep" })).markdown
    assert.equal(re.trim(), edited.trim())
  })

  it("2단 머리 표의 네 열을 데이터 행에 채운다", async () => {
    const md = "<table>\n<tr><td rowspan=\"2\">기 간</td><td rowspan=\"2\">근 무 처</td><td colspan=\"2\">담당업무</td></tr>\n<tr><td>분야</td><td>내용</td></tr>\n" +
      "<tr><td>년 월 - 년 월</td><td></td><td></td><td></td></tr>\n<tr><td>년 월 - 년 월</td><td></td><td></td><td></td></tr>\n</table>\n"
    for (const [fmt, r] of Object.entries(await fillBoth(md, { 기간: ["2019 - 2023", "2023 - 2025"], 근무처: ["가건축", "나건축"], 분야: ["설계"], 내용: ["실시설계"] }))) {
      for (const t of ["담당업무", "분야", "내용", "2019 - 2023", "2023 - 2025", "가건축", "나건축", "설계", "실시설계"]) assert.ok(r.markdown.includes(t), `${fmt}: ${t}\n${r.markdown}`)
      assert.deepEqual(r.unmatched, [], fmt)
    }
    const p = await parse(Buffer.from(await markdownToHwpx(md)), { layoutTables: "keep", keepTrailingEmptyCols: true })
    assert.ok(p.success)
    const heads = extractFormFields(p.blocks).fields.filter(f => f.row === 2).map(f => `${f.label}@${f.col}`)
    for (const h of ["기 간@0", "근 무 처@1", "분야@2", "내용@3"]) assert.ok(heads.includes(h), `${h} ∉ ${heads}`)
    assert.ok(!extractFormFields(p.blocks).fields.some(f => f.label === "기 간" && f.value === "근 무 처"), "머리끼리 짝짓지 않는다")
  })
})
