/**
 * reflow 한컴 조판 규칙 — 한컴독스 웹 한글 조판 엔진에서 읽어 낸 규칙을 kordoc 코드로 다시 쓴 것.
 *  1. 글자 폭은 글자마다 4 HWPUNIT 단위(hancomCharWidth) — 공백은 4·⌊크기/8⌋, 자간은 ⌊폭/4⌋ 의 %를 4 단위로
 *  2. 폭표 없는 한글 글꼴은 한글 1em(faceClassForReflow) — 함초롬만 함초롬 폭, 옛 HFT 명조·고딕은 고정폭
 *  3. KoPub 바탕·돋움 실측 폭표(한글 0.936em·0.872em, 굵기끼리 같음)
 *  4. 공백 최소값(condense): 줄 가용폭 + 그 줄 공백 폭 합 × condense%
 *  5. 한컴 기본 금칙 집합 — 닫는 작은따옴표(’)는 줄머리 금지
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { hancomCharWidth, faceClassForReflow, simulateWrap, syntheticBoldEm } from "../src/hwpx/text-metrics.js"
import { fontAdvanceEm1000 } from "../src/hwpx/font-metrics.js"

describe("reflow 한컴 조판 규칙", () => {
  it("글자 폭은 글자마다 4 단위로 양자화한다", () => {
    assert.equal(hancomCharWidth("가", 1000, 100, 0, "hcr"), 972) // 4·MulDiv(970, 250, 1000) — 실수 폭 970
    assert.equal(hancomCharWidth(" ", 1100, 100, 0, "hcr"), 548) // 4·⌊1100/8⌋ — 0.5em(550) 이 아니다
    assert.equal(hancomCharWidth("가", 1300, 98, -2, "fixedPitch"), 1248) // 4·⌊1000·325·98/10⁵⌋ = 1272, 자간 4·MulDiv(318, −2, 100) = −24
    for (const [ch, h] of [["가", 1000], ["A", 1100], [" ", 1300]] as const) assert.equal(hancomCharWidth(ch, h, 100, 0, "hcr") % 4, 0)
  })

  it("폭표 없는 한글 글꼴은 한글 1em, 함초롬은 함초롬 폭, 명조·고딕은 고정폭", () => {
    assert.equal(faceClassForReflow("HY견명조"), "cjk")
    assert.equal(faceClassForReflow("신명조"), "cjk")
    assert.equal(faceClassForReflow("바탕"), "font:바탕") // 한컴 저장본 역추정 폭표
    assert.equal(faceClassForReflow("명조"), "fixedPitch") // 옛 HFT 기본 글꼴은 고정폭
    assert.equal(faceClassForReflow("고딕"), "fixedPitch")
    assert.equal(faceClassForReflow("함초롬바탕"), "hcr")
    assert.equal(faceClassForReflow("HCR Batang"), "hcr") // 영문 이름도 같은 글꼴
    assert.equal(faceClassForReflow("Haansoft Batang"), "font:한컴바탕")
    assert.equal(faceClassForReflow("Haansoft Dotum"), "font:한컴돋움")
    assert.equal(faceClassForReflow("돋움체"), "fixedPitch")
    assert.equal(faceClassForReflow("KoPub바탕체 Light"), "font:KoPub바탕체 Light")
    assert.equal(hancomCharWidth("가", 1000, 100, 0, "cjk"), 1000)
    assert.equal(hancomCharWidth("A", 1000, 100, 0, "cjk"), hancomCharWidth("A", 1000, 100, 0, "hcr"))
  })

  it("반각 형태(｢ ｣ ･)는 표에 따로 없으면 반각, 옛한글 조합 자모는 한 글자 폭", () => {
    for (const fc of ["cjk", "fixedPitch", "hcr", "font:HY견고딕"] as const) assert.equal(hancomCharWidth("｢", 1000, 100, 0, fc), 500, fc)
    // ᄒ+ᆞ+ᆫ 세 자모가 한 글자 — 41자 폭(41000)에 꼭 차고 넘치지 않는다
    const old = "ᄒᆞᆫ"
    assert.deepEqual(reflowed(`<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>${old.repeat(42)}</hp:t></hp:run></hp:p>`)[0].map(s => s[0]), [0])
  })
  it("KoPub 실측 폭표 — 굵기끼리 같은 표", () => {
    const ga = "가".codePointAt(0)!
    for (const w of ["Light", "Medium", "Bold"]) {
      assert.equal(fontAdvanceEm1000(`KoPub바탕체 ${w}`, ga), 936)
      assert.equal(fontAdvanceEm1000(`KoPub돋움체 ${w}`, ga), 872)
    }
    assert.equal(fontAdvanceEm1000("KoPubWorld돋움체_Pro Light", ga), 872)
  })

  it("실측 폭표 없는 주요 글꼴은 한컴 저장본 역추정 폭표", () => {
    const ga = "가".codePointAt(0)!
    for (const f of ["바탕", "한양신명조", "한컴바탕", "돋움"]) assert.ok(fontAdvanceEm1000(f, ga) !== null, f)
  })

  it("공백 최소값만큼 줄에 더 들어간다", () => {
    const text = "가가 가가 가가"
    const widths = [...text].map(c => (c === " " ? 50 : 100)) // 700
    assert.deepEqual(simulateWrap(text, 680, 680, 1000, 100, "keep", { widths }).starts, [0, 6])
    assert.deepEqual(simulateWrap(text, 680, 680, 1000, 100, "keep", { widths, condensePct: 50 }).starts, [0]) // 680 + 100·50% ≥ 700
    assert.deepEqual(simulateWrap(text, 680, 680, 1000, 100, "keep", { widths, condensePct: 10 }).starts, [0, 6]) // 680 + 10 < 700
    // 공백 최소값은 자간 전 공백 폭으로 잰다 — 공백 50(자간 −10 → 40) 둘: 662 + 100·20% = 682 ≥ 680(마지막 글자 자간 뺀 줄 폭), 자간 뒤로 재면 662 + 16 < 680
    const sp = [...text].map(c => (c === " " ? -10 : 0)), w2 = [...text].map(c => (c === " " ? 40 : 100))
    assert.deepEqual(simulateWrap(text, 662, 662, 1000, 100, "keep", { widths: w2, spacings: sp, condensePct: 20, kinsoku: "hancom" }).starts, [0])
  })

  it("한컴 금칙 — 닫는 작은따옴표는 줄머리에 오지 않는다", () => {
    const text = "가가가’"
    const widths = [100, 100, 100, 100]
    assert.deepEqual(simulateWrap(text, 300, 300, 1000, 100, "charAll", { widths }).starts, [0, 3])
    assert.deepEqual(simulateWrap(text, 300, 300, 1000, 100, "charAll", { widths, kinsoku: "hancom" }).starts, [0, 2])
  })
})

import { simulateWrap as wrap } from "../src/hwpx/text-metrics.js"
import { reflowSection } from "../src/render/reflow.js"
import { parseRenderStyles } from "../src/render/head-styles.js"
import { createXmlParser } from "../src/hwpx/parser-shared.js"

const NS = 'xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"'
const HEAD = `<hh:head ${NS}><hh:refList><hh:fontfaces><hh:fontface lang="HANGUL"><hh:font id="0" face="바탕"/></hh:fontface><hh:fontface lang="LATIN"><hh:font id="0" face="바탕"/></hh:fontface></hh:fontfaces>
<hh:charProperties><hh:charPr id="0" height="1000"><hh:fontRef hangul="0" latin="0"/></hh:charPr><hh:charPr id="1" height="1000"><hh:fontRef hangul="0" latin="0"/><hh:supscript/></hh:charPr></hh:charProperties>
<hh:paraProperties><hh:paraPr id="0"><hh:align horizontal="LEFT"/><hh:breakSetting breakNonLatinWord="KEEP_WORD"/></hh:paraPr></hh:paraProperties></hh:refList></hh:head>`
/** 구역 XML 을 reflow 해 문단마다 lineseg [textpos, horzsize, horzpos] 목록을 돌려준다 */
function reflowed(body: string, bodyW = 42000, head = HEAD): number[][][] {
  const doc = createXmlParser().parseFromString(`<hs:sec ${NS}>${body}</hs:sec>`, "text/xml")
  const root = doc.documentElement as unknown as Element
  reflowSection(root, parseRenderStyles(head), { BODY_W: bodyW, BODY_H: 80000 })
  return Array.from(root.getElementsByTagName("hp:p") as unknown as Element[]).map(p => {
    const lsa = Array.from(p.childNodes as unknown as Element[]).find(c => c.nodeName === "hp:linesegarray")
    return lsa ? Array.from(lsa.getElementsByTagName("hp:lineseg") as unknown as Element[]).map(s => [Number(s.getAttribute("textpos")), Number(s.getAttribute("horzsize")), Number(s.getAttribute("horzpos"))]) : []
  })
}
const tbl = (w: number) => `<hp:tbl rowCnt="1" colCnt="1"><hp:sz width="${w}" height="2000"/><hp:pos treatAsChar="1"/><hp:outMargin left="283" right="283" top="283" bottom="283"/><hp:tr><hp:tc><hp:subList><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>칸</hp:t></hp:run></hp:p></hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSz width="${w}" height="2000"/></hp:tc></hp:tr></hp:tbl>`

