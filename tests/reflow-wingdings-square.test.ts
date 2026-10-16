import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { fontAdvanceEm1000, fontHasGlyph, fontWidthFn } from "../src/hwpx/font-metrics.js"
import { createXmlParser } from "../src/hwpx/parser-shared.js"
import { hancomCharWidth } from "../src/hwpx/text-metrics.js"
import { parseRenderStyles, type RenderCharStyle } from "../src/render/head-styles.js"
import { glyphWidth, reflowSection } from "../src/render/reflow.js"

const square = "\uf0a7"
const style = (face: string, height = 1000, bold = false): RenderCharStyle => ({
  face, height, bold, italic: false, underline: false, ratio: 100, spacing: 0,
})

describe("Wingdings 사각 기호의 대체 폭", () => {
  it("실제 임베드 hmtx937/upem2048을 보존하고 4단위로 양자화한다", () => {
    const expected = 937 / 2048 * 1000
    assert.equal(fontAdvanceEm1000("맑은 고딕", 0xf0a7), expected)
    assert.equal(fontWidthFn("맑은 고딕")!(0xf0a7), expected)
    assert.deepEqual(glyphWidth(square, style("돋움체")), { w: 456, sp: 0 })
    assert.equal(hancomCharWidth(square, 1000, 100, 0, "fixedPitch"), 456)
    assert.equal(hancomCharWidth(square, 468, 100, 0, "fixedPitch"), 216)
  })
  it("실제 맑은 고딕 TTF 진하게 문단도 같은 대체 기호 폭을 쓴다", () => {
    for (const bold of [false, true]) assert.deepEqual(glyphWidth(square, style("맑은 고딕", 1400, bold)), { w: 640, sp: 0 })
  })
  it("한컴 고딕의 명시된 기호 폭은 대체 폭보다 계속 우선한다", () => {
    assert.equal(fontAdvanceEm1000("한컴 고딕", 0xf0a7), 458)
    assert.equal(fontWidthFn("한컴 고딕")!(0xf0a7), 458)
    assert.equal(glyphWidth(square, style("한컴 고딕", 1300)).w, 596)
  })
  it("대체 폭을 더해도 원래 글꼴이 가진 글자로 판정하지 않는다", () => {
    assert.equal(fontHasGlyph("맑은 고딕", 0xf0a7), false)
    assert.equal(fontHasGlyph("한컴 고딕", 0xf0a7), true)
  })
  it("일반 글자와 이웃 PUA·빈칸 폭은 그대로 둔다", () => {
    for (const [ch, w] of [["가", 1000], ["A", 500], ["\uf0a6", 1000], ["\uf0a0", 500], [" ", 500]] as const) {
      assert.equal(glyphWidth(ch, style("돋움체")).w, w)
    }
  })
  it("좁은 줄에서 기호 다음 본문을 실제 전진 폭으로 배치한다", () => {
    const ns = 'xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"'
    const head = `<hh:head ${ns}><hh:fontfaces><hh:fontface lang="HANGUL"><hh:font id="0" face="돋움체" type="TTF"/></hh:fontface></hh:fontfaces><hh:charProperties><hh:charPr id="0" height="1000"><hh:fontRef hangul="0"/></hh:charPr></hh:charProperties><hh:paraProperties><hh:paraPr id="0"><hh:align horizontal="LEFT"/><hh:breakSetting breakNonLatinWord="KEEP_WORD"/></hh:paraPr></hh:paraProperties></hh:head>`
    const root = createXmlParser().parseFromString(`<hs:sec ${ns}><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>${square}가나</hp:t></hp:run></hp:p></hs:sec>`, "text/xml").documentElement as unknown as Element
    reflowSection(root, parseRenderStyles(head), { BODY_W: 2500, BODY_H: 80000 })
    assert.deepEqual(Array.from(root.getElementsByTagName("hp:lineseg"), s => s.getAttribute("textpos")), ["0"])
  })
})
