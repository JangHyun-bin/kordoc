import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createXmlParser } from "../src/hwpx/parser-shared.js"
import { splitFloatTableRemainder } from "../src/render/reflow-tables.js"

const ns = 'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"'
function host(lines: number[], mode = "CELL", extra = "", margins = 0) {
  const segs = lines.map(v => `<hp:lineseg textpos="0" vertpos="${v}" vertsize="1000" textheight="1000" baseline="850" spacing="600"/>`).join("")
  const xml = `<hp:p ${ns}><hp:run><hp:tbl textWrap="TOP_AND_BOTTOM" pageBreak="${mode}" rowCnt="1" colCnt="1"><hp:sz width="10000" height="5904"/><hp:pos treatAsChar="0" vertRelTo="PARA" vertOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:tr><hp:tc><hp:subList><hp:p><hp:run>${extra}<hp:t>본문</hp:t></hp:run><hp:linesegarray>${segs}</hp:linesegarray></hp:p></hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="10000" height="5904"/><hp:cellMargin left="0" right="0" top="${margins}" bottom="${margins}"/></hp:tc></hp:tr></hp:tbl></hp:run></hp:p>`
  return createXmlParser().parseFromString(xml, "text/xml").documentElement as unknown as Element
}
describe("칸 나눔 표의 빈 높이와 실제 남은 내용", () => {
  it("글이 모두 앞쪽에 들면 저장된 빈 행 높이를 다음 쪽으로 넘기지 않는다", () => {
    const p = host([0, 1600])
    assert.equal(splitFloatTableRemainder(p, 3000, 6000, 10000), 0)
    assert.deepEqual(Array.from(p.getElementsByTagName("hp:lineseg"), s => Number(s.getAttribute("vertpos"))), [0, 1600])
  })
  it("실제로 남은 줄은 다음 쪽 첫 줄부터 배치한다", () => {
    const p = host([0, 1600, 3200])
    assert.equal(splitFloatTableRemainder(p, 3000, 6000, 10000), 1000)
    assert.deepEqual(Array.from(p.getElementsByTagName("hp:lineseg"), s => Number(s.getAttribute("vertpos"))), [0, 1600, 0])
  })
  it("한 줄도 못 넣거나 조판된 줄이 없으면 행째 옮긴다", () => {
    assert.equal(splitFloatTableRemainder(host([0]), 5500, 6000, 10000), 5904)
    assert.equal(splitFloatTableRemainder(host([]), 3000, 6000, 10000), 5904)
  })
  it("행 단위 나눔은 내용이 짧아도 저장 높이를 유지한다", () => {
    assert.equal(splitFloatTableRemainder(host([0, 1600], "TABLE"), 3000, 6000, 10000), 5904)
  })
  it("칸 위아래 여백 때문에 줄이 안 들면 실제 남은 높이에 포함한다", () => {
    assert.equal(splitFloatTableRemainder(host([0, 1600], "CELL", "", 300), 3000, 6000, 10000), 1600)
  })
  it("줄은 들어도 다음 쪽으로 옮긴 그림 높이는 남긴다", () => {
    const pic = '<hp:pic textWrap="TOP_AND_BOTTOM"><hp:sz width="1000" height="4000"/><hp:pos treatAsChar="0" vertRelTo="PARA" vertOffset="0"/><hp:outMargin top="0" bottom="0"/></hp:pic>'
    assert.equal(splitFloatTableRemainder(host([0], "CELL", pic), 3000, 6000, 10000), 4000)
  })
})