describe("reflow 한컴 조판 규칙 — 개체·컨트롤·다단·하위 목록", () => {
  it("본문 폭 인라인 표 둘은 한 줄에 하나씩 — 표는 그 폭의 글자다", () => {
    const [p] = reflowed(`<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0">${tbl(41700)}${tbl(41700)}<hp:t/></hp:run></hp:p>`)
    assert.deepEqual(p.map(s => s[0]), [0, 8])
  })
  it("쪽 번호 컨트롤 뒤 넓은 표는 다음 줄 — 구역·단 정의가 아닌 컨트롤은 줄의 내용", () => {
    const body = `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:secPr/><hp:ctrl><hp:colPr colCount="1"/></hp:ctrl></hp:run><hp:run charPrIDRef="0"><hp:ctrl><hp:pageNum/></hp:ctrl>${tbl(41700)}<hp:t/></hp:run></hp:p>`
    assert.deepEqual(reflowed(body)[0].map(s => s[0]), [0, 24])
  })
  it("2단 구역은 단 폭으로 채운다", () => {
    const body = `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:ctrl><hp:colPr colCount="2" sameSz="1" sameGap="2000"/></hp:ctrl><hp:t>${"가".repeat(30)}</hp:t></hp:run></hp:p>`
    const [p] = reflowed(body)
    assert.equal(p[0][1], 20000) // (42000 − 2000) ÷ 2
    assert.deepEqual(p.map(s => s[0]), [0, 28]) // 컨트롤 8칸 + 20자(1000 씩)
  })
  it("미주 안 문단도 줄 정보를 만든다", () => {
    const body = `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:ctrl><hp:endNote><hp:subList><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>${"가".repeat(50)}</hp:t></hp:run></hp:p></hp:subList></hp:endNote></hp:ctrl><hp:t>본문</hp:t></hp:run></hp:p>`
    const ps = reflowed(body)
    assert.deepEqual(ps[1].map(s => s[0]), [0, 42])
  })
  it("강제 줄바꿈(lineBreak) 뒤는 새 줄 — 줄바꿈은 앞 줄 끝 한 칸", () => {
    const body = `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>가나다<hp:lineBreak/>라마<hp:lineBreak/><hp:lineBreak/>바</hp:t></hp:run></hp:p>`
    assert.deepEqual(reflowed(body)[0].map(s => s[0]), [0, 4, 7, 8])
  })
  it("글머리표 문단은 글머리표 폭 + 간격(글자 크기의 textOffset%)만큼 좁게 채운다 — autoIndent 면 둘째 줄부터도", () => {
    const head = HEAD.replace("</hh:paraProperties>", `<hh:paraPr id="1"><hh:align horizontal="LEFT"/><hh:heading type="BULLET" idRef="1" level="0"/><hh:breakSetting breakNonLatinWord="KEEP_WORD"/></hh:paraPr></hh:paraProperties>`)
      .replace("<hh:charProperties>", `<hh:bullets itemCnt="1"><hh:bullet id="1" char="가" useImage="0"><hh:paraHead level="0" autoIndent="1" textOffsetType="PERCENT" textOffset="50" charPrIDRef="4294967295"/></hh:bullet></hh:bullets><hh:charProperties>`)
    const para = (pp: number) => `<hp:p paraPrIDRef="${pp}"><hp:run charPrIDRef="0"><hp:t>${"가".repeat(90)}</hp:t></hp:run></hp:p>`
    assert.deepEqual(reflowed(para(0), 42000, head)[0].map(s => s[0]), [0, 42, 84])
    assert.deepEqual(reflowed(para(1), 42000, head)[0].map(s => s[0]), [0, 40, 80]) // 42000 − (1000 + 500) → 40자
    assert.deepEqual([...new Set(reflowed(para(1), 42000, head)[0].map(s => s[1]))], [42000]) // lineseg 폭은 그대로
  })
  it("미주는 구역 끝의 단 폭, 머리 번호(autoNum \"1)\")는 그 글 폭을 차지한다", () => {
    const note = (num: boolean) => `<hp:endNote><hp:subList><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0">${num ? `<hp:ctrl><hp:autoNum num="1" numType="ENDNOTE"><hp:autoNumFormat type="DIGIT" suffixChar=")"/></hp:autoNum></hp:ctrl>` : ""}<hp:t>${"가".repeat(20)}</hp:t></hp:run></hp:p></hp:subList></hp:endNote>`
    const body = (num: boolean) => `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:ctrl><hp:colPr colCount="1"/></hp:ctrl><hp:ctrl>${note(num)}</hp:ctrl><hp:t>본문</hp:t></hp:run></hp:p>` +
      `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:ctrl><hp:colPr colCount="2" sameSz="1" sameGap="2000"/></hp:ctrl><hp:t>둘째 단</hp:t></hp:run></hp:p>`
    const plain = reflowed(body(false))[1], numbered = reflowed(body(true))[1]
    assert.deepEqual(plain.map(s => s[1]), [20000]) // (42000 − 2000) ÷ 2 — 미주가 걸린 1단 폭(42000)이 아니다
    assert.deepEqual(plain.map(s => s[0]), [0]) // 20자 × 1000 = 20000 에 꼭 찬다
    assert.equal(numbered.length, 2) // "1)" 몫만큼 넘친다
  })
  it("글꼴에 없는 가운뎃점(‧ ․)은 한컴바탕 대체 폭으로 잰다", () => {
    for (const fc of ["cjk", "fixedPitch", "font:한컴 윤고딕 240"] as const) assert.equal(hancomCharWidth("‧", 1000, 100, 0, fc), 172, fc) // 4·MulDiv(173, 250, 1000)
    assert.equal(hancomCharWidth("‧", 1000, 100, 0, "font:휴먼명조"), 420) // 그 글자를 가진 글꼴은 제 폭
  })
  it("굵은 글꼴이 없는 옛 HFT 글꼴의 진하게는 글자마다 폭을 넓힌다", () => {
    assert.equal(hancomCharWidth("가", 1000, 100, 0, "font:한양신명조", syntheticBoldEm("한양신명조")), 1048) // 4·MulDiv(1046, 250, 1000)
    assert.equal(syntheticBoldEm("휴먼명조"), 0) // 굵은 글꼴이 있는 글꼴은 그대로
    assert.equal(syntheticBoldEm("휴먼명조", true), 46) // HFT 휴먼명조는 굵은 글꼴이 없다
    const hftHead = HEAD.replace('<hh:font id="0" face="바탕"/></hh:fontface><hh:fontface lang="LATIN">', '<hh:font id="0" face="바탕"/><hh:font id="1" face="휴먼명조" type="HFT"/><hh:font id="2" face="휴먼명조" type="TTF"/></hh:fontface><hh:fontface lang="LATIN">')
      .replace("</hh:charProperties>", `<hh:charPr id="5" height="1000"><hh:fontRef hangul="1" latin="0"/><hh:bold/></hh:charPr><hh:charPr id="6" height="1000"><hh:fontRef hangul="2" latin="0"/><hh:bold/></hh:charPr></hh:charProperties>`)
    const boldLines = (cpr: number) => reflowed(`<hp:p paraPrIDRef="0"><hp:run charPrIDRef="${cpr}"><hp:t>${"가".repeat(41)}</hp:t></hp:run></hp:p>`, 42000, hftHead)[0].length
    assert.equal(boldLines(5), 2) // HFT 항목 휴먼명조 진하게: 41 × 1048 > 42000
    assert.equal(boldLines(6), 1) // TTF 항목은 그대로 41 × 1000
    assert.equal(syntheticBoldEm("바탕"), 0)
    const head = HEAD.replace('<hh:font id="0" face="바탕"/></hh:fontface><hh:fontface lang="LATIN">', '<hh:font id="0" face="바탕"/><hh:font id="1" face="한양신명조"/></hh:fontface><hh:fontface lang="LATIN">')
      .replace("</hh:charProperties>", `<hh:charPr id="2" height="1000"><hh:fontRef hangul="1" latin="0"/><hh:bold/></hh:charPr><hh:charPr id="3" height="1000"><hh:fontRef hangul="1" latin="0"/></hh:charPr></hh:charProperties>`)
    const lines = (cpr: number) => reflowed(`<hp:p paraPrIDRef="0"><hp:run charPrIDRef="${cpr}"><hp:t>${"가".repeat(41)}</hp:t></hp:run></hp:p>`, 42000, head)[0].length
    assert.equal(lines(3), 1) // 41 × 1000
    assert.equal(lines(2), 2) // 41 × 1048 > 42000
  })
  it("어울림 개체는 앵커 글자가 놓인 줄보다 위로 가지 않는다", () => {
    const pic = `<hp:pic textWrap="SQUARE" textFlow="LARGEST_ONLY"><hp:sz width="20000" height="3000"/><hp:pos treatAsChar="0" vertRelTo="PARA" vertOffset="0" horzRelTo="COLUMN" horzAlign="RIGHT" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/></hp:pic>`
    const segs = reflowed(`<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>${"가".repeat(90)}</hp:t>${pic}<hp:t>${"가".repeat(60)}</hp:t></hp:run></hp:p>`)[0]
    // 앵커(91번째 슬롯)는 셋째 줄 — 첫 두 줄은 온 폭(42000 = 42자), 셋째 줄부터 그림 옆 22000(22자). 종전엔 첫 줄부터 좁았다
    assert.deepEqual(segs.slice(0, 3).map(x => x[1]), [42000, 42000, 22000])
  })
  it("한 문단의 떠 있는 위아래 배치 표는 차례로 쌓이고, 둘 이상이면 빈 줄도 그 아래로 간다", () => {
    const tbl = (h: number, vo = 0) => `<hp:tbl textWrap="TOP_AND_BOTTOM" rowCnt="1" colCnt="1"><hp:sz width="10000" height="${h}"/><hp:pos treatAsChar="0" vertRelTo="PARA" vertOffset="${vo}"/><hp:outMargin left="0" right="0" top="100" bottom="100"/><hp:tr><hp:tc><hp:subList><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t/></hp:run></hp:p></hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="10000" height="${h}"/><hp:cellMargin left="0" right="0" top="0" bottom="0"/></hp:tc></hp:tr></hp:tbl>`
    const firstV = (objs: string, text: string) => {
      const doc = createXmlParser().parseFromString(`<hs:sec ${NS}><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0">${objs}<hp:t>${text}</hp:t></hp:run></hp:p></hs:sec>`, "text/xml")
      const root = doc.documentElement as unknown as Element
      reflowSection(root, parseRenderStyles(HEAD), { BODY_W: 42000, BODY_H: 80000 })
      const segs = Array.from(root.getElementsByTagName("hp:lineseg") as unknown as Element[])
      return Number(segs[segs.length - 1].getAttribute("vertpos"))
    }
    assert.equal(firstV(tbl(1000) + tbl(2000), "가"), 3400) // (100 + 1000 + 100) + (100 + 2000 + 100) — 종전엔 큰 쪽 하나(2200)
    assert.equal(firstV(tbl(1000) + tbl(2000, 4294960072), "가"), 3400) // vertOffset −7224(부호 없는 32비트 저장)는 앞 표 바닥에서 멈춘다
    assert.equal(firstV(tbl(1000) + tbl(2000), ""), 3400) // 둘 이상이면 빈 줄도 그 아래
    assert.equal(firstV(tbl(1000), ""), 0) // 하나면 빈 줄은 제자리
    assert.equal(firstV(tbl(1000), "   "), 0) // 공백뿐인 글도 빈 줄 — 종전엔 1200 아래로 밀었다
  })
  it("위아래 배치 개체는 문단 위 간격 앞에 놓이고, 글은 위 간격과 개체 바닥 중 아래에서 시작한다", () => {
    const head = HEAD.replace("</hh:paraProperties>", `<hh:paraPr id="3"><hh:align horizontal="LEFT"/><hp:switch><hp:case hp:required-namespace="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar"><hh:margin><hc:prev value="1000" unit="HWPUNIT"/></hh:margin></hp:case></hp:switch></hh:paraPr></hh:paraProperties>`)
    const tbl = `<hp:tbl textWrap="TOP_AND_BOTTOM" rowCnt="1" colCnt="1"><hp:sz width="10000" height="5000"/><hp:pos treatAsChar="0" vertRelTo="PARA" vertOffset="0"/><hp:outMargin left="0" right="0" top="100" bottom="100"/><hp:tr><hp:tc><hp:subList><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t/></hp:run></hp:p></hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="10000" height="5000"/><hp:cellMargin left="0" right="0" top="0" bottom="0"/></hp:tc></hp:tr></hp:tbl>`
    const vps = (body: string) => {
      const doc = createXmlParser().parseFromString(`<hs:sec ${NS}>${body}</hs:sec>`, "text/xml")
      const root = doc.documentElement as unknown as Element
      reflowSection(root, parseRenderStyles(head), { BODY_W: 42000, BODY_H: 80000 })
      return Array.from(root.childNodes as unknown as Element[]).filter(c => c.nodeName === "hp:p").map(p => Number((p.getElementsByTagName("hp:lineseg")[p.getElementsByTagName("hp:lineseg").length - 1] as unknown as Element).getAttribute("vertpos")))
    }
    const lead = `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>앞</hp:t></hp:run></hp:p>`
    // 앞 문단 바닥 1600 + 위 간격 1000 = 2600, 표는 1600 에 놓여 바닥 6800 → 글은 6800(종전엔 2600 + 5200 = 7800)
    assert.deepEqual(vps(lead + `<hp:p paraPrIDRef="3"><hp:run charPrIDRef="0">${tbl}<hp:t>글</hp:t></hp:run></hp:p>`), [0, 6800])
    // 글 없는 문단의 표 바닥 6800 이 다음 문단(위 간격 1000)의 첫 줄 — 빈 줄 바닥 4200 + 1000 보다 아래, 표 바닥에 위 간격을 더하지 않는다(종전 7800 + 1000)
    assert.deepEqual(vps(lead + `<hp:p paraPrIDRef="3"><hp:run charPrIDRef="0">${tbl}<hp:t/></hp:run></hp:p><hp:p paraPrIDRef="3"><hp:run charPrIDRef="0"><hp:t>다음</hp:t></hp:run></hp:p>`).slice(2), [6800])
  })
  it("글꼴에 어울리는 줄 높이는 글꼴의 위·아래 높이로 줄 높이·기준선을 정한다", () => {
    const head = HEAD.replace('<hh:font id="0" face="바탕"/></hh:fontface><hh:fontface lang="LATIN">', '<hh:font id="0" face="바탕"/><hh:font id="1" face="맑은 고딕"/></hh:fontface><hh:fontface lang="LATIN">')
      .replace('<hh:font id="0" face="바탕"/></hh:fontface></hh:fontfaces>', '<hh:font id="0" face="바탕"/><hh:font id="1" face="맑은 고딕"/></hh:fontface></hh:fontfaces>')
      .replace("</hh:charProperties>", `<hh:charPr id="2" height="1200"><hh:fontRef hangul="1" latin="1"/></hh:charPr></hh:charProperties>`)
      .replace("</hh:paraProperties>", `<hh:paraPr id="1" fontLineHeight="1"><hh:align horizontal="LEFT"/><hh:lineSpacing type="PERCENT" value="100"/></hh:paraPr></hh:paraProperties>`)
    const seg = (cpr: number, text: string) => {
      const doc = createXmlParser().parseFromString(`<hs:sec ${NS}><hp:p paraPrIDRef="1"><hp:run charPrIDRef="${cpr}"><hp:t>${text}</hp:t></hp:run></hp:p></hs:sec>`, "text/xml")
      const root = doc.documentElement as unknown as Element
      reflowSection(root, parseRenderStyles(head), { BODY_W: 42000, BODY_H: 80000 })
      return ["vertsize", "baseline"].map(a => Number((root.getElementsByTagName("hp:lineseg")[0] as unknown as Element).getAttribute(a)))
    }
    assert.deepEqual(seg(2, "가나"), [1598, 1307]) // 맑은 고딕 1200: 1200 × (2230 + 497) / 2048, 1200 × 2230 / 2048
    assert.deepEqual(seg(0, "가나"), [1000, 858]) // 바탕 1000: 높이 그대로, 기준선 1758/2048
    assert.deepEqual(seg(0, ""), [1000, 850]) // 글 없는 줄은 종전대로
  })
  it("쪽 아래 각주 영역은 본문 바닥을 올린다", () => {
    const fn = `<hp:ctrl><hp:footNote number="1"><hp:subList><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>주</hp:t></hp:run></hp:p></hp:subList></hp:footNote></hp:ctrl>`
    const sixth = (withNote: boolean) => {
      const paras = Array.from({ length: 7 }, (_, i) => `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>줄${i}</hp:t>${i === 0 && withNote ? fn : ""}</hp:run></hp:p>`).join("")
      const doc = createXmlParser().parseFromString(`<hs:sec ${NS}>${paras}</hs:sec>`, "text/xml")
      const root = doc.documentElement as unknown as Element
      reflowSection(root, parseRenderStyles(HEAD), { BODY_W: 42000, BODY_H: 10000 })
      const ps = Array.from(root.childNodes as unknown as Element[]).filter(c => c.nodeName === "hp:p")
      return Number((ps[5].getElementsByTagName("hp:lineseg")[0] as unknown as Element).getAttribute("vertpos"))
    }
    assert.equal(sixth(false), 8000) // 8000 + 1000 ≤ 10000
    assert.equal(sixth(true), 0) // 각주 영역 850 + 567 + 1000 → 바닥 7583, 9000 에 닿는 여섯째 줄은 다음 쪽
  })
  it("단 밖으로 나간 위아래 배치 개체는 글을 밀지 않는다", () => {
    const pic = (ho: number) => `<hp:pic textWrap="TOP_AND_BOTTOM"><hp:sz width="10000" height="20000"/><hp:pos treatAsChar="0" vertRelTo="PARA" vertOffset="0" horzRelTo="COLUMN" horzAlign="CENTER" horzOffset="${ho}"/><hp:outMargin left="0" right="0" top="0" bottom="0"/></hp:pic>`
    const nextV = (ho: number) => {
      const doc = createXmlParser().parseFromString(`<hs:sec ${NS}><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0">${pic(ho)}<hp:t/></hp:run></hp:p><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>다음</hp:t></hp:run></hp:p></hs:sec>`, "text/xml")
      const root = doc.documentElement as unknown as Element
      reflowSection(root, parseRenderStyles(HEAD), { BODY_W: 42000, BODY_H: 80000 })
      return Number((root.getElementsByTagName("hp:lineseg")[1] as unknown as Element).getAttribute("vertpos"))
    }
    assert.equal(nextV(0), 20000) // 단 안 그림은 다음 문단을 민다
    assert.equal(nextV(30000), 1600) // 왼쪽 끝 16000 + 30000 > 단 폭 42000 — 빈 줄 다음에 바로
  })
  it("단 나누기(columnBreak) 문단은 새 단 맨 위에서 시작한다", () => {
    const doc = createXmlParser().parseFromString(`<hs:sec ${NS}><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>첫 단</hp:t></hp:run></hp:p><hp:p paraPrIDRef="0" columnBreak="1"><hp:run charPrIDRef="0"><hp:t>둘째 단</hp:t></hp:run></hp:p></hs:sec>`, "text/xml")
    const root = doc.documentElement as unknown as Element
    reflowSection(root, parseRenderStyles(HEAD), { BODY_W: 42000, BODY_H: 80000 })
    assert.deepEqual(Array.from(root.getElementsByTagName("hp:lineseg") as unknown as Element[]).map(s => Number(s.getAttribute("vertpos"))), [0, 0]) // 종전엔 1600
  })
  it("쪽 바닥을 넘는 떠 있는 표(행 단위 나눔)는 넘치는 행부터 다음 쪽으로 — 다음 문단은 남은 행 아래", () => {
    const row = (i: number) => `<hp:tr><hp:tc><hp:subList><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t/></hp:run></hp:p></hp:subList><hp:cellAddr colAddr="0" rowAddr="${i}"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="10000" height="1000"/><hp:cellMargin left="0" right="0" top="0" bottom="0"/></hp:tc></hp:tr>`
    const tbl = (pb: string) => `<hp:tbl textWrap="TOP_AND_BOTTOM" pageBreak="${pb}" rowCnt="10" colCnt="1"><hp:sz width="10000" height="10000"/><hp:pos treatAsChar="0" vertRelTo="PARA" vertOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="141"/>${Array.from({ length: 10 }, (_, i) => row(i)).join("")}</hp:tbl>`
    const nextV = (pb: string) => {
      const doc = createXmlParser().parseFromString(`<hs:sec ${NS}><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0">${tbl(pb)}<hp:t/></hp:run></hp:p><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>다음</hp:t></hp:run></hp:p></hs:sec>`, "text/xml")
      const root = doc.documentElement as unknown as Element
      reflowSection(root, parseRenderStyles(HEAD), { BODY_W: 42000, BODY_H: 7000 })
      const ps = Array.from(root.childNodes as unknown as Element[]).filter(c => c.nodeName === "hp:p")
      return Number((ps[1].getElementsByTagName("hp:lineseg")[0] as unknown as Element).getAttribute("vertpos"))
    }
    assert.equal(nextV("TABLE"), 4141) // 1쪽 6행(6000 + 141 ≤ 7000, 7행이면 넘침), 2쪽 4행 4000 + outMargin 아래 141
    assert.equal(nextV("NONE"), 0) // 나누지 않는 표는 종전대로 — 다음 문단이 새 쪽 맨 위
  })
  it("칸 subList lineWrap=SQUEEZE 면 칸 글은 줄을 바꾸지 않는다(명시적 줄 나눔만)", () => {
    const cell = (wrap: string, inner: string) => `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:tbl rowCnt="1" colCnt="1"><hp:sz width="5000" height="1000"/><hp:pos treatAsChar="1"/><hp:tr><hp:tc><hp:subList lineWrap="${wrap}">${inner}</hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="5000" height="1000"/><hp:cellMargin left="0" right="0" top="0" bottom="0"/></hp:tc></hp:tr></hp:tbl><hp:t/></hp:run></hp:p>`
    const lines = (wrap: string, t: string) => {
      const doc = createXmlParser().parseFromString(`<hs:sec ${NS}>${cell(wrap, `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>${t}</hp:t></hp:run></hp:p>`)}</hs:sec>`, "text/xml")
      const root = doc.documentElement as unknown as Element
      reflowSection(root, parseRenderStyles(HEAD), { BODY_W: 42000, BODY_H: 80000 })
      return root.getElementsByTagName("hp:subList")[0].getElementsByTagName("hp:lineseg").length
    }
    assert.equal(lines("BREAK", "가".repeat(12)), 3) // 칸 폭 5000 에 1000 짜리 12자 — 세 줄
    assert.equal(lines("SQUEEZE", "가".repeat(12)), 1)
    assert.equal(lines("SQUEEZE", "가가<hp:lineBreak/>가가"), 2)
  })
  it("첫 빈 줄 감추기면 새 쪽 맨 위에 올 빈 문단은 앞 쪽 바닥 아래에 남고, 새 쪽은 다음 글부터", () => {
    const vps = (hide: string) => {
      const filled = Array.from({ length: 4 }, () => `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>가</hp:t></hp:run></hp:p>`).join("")
      const empty = `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t> </hp:t></hp:run></hp:p>`
      const sec = `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:secPr><hp:visibility hideFirstEmptyLine="${hide}"/></hp:secPr><hp:t>가</hp:t></hp:run></hp:p>`
      const doc = createXmlParser().parseFromString(`<hs:sec ${NS}>${sec}${filled}${empty}${empty}<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>다음</hp:t></hp:run></hp:p></hs:sec>`, "text/xml")
      const root = doc.documentElement as unknown as Element
      reflowSection(root, parseRenderStyles(HEAD), { BODY_W: 42000, BODY_H: 8500 })
      return Array.from(root.getElementsByTagName("hp:lineseg") as unknown as Element[]).map(s => Number(s.getAttribute("vertpos")))
    }
    // 줄 1000·간격 600: 다섯 줄 0~6400, 빈 문단 8000(8000 + 1000 > 8500) 부터 넘친다
    // 빈 문단 둘은 앞 쪽 바닥 아래에 높이 없이 겹치고(한컴 저장본 56197·56197), "다음" 이 새 쪽 맨 위
    assert.deepEqual(vps("1").slice(5), [8000, 8000, 0])
    assert.deepEqual(vps("0").slice(5), [0, 1600, 3200]) // 감추지 않으면 빈 문단부터 새 쪽
  })
  it("쪽보다 높은 줄은 제자리에 두되, 쪽 바닥 아래에서 시작하면 새 쪽 맨 위로", () => {
    const tall = `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:tbl textWrap="TOP_AND_BOTTOM" pageBreak="CELL" rowCnt="1" colCnt="1"><hp:sz width="10000" height="9000"/><hp:pos treatAsChar="1" vertRelTo="PARA" vertOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:tr><hp:tc><hp:subList><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>가</hp:t></hp:run></hp:p></hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="10000" height="9000"/><hp:cellMargin left="0" right="0" top="0" bottom="0"/></hp:tc></hp:tr></hp:tbl><hp:t/></hp:run></hp:p>`
    const doc = createXmlParser().parseFromString(`<hs:sec ${NS}>${tall}${tall}</hs:sec>`, "text/xml")
    const root = doc.documentElement as unknown as Element
    reflowSection(root, parseRenderStyles(HEAD), { BODY_W: 42000, BODY_H: 8500 })
    const ps = Array.from(root.childNodes as unknown as Element[]).filter(c => c.nodeName === "hp:p")
    const v = (p: Element) => Number((Array.from(p.childNodes as unknown as Element[]).find(c => c.nodeName === "hp:linesegarray")!.getElementsByTagName("hp:lineseg")[0] as unknown as Element).getAttribute("vertpos"))
    assert.deepEqual(ps.map(v), [0, 0]) // 첫 표(9000 > 8500)는 0 에, 둘째는 첫 표 아래(쪽 바닥 밑)에서 시작하므로 새 쪽 0
  })
  it("칸 안 나눔(CELL) 떠 있는 표는 행을 칸 줄 경계에서 갈라 남은 줄을 다음 쪽 맨 위에 — 다음 문단은 그 아래", () => {
    // 한 칸에 한 줄 문단 10개(줄 1000, 간격 600 → 줄 위 0·1600·…·14400), 칸 여백 141 — 행 15400 + 282
    const paras = Array.from({ length: 10 }, () => `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>가</hp:t></hp:run></hp:p>`).join("")
    const tbl = `<hp:tbl textWrap="TOP_AND_BOTTOM" pageBreak="CELL" rowCnt="1" colCnt="1"><hp:sz width="10000" height="1000"/><hp:pos treatAsChar="0" vertRelTo="PARA" vertOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="141"/><hp:tr><hp:tc><hp:subList>${paras}</hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="10000" height="1000"/><hp:cellMargin left="0" right="0" top="141" bottom="141"/></hp:tc></hp:tr></hp:tbl>`
    const doc = createXmlParser().parseFromString(`<hs:sec ${NS}><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0">${tbl}<hp:t/></hp:run></hp:p><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>다음</hp:t></hp:run></hp:p></hs:sec>`, "text/xml")
    const root = doc.documentElement as unknown as Element
    reflowSection(root, parseRenderStyles(HEAD), { BODY_W: 42000, BODY_H: 7000 })
    const ps = Array.from(root.childNodes as unknown as Element[]).filter(c => c.nodeName === "hp:p")
    // 1쪽: 141 + 줄 바닥 ≤ 7000 − 141 − 141 인 줄 4개(바닥 5800). 2쪽: 6400 부터 4줄(바닥 12200), 3쪽: 12800 부터 2줄 → 15400 − 12800 + 282 + 141
    assert.equal(Number((ps[1].getElementsByTagName("hp:lineseg")[0] as unknown as Element).getAttribute("vertpos")), 3023)
  })
  it("글자처럼 취급하는 수식은 outMargin 좌우까지 폭으로 친다", () => {
    const eq = (om: number) => `<hp:equation baseLine="85"><hp:sz width="900" height="1000"/><hp:pos treatAsChar="1"/><hp:outMargin left="${om}" right="${om}" top="0" bottom="0"/><hp:script>x</hp:script></hp:equation>`
    const lines = (om: number) => reflowed(`<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>${"가".repeat(41)}</hp:t>${eq(om)}</hp:run></hp:p>`)[0].length
    assert.equal(lines(0), 1) // 41000 + 900 ≤ 42000
    assert.equal(lines(56), 2) // 41000 + 56 + 900 + 56 > 42000 — 종전엔 표만 outMargin 을 셌다
  })
  it("각주·미주 본문 참조 번호는 위첨자 크기로 그 글 폭을 차지한다", () => {
    const fn = `<hp:ctrl><hp:footNote number="1"><hp:subList><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>주</hp:t></hp:run></hp:p></hp:subList></hp:footNote></hp:ctrl>`
    const body = (tail: string) => reflowed(`<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>${"가".repeat(41)}</hp:t>${fn}<hp:t>${tail}</hp:t></hp:run></hp:p>`)[0].length
    assert.equal(body("가"), 2) // 41000 + "1)" 몫 + 1000 > 42000 — 종전엔 번호 폭 0 이라 한 줄
    assert.equal(body(")"), 1) // 위첨자 "1)"(556) + ")"(320) 은 남은 1000 에 든다 — 본래 크기(872)면 넘친다
  })
  it("줄 간격 몫은 4 단위로 0에서 먼 쪽 반올림 — 100% 미만이면 음수로 겹쳐 올라온다", () => {
    const head = HEAD.replace("</hh:paraProperties>", `<hh:paraPr id="1"><hh:align horizontal="LEFT"/><hh:lineSpacing type="PERCENT" value="155"/></hh:paraPr><hh:paraPr id="2"><hh:align horizontal="LEFT"/><hh:lineSpacing type="PERCENT" value="90"/></hh:paraPr></hh:paraProperties>`)
      .replace(`<hh:charPr id="1" height="1000">`, `<hh:charPr id="2" height="1400"><hh:fontRef hangul="0" latin="0"/></hh:charPr><hh:charPr id="3" height="1500"><hh:fontRef hangul="0" latin="0"/></hh:charPr><hh:charPr id="4" height="1250"><hh:fontRef hangul="0" latin="0"/></hh:charPr><hh:charPr id="1" height="1000">`)
    const vert = (pp: number, cpr: number) => {
      const doc = createXmlParser().parseFromString(`<hs:sec ${NS}><hp:p paraPrIDRef="${pp}"><hp:run charPrIDRef="${cpr}"><hp:t>${"가".repeat(60)}</hp:t></hp:run></hp:p><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>다음</hp:t></hp:run></hp:p></hs:sec>`, "text/xml")
      const root = doc.documentElement as unknown as Element
      reflowSection(root, parseRenderStyles(head), { BODY_W: 42000, BODY_H: 80000 })
      return Array.from(root.getElementsByTagName("hp:lineseg") as unknown as Element[]).map(s => [Number(s.getAttribute("vertpos")), Number(s.getAttribute("spacing"))])
    }
    assert.deepEqual(vert(1, 2).slice(0, 2), [[0, 772], [2172, 772]]) // 1400 × 55% = 770 → 772
    assert.equal(vert(0, 4)[0][1], 748) // ⌊1250/4⌋ = 312 × 60% = 187.2 → 4 × 187 — 1250 × 60% = 750 이 아니다
    const v90 = vert(2, 3)
    assert.deepEqual(v90[0], [0, -152]) // 1500 × −10% = −150 → −152
    assert.equal(v90[v90.length - 1][0], v90[v90.length - 2][0] + 1500 - 152) // 다음 문단도 음수 몫만큼 올라온다
  })
  it("줄 높이·기준선은 그 줄의 가장 큰 글자·개체로 — 수식은 baseLine%, 세로 가운데 정렬은 줄 가운데, 아래 정렬은 줄 바닥", () => {
    const head = HEAD.replace("</hh:paraProperties>", `<hh:paraPr id="1"><hh:align horizontal="LEFT" vertical="CENTER"/></hh:paraPr><hh:paraPr id="2"><hh:align horizontal="LEFT" vertical="BOTTOM"/></hh:paraPr></hh:paraProperties>`)
      .replace(`<hh:charPr id="1" height="1000">`, `<hh:charPr id="2" height="1500"><hh:fontRef hangul="0" latin="0"/></hh:charPr><hh:charPr id="1" height="1000">`)
    const segs = (body: string) => {
      const doc = createXmlParser().parseFromString(`<hs:sec ${NS}>${body}</hs:sec>`, "text/xml")
      const root = doc.documentElement as unknown as Element
      reflowSection(root, parseRenderStyles(head), { BODY_W: 42000, BODY_H: 80000 })
      return Array.from(root.getElementsByTagName("hp:lineseg") as unknown as Element[]).map(s => ["vertsize", "baseline", "spacing"].map(a => Number(s.getAttribute(a))))
    }
    // 글자 1000 run + 문단 끝 빈 1500 run → 줄 높이 1500, 간격 몫도 1500 기준(160% → 900)
    assert.deepEqual(segs(`<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>가나</hp:t></hp:run><hp:run charPrIDRef="2"><hp:t/></hp:run></hp:p>`), [[1500, 1275, 900]])
    const eq = (h: number, bl: number) => `<hp:equation baseLine="${bl}"><hp:sz width="1000" height="${h}"/><hp:pos treatAsChar="1"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:script>x</hp:script></hp:equation>`
    // 수식 1650@51·1050@88: 높이는 1650(합 아님), 기준선은 윗부분 최대 round(1050 × 0.88) = 924
    assert.deepEqual(segs(`<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0">${eq(1650, 51)}${eq(1050, 88)}<hp:t/></hp:run></hp:p>`)[0].slice(0, 2), [1650, 924])
    assert.deepEqual(segs(`<hp:p paraPrIDRef="1"><hp:run charPrIDRef="0"><hp:t>가나</hp:t></hp:run></hp:p>`)[0].slice(0, 2), [1000, 500]) // 세로 가운데
    assert.deepEqual(segs(`<hp:p paraPrIDRef="2"><hp:run charPrIDRef="0"><hp:t>가나</hp:t></hp:run></hp:p>`)[0].slice(0, 2), [1000, 1000]) // 세로 아래 — 줄 바닥
  })
  it("쪽 넘김은 줄 단위 — 넘친 줄부터 새 쪽 0, 문단째 넘길 땐 문단 위 간격을 남기고, 외톨이줄 보호면 첫 줄만 남기지 않는다", () => {
    const head = HEAD.replace("</hh:paraProperties>", `<hh:paraPr id="1"><hh:align horizontal="LEFT"/><hh:breakSetting breakNonLatinWord="KEEP_WORD" widowOrphan="1"/></hh:paraPr><hh:paraPr id="2"><hh:align horizontal="LEFT"/><hh:breakSetting breakNonLatinWord="KEEP_WORD"/><hp:switch><hp:case hp:required-namespace="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar"><hh:margin><hc:prev value="800"/></hh:margin></hp:case></hp:switch></hh:paraPr></hh:paraProperties>`)
    const vps = (body: string) => {
      const doc = createXmlParser().parseFromString(`<hs:sec ${NS}>${body}</hs:sec>`, "text/xml")
      const root = doc.documentElement as unknown as Element
      reflowSection(root, parseRenderStyles(head), { BODY_W: 42000, BODY_H: 10000 })
      return Array.from(root.getElementsByTagName("hp:p") as unknown as Element[]).map(p => Array.from(p.getElementsByTagName("hp:lineseg") as unknown as Element[]).map(s => Number(s.getAttribute("vertpos"))))
    }
    const para = (pp: number, n: number) => `<hp:p paraPrIDRef="${pp}"><hp:run charPrIDRef="0"><hp:t>${"가".repeat(42 * n)}</hp:t></hp:run></hp:p>`
    // 줄 pitch 1600: 앞 문단 5줄(0~6400) 뒤 3줄 문단 — 8000·9600(+1000 > 10000) → 9600 줄부터 새 쪽
    assert.deepEqual(vps(para(0, 5) + para(0, 3))[1], [8000, 0, 1600])
    assert.deepEqual(vps(para(0, 5) + para(1, 3))[1], [0, 1600, 3200]) // 외톨이줄 보호 — 첫 줄 하나만 남기지 않는다
    assert.deepEqual(vps(para(0, 6) + para(2, 1))[1], [800]) // 9600 + 800 넘침 → 새 쪽, 문단 위 간격 800 은 남는다
  })
  it("서울한강체는 PDF 실측 폭표 — 한글 글자마다 850~920, 숫자 540", async () => {
    const T = await import("../src/hwpx/text-metrics.js")
    const fc = T.faceClassForReflow("08서울한강체 L")
    assert.deepEqual(["가", "리", "1", "("].map(c => T.hancomCharWidth(c, 1000, 100, 0, fc)), [912, 852, 540, 336])
  })
  it("문단 번호 — 수준별로 문서 순서대로 세고, 머리 글 폭 + 간격만큼 좁게 채운다", async () => {
    const { nextParaNumber, formatHeadNumber } = await import("../src/render/para-number.js")
    const { DEFAULT_PARA_GEOM: DEFAULT_GEOM } = await import("../src/render/head-styles.js")
    assert.deepEqual([1, 2, 14, 15].map(n => formatHeadNumber(n, "HANGUL_SYLLABLE")), ["가", "나", "하", "가"])
    assert.equal(formatHeadNumber(3, "CIRCLED_DIGIT"), "③")
    assert.equal(formatHeadNumber(4, "ROMAN_CAPITAL"), "IV")
    const heads = new Map([[1, { text: "^1.", format: "DIGIT", start: 1 }], [2, { text: "^1.^2)", format: "HANGUL_SYLLABLE", start: 1 }]])
    const g = (level: number) => ({ ...DEFAULT_GEOM, number: { id: "1", level, heads, offset: 50, offsetPct: true, autoIndent: true } })
    const c = new Map()
    assert.deepEqual([g(1), g(2), g(2), g(1), g(2)].map(x => nextParaNumber(c, x)), ["1.", "1.가)", "1.나)", "2.", "2.가)"])
    // 수준 숫자 없는 ^ 는 찍지 않는다 — 머리 "^  □" 는 "  □"
    const lone = new Map([[1, { text: "^  □", format: "DIGIT", start: 1 }]])
    assert.equal(nextParaNumber(new Map(), { ...DEFAULT_GEOM, number: { id: "2", level: 1, heads: lone, offset: 50, offsetPct: true, autoIndent: true } }), "  □")
    const head = HEAD.replace("</hh:paraProperties>", `<hh:paraPr id="1"><hh:align horizontal="LEFT"/><hh:heading type="NUMBER" idRef="1" level="0"/><hh:breakSetting breakNonLatinWord="KEEP_WORD"/></hh:paraPr></hh:paraProperties>`)
      .replace("<hh:charProperties>", `<hh:numberings itemCnt="1"><hh:numbering id="1" start="0"><hh:paraHead start="1" level="1" autoIndent="1" textOffsetType="PERCENT" textOffset="50" numFormat="DIGIT" charPrIDRef="4294967295">가^1</hh:paraHead></hh:numbering></hh:numberings><hh:charProperties>`)
    // 머리 "가1" — 바탕 한글 1000 + 숫자 + 간격 500 → 첫 줄과 둘째 줄 모두 42자 미만
    const [p] = reflowed(`<hp:p paraPrIDRef="1"><hp:run charPrIDRef="0"><hp:t>${"가".repeat(90)}</hp:t></hp:run></hp:p>`, 42000, head)
    assert.ok(p[1][0] < 42 && p[2][0] - p[1][0] < 42, JSON.stringify(p.map(s => s[0])))
  })
  it("문단 보호·다음 문단과 함께·문단 앞 쪽 나눔", () => {
    const head = HEAD.replace("</hh:paraProperties>", `<hh:paraPr id="1"><hh:align horizontal="LEFT"/><hh:breakSetting breakNonLatinWord="KEEP_WORD" keepLines="1"/></hh:paraPr><hh:paraPr id="2"><hh:align horizontal="LEFT"/><hh:breakSetting breakNonLatinWord="KEEP_WORD" keepWithNext="1"/></hh:paraPr><hh:paraPr id="3"><hh:align horizontal="LEFT"/><hh:breakSetting breakNonLatinWord="KEEP_WORD" pageBreakBefore="1"/></hh:paraPr></hh:paraProperties>`)
    const vps = (body: string) => {
      const doc = createXmlParser().parseFromString(`<hs:sec ${NS}>${body}</hs:sec>`, "text/xml")
      const root = doc.documentElement as unknown as Element
      reflowSection(root, parseRenderStyles(head), { BODY_W: 42000, BODY_H: 10000 })
      return Array.from(root.getElementsByTagName("hp:p") as unknown as Element[]).map(p => Array.from(p.getElementsByTagName("hp:lineseg") as unknown as Element[]).map(s => Number(s.getAttribute("vertpos"))))
    }
    const para = (pp: number, n: number) => `<hp:p paraPrIDRef="${pp}"><hp:run charPrIDRef="0"><hp:t>${"가".repeat(42 * n)}</hp:t></hp:run></hp:p>`
    assert.deepEqual(vps(para(0, 5) + para(1, 3))[1], [0, 1600, 3200]) // 쪽에 걸칠 문단을 통째로
    assert.deepEqual(vps(para(0, 5) + para(2, 1) + para(0, 3)).slice(1), [[0], [1600, 3200, 4800]]) // 다음 문단 첫 줄이 넘치면 앞 문단도 함께 새 쪽
    assert.deepEqual(vps(para(0, 1) + para(3, 1))[1], [0])
  })
  it("떠 있는 위아래 개체 — 글 없는 문단은 줄이 제자리·개체가 다음 문단을 밀고, 쪽 아래에 붙은 개체는 그 쪽 바닥을 올린다", () => {
    const fl = (h: number, rel: string, align: string) => `<hp:tbl rowCnt="1" colCnt="1" textWrap="TOP_AND_BOTTOM"><hp:sz width="10000" height="${h}"/><hp:pos treatAsChar="0" vertRelTo="${rel}" vertAlign="${align}" vertOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:tr><hp:tc><hp:subList><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>칸</hp:t></hp:run></hp:p></hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSz width="10000" height="${h}"/></hp:tc></hp:tr></hp:tbl>`
    const vps = (body: string) => {
      const doc = createXmlParser().parseFromString(`<hs:sec ${NS}>${body}</hs:sec>`, "text/xml")
      const root = doc.documentElement as unknown as Element
      reflowSection(root, parseRenderStyles(HEAD), { BODY_W: 42000, BODY_H: 10000 })
      return Array.from(root.childNodes as unknown as Element[]).filter(c => c.nodeName === "hp:p").map(p => Array.from(p.getElementsByTagName("hp:lineseg") as unknown as Element[]).filter(sg => (sg.parentNode as Element).parentNode === p).map(sg => Number(sg.getAttribute("vertpos"))))
    }
    const text = (t: string) => `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>${t}</hp:t></hp:run></hp:p>`
    assert.deepEqual(vps(`<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0">${fl(3000, "PARA", "TOP")}<hp:t/></hp:run></hp:p>${text("다음")}`), [[0], [3000]])
    assert.deepEqual(vps(`<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0">${fl(3000, "PARA", "TOP")}<hp:t>글</hp:t></hp:run></hp:p>`), [[3000]])
    assert.deepEqual(vps(`<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0">${fl(3000, "PAGE", "TOP")}<hp:t>글</hp:t></hp:run></hp:p>`), [[3000]]) // 쪽 위에 붙은 표 아래부터
    // 인라인 그림도 줄 내용 — 떠 있는 표 아래로 내려간다(한컴 저장본 보도자료 머리: 인라인 표 줄 5307 = 떠 있는 표 4741 + 바깥 566)
    const inl = `<hp:pic><hp:sz width="2000" height="1000"/><hp:pos treatAsChar="1"/><hp:outMargin left="0" right="0" top="0" bottom="0"/></hp:pic>`
    assert.deepEqual(vps(`<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0">${fl(3000, "PARA", "TOP")}${inl}<hp:t/></hp:run></hp:p>`), [[3000]])
    // 앵커 글자가 둘째 줄에 있는 개체는 그 줄 위에 끼고, 첫 줄은 제자리(한컴 저장본 연락처 문단: 첫 줄 56218, 둘째 줄 = 첫 줄 끝 + 개체 4330)
    assert.deepEqual(vps(`<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>${"가".repeat(43)}</hp:t>${fl(3000, "PARA", "TOP")}<hp:t>나</hp:t></hp:run></hp:p>`), [[0, 4600]])
    // 글 시작보다 아래(vertOffset 2000)에 놓인 개체는 글을 밀지 않고 띠가 된다 — 띠(2000~5000)와 겹치는 줄부터 띠 아래, 다음 문단도 그 아래
    const low = fl(3000, "PARA", "TOP").replace(`vertOffset="0"`, `vertOffset="2000"`)
    assert.deepEqual(vps(`<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0">${low}<hp:t>${"가".repeat(42 * 3)}</hp:t></hp:run></hp:p>${text("다음")}`), [[0, 5000, 6600], [8200]])
    // 줄 pitch 1600: 앞 문단 4줄(0~4800) 다음, 쪽 아래 표 4000 이 붙은 문단 6400 + 1000 + 600 > 10000 − 4000 → 새 쪽
    assert.deepEqual(vps(text("가".repeat(42 * 4)) + `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0">${fl(4000, "PAGE", "BOTTOM")}<hp:t>결재</hp:t></hp:run></hp:p>`)[1], [0])
  })
  it("2단 구역의 각주는 단 폭으로 채운다", () => {
    const body = `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:ctrl><hp:colPr colCount="2" sameSz="1" sameGap="2000"/></hp:ctrl><hp:ctrl><hp:footNote><hp:subList><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>${"가".repeat(30)}</hp:t></hp:run></hp:p></hp:subList></hp:footNote></hp:ctrl><hp:t>본문</hp:t></hp:run></hp:p>`
    const ps = reflowed(body)
    assert.deepEqual(ps[1].map(s => s[1]), [20000, 20000])
  })
  it("어울림 그림 옆 줄은 그림 폭 + 바깥 여백만큼 좁아지고, 그림 아래부터는 본문 폭", () => {
    const pic = `<hp:pic textWrap="SQUARE" textFlow="BOTH_SIDES"><hp:sz width="12000" height="5000"/><hp:pos treatAsChar="0" vertRelTo="PARA" horzRelTo="COLUMN" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="1000" top="0" bottom="0"/></hp:pic>`
    const body = `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0">${pic}<hp:t>${"가".repeat(90)}</hp:t></hp:run></hp:p><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>${"가".repeat(50)}</hp:t></hp:run></hp:p>`
    const [p1, p2] = reflowed(body)
    // 줄 간격 1600 — 0·1600·3200·4800 줄이 그림(0~5000)과 겹친다: 4줄 × 29자 > 90자
    assert.deepEqual(p1.map(s => [s[1], s[2]]), [[29000, 13000], [29000, 13000], [29000, 13000], [29000, 13000]].slice(0, p1.length))
    assert.ok(p1.length >= 3)
    assert.deepEqual([...new Set(p2.map(s => s[1]))], [42000])
  })
  it("위첨자는 크기 16/25 로 잰다", () => {
    const sup = (n: number) => `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="1"><hp:t>${"가".repeat(n)}</hp:t></hp:run></hp:p>`
    assert.deepEqual(reflowed(sup(70))[0].map(s => s[0]), [0, 65]) // 4·MulDiv(1000, ⌊640/4⌋, 1000) = 640 → 42000 ÷ 640 = 65자
  })
  it("공백에서 이미 줄 폭에 닿았으면 줄이 끝나고, 공백은 두 칸까지만 남는다", () => {
    const text = "가가 " + "나".repeat(3) + "      다다"
    const widths = [...text].map(c => (c === " " ? 50 : 100))
    // "가가 나나나" = 550 ≥ 550 → 첫 공백에서 줄 끝, 공백 둘은 남고 셋째부터 다음 줄
    assert.deepEqual(wrap(text, 550, 550, 1000, 100, "charAll", { widths, kinsoku: "hancom" }).starts, [0, 8])
    // condense 로 남는 폭이 있어도 다음 낱말은 새로 시작하지 못한다
    const t2 = "가가 나나 다다"
    const w2 = [...t2].map(c => (c === " " ? 50 : 100))
    assert.deepEqual(wrap(t2, 440, 440, 1000, 100, "charAll", { widths: w2, condensePct: 100, kinsoku: "hancom" }).starts, [0, 6])
  })
  it("breakLatinWord=BREAK_WORD 면 영문 단어도 글자 단위로 끊는다 (한컴 저장본 좁은 칸 \"Unit P|rice\")", () => {
    const text = "Unit Price", widths = [...text].map(() => 500)
    assert.deepEqual(wrap(text, 3344, 3344, 1000, 100, "keep", { widths, kinsoku: "hancom" }).starts, [0, 5])
    assert.deepEqual(wrap(text, 3344, 3344, 1000, 100, "keep", { widths, kinsoku: "hancom", latinBreak: true }).starts, [0, 6])
  })
  it("한컴 사용자 기호(보충 사용 영역)는 폭표 글꼴에서도 반각 0.5em", () => {
    const sym = String.fromCodePoint(0xf080f) // HWP3 기호 글자
    for (const face of ["한양신명조", "명조", "함초롬바탕"]) assert.equal(hancomCharWidth(sym, 1000, 100, 0, faceClassForReflow(face)), 500, face)
  })
  it("내어쓰기로 남는 폭이 한 글자도 안 되면 둘째 줄부터도 온 폭으로 채운다", () => {
    const head = HEAD.replace("</hh:paraProperties>", `<hh:paraPr id="1"><hh:align horizontal="LEFT"/><hh:breakSetting breakNonLatinWord="KEEP_WORD"/><hh:margin><hc:intent value="-10000" unit="HWPUNIT"/></hh:margin></hh:paraPr></hh:paraProperties>`)
    const [p] = reflowed(`<hp:p paraPrIDRef="1"><hp:run charPrIDRef="0"><hp:t>${"가".repeat(12)}</hp:t></hp:run></hp:p>`, 8000, head)
    assert.deepEqual(p.map(sg => sg[0]), [0, 8]) // 종전엔 폭 500 으로 묶여 [0, 8, 9, 10, 11]
  })
  it("줄 나눔으로 끝난 문단의 마지막 빈 줄은 문단 끝 칸에서 시작한다(textpos 0 아님)", () => {
    const [p] = reflowed(`<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>가나다<hp:lineBreak/></hp:t></hp:run></hp:p>`)
    assert.deepEqual(p.map(sg => sg[0]), [0, 4]) // 가나다(3) + 줄 나눔(1)
  })
  it("한양신명조 하이픈은 0.541em (HCI Poppy 는 0.332em) — 신구조문 대비표 '-----' 줄", () => {
    assert.equal(hancomCharWidth("-", 1000, 100, 0, faceClassForReflow("한양신명조")), 540) // 4·MulDiv(541, 250, 1000)
    assert.equal(hancomCharWidth("-", 1000, 100, 0, faceClassForReflow("HCI Poppy")), 332)
  })
  it("고정폭 빈칸(fwSpace)은 1/4em 이고 줄을 끊지 않는다 (한컴 저장본 칸 \"변경 전\" 한 줄)", () => {
    const q = hancomCharWidth("\u2005", 1000, 100, 0, "cjk")
    assert.equal(q, 248) // 4·⌊1000/16⌋ — 공백(500)의 절반
    assert.equal(hancomCharWidth("\u2005", 1000, 100, -11, "cjk"), 220) // 자간은 공백처럼 받는다: 248 + 4·MulDiv(62, −11, 100) = 248 − 28
    const ga = hancomCharWidth("가", 1000, 100, 0, faceClassForReflow("바탕"))
    const body = `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>가가<hp:fwSpace/>가</hp:t></hp:run></hp:p>`
    assert.equal(reflowed(body, 3 * ga + q + 4)[0].length, 1) // 0.5em 공백이면 넘쳐 두 줄
  })
  it("칸이 내용으로 자라면 행 높이 = 내용 + 칸 위아래 여백, 칸 안 떠 있는 개체는 문단 위 간격 앞에 놓인다", async () => {
    const { measureTableHeight } = await import("../src/render/para-model.js")
    const { DEFAULT_PARA_GEOM } = await import("../src/render/head-styles.js")
    const cell = (inner: string, pp = 0) => `<hp:tbl ${NS} rowCnt="1" colCnt="1"><hp:sz width="10000" height="1000"/><hp:tr><hp:tc><hp:subList vertAlign="TOP"><hp:p paraPrIDRef="${pp}">${inner}</hp:p></hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="10000" height="1000"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc></hp:tr></hp:tbl>`
    const tbl = (xml: string) => createXmlParser().parseFromString(xml, "text/xml").documentElement as unknown as Element
    // 한컴 저장본: 칸 높이 2994·내용 3480 → 표 3762
    assert.equal(measureTableHeight(tbl(cell(`<hp:run charPrIDRef="0"><hp:t>가</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="3480" textheight="3480" baseline="2958" spacing="0" horzpos="0" horzsize="8980"/></hp:linesegarray>`))), 3762)
    // 위 간격 500 문단의 떠 있는 그림 9795 — 그림은 문단 영역 위(0)에서, 행 = 9795 + 282
    const pic = `<hp:run charPrIDRef="0"><hp:pic textWrap="TOP_AND_BOTTOM"><hp:sz width="5000" height="9795"/><hp:pos treatAsChar="0" vertRelTo="PARA" vertOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/></hp:pic><hp:t/></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="500" vertsize="1400" textheight="1400" baseline="1190" spacing="840" horzpos="0" horzsize="0"/></hp:linesegarray>`
    const memo = () => ({ cell: new WeakMap(), table: new WeakMap(), paraGeom: new Map([["5", { ...DEFAULT_PARA_GEOM, spaceBefore: 500 }]]) })
    assert.equal(measureTableHeight(tbl(cell(pic, 5)), memo()), 10077)
  })
  it("마지막 글자의 자간은 넘침 판정에 넣지 않는다", () => {
    const text = "가가가가"
    const widths = [96, 96, 96, 96], spacings = [-4, -4, -4, -4] // 100 에 자간 −4
    assert.deepEqual(wrap(text, 384, 384, 1000, 100, "charAll", { widths, spacings, kinsoku: "hancom" }).starts, [0, 3]) // 288 + 100(자간 전) > 384
    assert.deepEqual(wrap(text, 384, 384, 1000, 100, "charAll", { widths, kinsoku: "hancom" }).starts, [0]) // 자간 몫을 안 주면 384 에 든다
  })
})

