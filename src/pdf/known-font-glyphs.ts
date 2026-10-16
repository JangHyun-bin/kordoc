/** 원본 글꼴 문자표와 정확히 일치한 윤곽만 식별한다. 글꼴 파일은 포함하지 않는다. */
import { createHash } from "node:crypto"
import { mapPuaText } from "../shared/pua.js"

export type OutlinePoint = [number, number, boolean]
export interface GlyphOutline { contours: OutlinePoint[][]; upm: number }

// sha256(JSON.stringify([upm, PDF advance(em1000), contours])). HCRDotum cmap F02EF와 native PDF가 동일하다.
const HCR_DOT = "bb7a2a3ab48d5bfdfd9582c0fb6525401c3a7f1851bb1c1bdb45048be95d1599"
// Haansoft Batang cmap F02B1..6. HCRBatang은 다른 글꼴이므로 포함하지 않는다.
const BATANG_NUMBERS = [
  "8a4af2cf2dfe3238b4e2b35af976746216ade6e89cd3c55ec1e43bca532379b9",
  "7332dcab9d77002bdb92723a7fa4afa963ad01601f6328fbedd7289798fb77d0",
  "e7cc725807eae1ae0311898429629931f5924ade91a876c899b0c5bd109b325b",
  "3956a9db6baa74ef40ff93291ef5c42245cd4b36d613e5c956e307f347705adb",
  "8340732dc5f6a75a6808e87749ae9e9e7d54f4299f86eabbfaedd95da10ad447",
  "1412a79bd9ed7fdb34a8f04c29e341230a3bef649fb7b44a58ea6a56da0f3e44",
]
export function knownFontGlyph(name: string | undefined, outline: GlyphOutline, width: unknown): string | null {
  const face = name?.replace(/^[A-Z]{6}\+/, "")
  const dot = face === "HCRDotum" && width === 970 && outline.upm === 1000
  const number = (face === "Haansoft Batang" || face === "Haansoft-Batang") && width === 1000 && outline.upm === 1024
  if (!dot && !number) return null
  const signature = createHash("sha256").update(JSON.stringify([outline.upm, width, outline.contours])).digest("hex")
  if (dot) return signature === HCR_DOT ? mapPuaText(String.fromCodePoint(0xf02ef)) : null
  const index = BATANG_NUMBERS.indexOf(signature)
  return index < 0 ? null : mapPuaText(String.fromCodePoint(0xf02b1 + index))
}
