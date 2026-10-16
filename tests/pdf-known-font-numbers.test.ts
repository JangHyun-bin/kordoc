import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { OPS } from "pdfjs-dist/legacy/build/pdf.mjs"
import { knownFontGlyph, type GlyphOutline } from "../src/pdf/known-font-glyphs.js"
import { NO_UNICODE, readOutline, restoreUnmappedGlyphs } from "../src/pdf/symbol-glyphs.js"
import { outlineFont } from "./helpers/outline-font.js"

// Haansoft Batang의 native cmap F02B1..6과 같은 수치 윤곽. 글꼴 파일은 포함하지 않는다.
const fixtures: Array<GlyphOutline & { pua: string; text: string; width: number }> = JSON.parse(readFileSync(new URL("fixtures/haansoft-number-outlines.json", import.meta.url), "utf8"))
describe("원본 문자표와 동일한 Haansoft Batang 번호", () => {
  for (const f of fixtures) it(`${f.pua}는 기존 공용 정책의 ${f.text}로 복원한다`, () => {
    const data = outlineFont(f.upm, f.contours), outline = readOutline(data, 0xe000)!
    assert.deepEqual(outline, { upm: f.upm, contours: f.contours })
    for (const name of ["Haansoft Batang", "Haansoft-Batang", "ABCDEF+Haansoft Batang"]) {
      assert.equal(knownFontGlyph(name, outline, f.width), f.text)
      const items = [{ str: NO_UNICODE, transform: [10, 0, 0, 10, 0, 0], width: 10, height: 10, fontName: "f1" }]
      restoreUnmappedGlyphs(items, [OPS.setFont, OPS.showText], [["f1", 10], [[{ unicode: NO_UNICODE, fontChar: "\ue000", width: f.width }]]], () => ({ name, data }))
      assert.equal(items[0].str, f.text)
    }
  })
  it("HCRBatang과 확인하지 않은 이름은 같은 윤곽이어도 거절한다", () => {
    for (const f of fixtures) for (const name of [undefined, "HCRBatang", "HCR Batang", "HaansoftBatang", "Haansoft Batang-Bold", "abcdef+Haansoft Batang"]) assert.equal(knownFontGlyph(name, f, f.width), null)
  })
  it("advance·upm·점 좌표·oncurve·contour 수가 달라지면 거절한다", () => {
    for (const f of fixtures) {
      assert.equal(knownFontGlyph("Haansoft Batang", f, 999), null)
      assert.equal(knownFontGlyph("Haansoft Batang", f, "1000"), null)
      for (const change of [
        (g: GlyphOutline) => { g.upm++ },
        (g: GlyphOutline) => { g.contours[0][0][0]++ },
        (g: GlyphOutline) => { g.contours[0][0][2] = !g.contours[0][0][2] },
        (g: GlyphOutline) => { g.contours.pop() },
      ]) {
        const modified = structuredClone(f); change(modified)
        assert.equal(knownFontGlyph("Haansoft Batang", modified, f.width), null)
      }
    }
  })
})
