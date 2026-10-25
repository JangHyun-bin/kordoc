import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ocrItemsToBlocks } from "../src/ocr/pdf-ocr.js"
import type { OcrItem } from "../src/ocr/engine.js"
import { copyOcrTextGaps, ocrTextGaps, rememberOcrTextGaps } from "../src/ocr/text-gaps.js"

type Gap = { at: number; left: number; right: number }
type Item = OcrItem & { gaps?: Gap[] }
const item = (text: string, x: number, y: number, w: number, gaps?: Gap[]): Item =>
  ({ text, x, y, w, h: 36, confidence: 0.95, ...(gaps ? { gaps } : {}) })

function receipt(): Item[] {
  return [
    item("상품코드", 20, 100, 193),
    item("단 가수량", 360, 100, 193, [{ at: 1, left: 390, right: 436 }, { at: 3, left: 458, right: 496 }]),
    item("금액", 626, 100, 102),
    item("8809074396277", 20, 160, 247),
    item("1,300  2", 375, 160, 156, [{ at: 5, left: 456, right: 516 }]),
    item("2,600", 638, 160, 89),
    item("8809074397502", 20, 220, 247),
    item("2,500  10", 372, 220, 157, [{ at: 5, left: 456, right: 501 }]),
    item("25,000", 619, 220, 107),
    item("부가세", 360, 280, 160), item("2,509", 619, 280, 107),
  ]
}

function table(items: Item[], tables = true) {
  for (const i of items) if (i.gaps) rememberOcrTextGaps(i, i.gaps)
  const blocks = ocrItemsToBlocks(items, 1, 796 / 2, 600 / 2, 2, undefined, tables)
  return { blocks, table: blocks.find(b => b.table)?.table }
}

describe("OCR body-supported column recovery", () => {
  it("uses a raster gap and CTC alignment without changing the recognized string", async () => {
    const { findOcrTextGaps } = await import("../src/ocr/text-gaps.js")
    const w = 140, h = 24, rgba = new Uint8Array(w * h * 4).fill(255)
    for (const x0 of [4, 24, 84, 104]) for (let y = 4; y < 20; y++) for (let x = x0; x < x0 + 12; x++) {
      const p = (y * w + x) * 4
      rgba[p] = rgba[p + 1] = rgba[p + 2] = 0
    }
    const box = { x: 0, y: 0, w, h }
    const gaps = findOcrTextGaps(rgba, w, box, "단가수량", "단가수량", [1, 3, 9, 11], 10)
    assert.ok(gaps.some(g => g.at === 2 && g.left >= 36 && g.right <= 84))
    assert.deepEqual(findOcrTextGaps(rgba, w, box, "단가수량", "다른글", [1, 3, 9, 11], 10), [])
  })

  it("recovers the joined header and both numeric rows from two distinct body rows", () => {
    const r = table(receipt())
    assert.ok(r.table, JSON.stringify(r.blocks))
    assert.equal(r.table.cols, 4)
    assert.deepEqual(r.table.cells[0].map(c => c.text), ["상품코드", "단 가", "수량", "금액"])
    assert.deepEqual(r.table.cells[1].map(c => c.text), ["8809074396277", "1,300", "2", "2,600"])
    assert.deepEqual(r.table.cells[2].map(c => c.text), ["8809074397502", "2,500", "10", "25,000"])
    const text = r.table.cells.flat().map(c => c.text).join("").replace(/\s/g, "")
    assert.equal(text, receipt().map(i => i.text).join("").replace(/\s/g, ""))
  })

  it("keeps the existing result without internal OCR evidence", () => {
    const r = table(receipt().map(({ gaps, ...i }) => i))
    assert.equal(r.table?.cols, 3)
  })

  it("does not infer a column from just one body row", () => {
    const items = receipt()
    delete items[7].gaps
    assert.equal(table(items).table?.cols, 3)
  })

  it("does not cut a genuine unsplit header label", () => {
    const items = receipt()
    items[1] = item("販売情報", 360, 100, 193)
    assert.equal(table(items).table?.cols, 3)
  })

  it("does not change paragraph output when tables are disabled", () => {
    const items = receipt()
    assert.deepEqual(table(items, false).blocks, table(items.map(({ gaps, ...i }) => i), false).blocks)
  })

  it("requires the same gap position in both body rows", () => {
    const items = receipt()
    items[7].gaps = [{ at: 5, left: 510, right: 524 }]
    assert.equal(table(items).table?.cols, 3)
  })

  it("uses a shared empty interval even when it is off the header gap center", () => {
    const items = receipt()
    items[4].gaps = [{ at: 5, left: 458, right: 470 }]
    items[7].gaps = [{ at: 5, left: 460, right: 472 }]
    const t = table(items).table
    assert.equal(t?.cols, 4)
    assert.deepEqual(t.cells[1].map(c => c.text), ["8809074396277", "1,300", "2", "2,600"])
  })

  it("accepts an already-separated numeric pair as an independent body-row witness", () => {
    const items = receipt()
    items.splice(4, 1, item("1,300", 375, 160, 85), item("2", 516, 160, 15))
    const t = table(items).table
    assert.equal(t?.cols, 4)
    assert.deepEqual(t.cells[1].map(c => c.text), ["8809074396277", "1,300", "2", "2,600"])
  })

  it("keeps separately recognized numeric items in their columns despite overlapping noisy boxes", () => {
    const items = receipt()
    items[1] = item("단가 수량", 371, 100, 193, [{ at: 1, left: 404, right: 441 }, { at: 3, left: 474, right: 494 }])
    items[7] = item("2,500  10", 384, 220, 158, [{ at: 7, left: 471, right: 511 }])
    items.splice(4, 1, item("1,300", 387, 160, 85), item("2", 462, 160, 80))
    const t = table(items).table
    assert.equal(t?.cols, 4)
    assert.deepEqual(t.cells[1].map(c => c.text), ["8809074396277", "1,300", "2", "2,600"])
  })

  it("does not turn grouped thousands into separate columns", () => {
    const items = receipt()
    for (const index of [4, 7]) items[index] = { ...items[index], text: "385 426", gaps: [{ at: 3, left: 456, right: 516 }] }
    assert.equal(table(items).table?.cols, 3)
  })

  it("keeps full-width item-name rows and unrelated source text", () => {
    const items = receipt()
    items.splice(3, 0, item("001 품목 이름", 20, 140, 500))
    items.push(item("This is an ordinary paragraph below the table.", 20, 430, 700))
    const r = table(items)
    assert.equal(r.table?.cols, 4)
    assert.ok(r.table.cells.some(row => row[0].text === "001 품목 이름" && row[0].colSpan === 4))
    assert.equal(r.blocks.filter(b => b.text?.includes("ordinary paragraph")).length, 1)
  })

  it("transforms private evidence and invalidates it after text changes", () => {
    const source = item("A B", 0, 0, 100)
    rememberOcrTextGaps(source, [{ at: 2, left: 40, right: 60 }])
    const target = { ...source }
    copyOcrTextGaps(source, target, 0.5, 100)
    assert.deepEqual(ocrTextGaps(target), [{ at: 2, left: 120, right: 130 }])
    assert.ok(!JSON.stringify(source).includes("left"))
    source.text = "A … B"
    assert.deepEqual(ocrTextGaps(source), [])
  })
})