describe("보충 사용자 영역 기호 폭", () => {
  it("한컴 기호는 반각 0.5em, 글머리 동그라미 숫자(U+F02B1~F02B6)·U+F02FB 는 전각 1em", async () => {
    const { measureTextWidth } = await import("../src/hwpx/text-metrics.js")
    assert.equal(measureTextWidth(String.fromCodePoint(0xf080f), 1000, 100, { faceClass: "hcr" }), 500)
    assert.equal(measureTextWidth(String.fromCodePoint(0xf02fc), 1000, 100, { faceClass: "hcr" }), 500)
    for (const cp of [0xf02b1, 0xf02b5, 0xf02fb]) assert.equal(measureTextWidth(String.fromCodePoint(cp), 1000, 100, { faceClass: "hcr" }), 1000, cp.toString(16))
  })
})

describe("딩뱃 원문자 대체 폭", () => {
  it("❶~➓ 는 함초롬 글꼴엔 제 폭(970), 그 밖의 글꼴엔 한컴바탕 대체 폭 1em", async () => {
    const { measureTextWidth, faceClassOf } = await import("../src/hwpx/text-metrics.js")
    assert.equal(measureTextWidth("➌", 1000, 100, { faceClass: faceClassOf("한컴 윤고딕 230") }), 1000)
    assert.equal(measureTextWidth("❶", 1000, 100, { faceClass: faceClassOf("HY헤드라인M") }), 1000)
    assert.equal(measureTextWidth("➌", 1000, 100, { faceClass: faceClassOf("함초롬돋움") }), 970)
  })
})

describe("글꼴에 없는 기호의 한컴바탕 대체 폭", () => {
  it("– ⇨ ∘ ‣ 〇 는 그 글자를 따로 갖지 않은 글꼴에서 한컴바탕 폭", async () => {
    const { measureTextWidth, faceClassOf } = await import("../src/hwpx/text-metrics.js")
    const fc = faceClassOf("HY헤드라인M")
    assert.deepEqual(["–", "⇨", "∘", "‣", "〇"].map(c => measureTextWidth(c, 1000, 100, { faceClass: fc })), [430, 1000, 500, 465, 1000])
    // 그 글자를 가진 글꼴(맑은 고딕 – 513)은 제 폭
    assert.equal(measureTextWidth("–", 1000, 100, { faceClass: faceClassOf("맑은 고딕") }), 513)
  })
})
