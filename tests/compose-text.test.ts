/**
 * 글자 겹치기(HWPX hp:compose · HWP5 tcps) — 겹친 글을 낸다.
 *
 * 종전엔 HWPX 는 composeText 속성의 글을, HWP5 는 글자 겹침 컨트롤을 통째로 건너뛰어 법령 서식의 원 번호
 * (하천법 시행규칙 매수청구서 "⑯견고ㆍ비견고성" = 원 숫자 조각 F0289 + 일의 자리 숫자 F0298)와 보고서의 네모 번호 10
 * (table-vpos-01 = 왼쪽 1 네모 F02BA + 일의 자리 숫자 F02C3)이 빠졌다. 아래 문서는 그 실파일 구조를 줄인 합성본이다.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import JSZip from "jszip"
import { parse } from "../src/index.js"
import { charShape, ctrlIdBytes, paraHeader, paraText, rec } from "./fixtures/hwp5-records.js"
import type { HwpRecord } from "../src/hwp5/record.js"

const CFB = createRequire(import.meta.url)("cfb")
const SEC_NS = `xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"`

async function hwpx(text: string, circleType = "CHAR"): Promise<Buffer> {
  const compose = `<hp:compose circleType="${circleType}" charSz="-4" composeType="OVERLAP" charPrCnt="10" composeText="${text}"><hp:charPr prIDRef="0"/></hp:compose>`
  const zip = new JSZip()
  zip.file("mimetype", "application/hwp+zip")
  zip.file("Contents/section0.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<hs:sec ${SEC_NS}><hp:p id="0" paraPrIDRef="0" styleIDRef="0"><hp:run charPrIDRef="0"><hp:t>잔존기간 </hp:t>${compose}<hp:t>견고</hp:t></hp:run></hp:p></hs:sec>`)
  return zip.generateAsync({ type: "nodebuffer" })
}

/** HWP5 — 글자 겹침 컨트롤 문자(0x17) + CTRL_HEADER tcps(글자 수 WORD · 글자 WCHAR[n] · 테두리 종류 · 글자 크기 · 겹침 · 글자 모양 수) */
function hwp5(chars: string, border: number): Buffer {
  const tcps = Buffer.concat([ctrlIdBytes("tcps"), Buffer.from([chars.length & 255, chars.length >> 8]), Buffer.from(chars, "utf16le"), Buffer.from([border, 0xfc, 1, 0])])
  const records: HwpRecord[] = [paraHeader(0), paraText(1, ["잔존기간 ", { ctrl: "tcps", ch: 0x17 }, "견고"]), charShape(1, [[0, 0]]), rec(0x47, 1, tcps)]
  const section = Buffer.concat(records.flatMap(r => {
    const h = Buffer.alloc(4)
    h.writeUInt32LE(r.tagId | (r.level << 10) | (r.data.length << 20))
    return [h, r.data]
  }))
  const fileHeader = Buffer.alloc(256)
  fileHeader.write("HWP Document File", 0, "ascii")
  fileHeader.writeUInt32LE(0x05000300, 32)
  const cfb = CFB.utils.cfb_new()
  CFB.utils.cfb_add(cfb, "/FileHeader", fileHeader)
  CFB.utils.cfb_add(cfb, "/DocInfo", Buffer.alloc(0))
  CFB.utils.cfb_add(cfb, "/BodyText/Section0", section)
  return Buffer.from(CFB.write(cfb, { type: "buffer" }))
}

async function markdown(buf: Buffer, filename: string): Promise<string> {
  const r = await parse(buf, { filename })
  assert.ok(r.success, `파싱 실패: ${r.success ? "" : r.error}`)
  return r.markdown
}

describe("글자 겹치기 — 겹친 글을 낸다", () => {
  it("HWPX: 원 숫자 조각 + 일의 자리 숫자는 두 자리 원 번호", async () => {
    assert.ok((await markdown(await hwpx("&#xF0289;&#xF0298;"), "a.hwpx")).includes("잔존기간 ⑯견고"))
    assert.ok((await markdown(await hwpx("&#xF02BA;&#xF02C3;"), "a.hwpx")).includes("잔존기간 ⑩견고"))
  })
  it("HWPX: 둘러싼 도형 안 숫자는 원 숫자, 도형 없이 겹친 글은 그대로", async () => {
    assert.ok((await markdown(await hwpx("12", "SHAPE_CIRCLE"), "a.hwpx")).includes("잔존기간 ⑫견고"))
    assert.ok((await markdown(await hwpx("12"), "a.hwpx")).includes("잔존기간 12견고"))
  })
  it("HWP5: 글자 겹침 컨트롤도 같은 글", async () => {
    assert.ok((await markdown(hwp5("\u{F0289}\u{F0298}", 0), "a.hwp")).includes("잔존기간 ⑯견고"))
    assert.ok((await markdown(hwp5("12", 1), "a.hwp")).includes("잔존기간 ⑫견고"))
  })
})
