/** 원본 글꼴 문자표와 정확히 일치한 윤곽만 식별한다. 글꼴 파일은 포함하지 않는다. */
import { createHash } from "node:crypto"
import { mapPuaText } from "../shared/pua.js"

export type OutlinePoint = [number, number, boolean]
export interface GlyphOutline { contours: OutlinePoint[][]; upm: number }

// sha256(JSON.stringify([upm, PDF advance(em1000), contours])). HCRDotum cmap F02EF와 native PDF가 동일하다.
const HCR_DOT = "bb7a2a3ab48d5bfdfd9582c0fb6525401c3a7f1851bb1c1bdb45048be95d1599"
export function knownFontGlyph(name: string | undefined, outline: GlyphOutline, width: unknown): string | null {
  if (name?.replace(/^[A-Z]{6}\+/, "") !== "HCRDotum" || width !== 970 || outline.upm !== 1000) return null
  const signature = createHash("sha256").update(JSON.stringify([outline.upm, width, outline.contours])).digest("hex")
  return signature === HCR_DOT ? mapPuaText(String.fromCodePoint(0xf02ef)) : null
}
