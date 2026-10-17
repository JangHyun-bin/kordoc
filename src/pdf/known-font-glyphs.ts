/** 원본 글꼴 문자표와 정확히 일치한 윤곽만 식별한다. 글꼴 파일은 포함하지 않는다. */
import { createHash } from "node:crypto"
import { mapPuaText } from "../shared/pua.js"

export type OutlinePoint = [number, number, boolean]
export interface GlyphOutline { contours: OutlinePoint[][]; upm: number }

// sha256(JSON.stringify([upm, PDF advance(em1000), contours])). HCRDotum cmap F02EF와 native PDF가 동일하다.
const HCR_DOT = "bb7a2a3ab48d5bfdfd9582c0fb6525401c3a7f1851bb1c1bdb45048be95d1599"
// HCRDotum cmap F02B1..F02C2(①~⑱). 폭은 ⑱만 959, 나머지 970. F02C3·F02C4 는 같은 글꼴의 F0292·F0293 과 윤곽이 같아 넣지 않는다.
const HCR_NUMBERS = [
  "1b0a094dcfd7aefc2351e5c7054fe754a2a59ce342fed2d7f78e7445d71b2943",
  "aae8317fb2a0107a04d02d2ac92cc6860e188aefbddcc22232331452eb4518bb",
  "8f24a5ed56b3bf1b612601b12e4b5c5ac59628e7c7465f03c4ac7e8e0a83ad40",
  "9d4c236dfd7b8185a229273aee5b457d4463f24cdc8a0783fa59142151a78c57",
  "de1c0ac7276ae7ae64814c127d520804aca5da8b256546d0a9a752e80fa4df4e",
  "520e685af87659bd015f694c79b7f05b17bf2b9da9586a639ad33f46f0ef1e80",
  "0ef28db85f8cec3c1116edf164f78d3ad8c72986b4688b8bd4321ddccc282a10",
  "51a2cf4d6a635cb7375a65cb6184dd7d07864ab2ddb63c29c1309c8b8c9b6123",
  "641fdd5b007be3edb70ed0a9f773f3b27d020b24db403c949590a67b49cd5dee",
  "ace6bb494fed2822e8a3b6b91d9e3f117e4fafb609edcb6f5fa2ca2a99fa8e98",
  "3dd6397d43caff8a4596aecb734dc684cbe4cc6c5a881e92f0f85152a9182071",
  "d1b6e256036e3c3bcf5f4d9203492b292be6f189c0d2a48cd23ab35707b594f6",
  "6ff861ec8f16dbfd1507dc0efdd073ad8102663970daaa6e8f896ce64e47c4e2",
  "0363c022091ead97260a052cebbedfa9e69ce185c570bfad5e8eab0ec4311b6b",
  "cfa634873e746a804faa87f824feca90dc255ff3fb75f5abc5978f9098fd996d",
  "a628f9637b3e16c6a8294c0c0390d445f3e639b9da0c69aded86c6850c2c6d0e",
  "08dbe26d5e2215e30f9e93738d9202aeb3098bcddcc37f91bd43961d12427ca2",
  "9d96ee04f1fee34abc82c9334ee7f2a3a9477ae613778b8af336c22fe15b3b08",
]
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
  const dotum = face === "HCRDotum" && (width === 970 || width === 959) && outline.upm === 1000
  const number = (face === "Haansoft Batang" || face === "Haansoft-Batang") && width === 1000 && outline.upm === 1024
  if (!dotum && !number) return null
  const signature = createHash("sha256").update(JSON.stringify([outline.upm, width, outline.contours])).digest("hex")
  if (dotum) {
    if (signature === HCR_DOT) return mapPuaText(String.fromCodePoint(0xf02ef))
    const k = HCR_NUMBERS.indexOf(signature)
    return k < 0 ? null : mapPuaText(String.fromCodePoint(0xf02b1 + k))
  }
  const index = BATANG_NUMBERS.indexOf(signature)
  return index < 0 ? null : mapPuaText(String.fromCodePoint(0xf02b1 + index))
}
