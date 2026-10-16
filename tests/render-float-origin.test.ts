import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createXmlParser } from "../src/hwpx/parser-shared.js"
import { anchorObject } from "../src/render/object-anchor.js"
import { buildPara } from "../src/render/para-model.js"
const ctx = { page: 0, geom: { PW: 60000, PH: 80000, ML: 5000, MT: 5000, BODY_W: 50000, BODY_H: 70000 }, extentMemo: { cell: new WeakMap(), table: new WeakMap() } }
function pos(rel = "PARA", wrap = "SQUARE", paragraphTop: number | null = 0, anchor = 1000) {
  const p = createXmlParser().parseFromString(`<hp:p xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"><hp:run><hp:pic textWrap="${wrap}"><hp:sz width="5000" height="2000"/><hp:pos treatAsChar="0" vertRelTo="${rel}" horzRelTo="COLUMN" vertOffset="3000"/><hp:outMargin top="100"/></hp:pic></hp:run></hp:p>`, "text/xml").documentElement as unknown as Element
  return anchorObject(buildPara(p).objs[0], 0, 0, 1000, 10000, ctx, anchor, false, paragraphTop ?? undefined).y
}
describe("어울림 그림 그리기의 문단 원점", () => {
  it("문단 첫 줄 앞의 위 간격을 개체 오프셋에 더하지 않는다", () => assert.equal(pos(), 3100))
  it("둘째 줄 앵커도 문단 원점에서 오프셋을 잰다", () => assert.equal(pos("PARA", "SQUARE", 0, 2600), 3100))
  it("개체는 실제 앵커 줄보다 위로 올라가지 않는다", () => assert.equal(pos("PARA", "SQUARE", 0, 5000), 5100))
  it("문단 원점을 모르면 기존 첫 줄 좌표를 쓴다", () => assert.equal(pos("PARA", "SQUARE", null), 4100))
  it("단 기준 좌표는 문단 원점으로 바꾸지 않는다", () => assert.equal(pos("COLUMN"), 4100))
  it("쪽 기준 좌표를 유지한다", () => assert.equal(pos("PAGE"), 8000))
  it("글 뒤의 개체 배치는 유지한다", () => assert.equal(pos("PARA", "BEHIND_TEXT"), 4100))
})
