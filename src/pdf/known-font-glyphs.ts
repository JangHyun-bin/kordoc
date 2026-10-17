/** 원본 글꼴 문자표와 정확히 일치한 윤곽만 식별한다. 글꼴 파일은 포함하지 않는다. */
import { createHash } from "node:crypto"
import { mapPuaText } from "../shared/pua.js"

export type OutlinePoint = [number, number, boolean]
export interface GlyphOutline { contours: OutlinePoint[][]; upm: number }

/** 지문을 확인한 설치 원본 글꼴 — PDF 글꼴 이름(PostScript 이름 또는 전체 이름) → 비트 */
const FACES: Record<string, number> = {
  "HCRDotum": 1, "HCRDotum-Bold": 2, "HCRBatang": 4, "HCRBatang-Bold": 8,
  "Haansoft Batang": 16, "Haansoft-Batang": 16, "Haansoft Dotum": 32, "Haansoft-Dotum": 32,
}
/**
 * sha256(JSON.stringify([upm, PDF advance(em1000), contours])) 앞 16자리 → [사설 코드, 그 지문이 cmap 에 있는 글꼴 비트].
 * 설치 원본 HANDotum·HANDotumB·HANBatang·HANBatangB·HBatang·HDotum 의 cmap 에서 사각 번호 F02B1~F02B9(①~⑨), 원 번호 F0288~F0291,
 * 가운데점 F02EF, ⊟·⊞ F03A7·F03A8, ■ F031C, 괘선 조각 F0806~F0810 중 공용 PUA 정책이 글로 옮기는 것만 뽑았다.
 * F02BA~ 는 두 자리 번호를 글자 겹치기로 만드는 조각(왼쪽 십의 자리를 든 네모 · 일의 자리 숫자 — 원본 문서는 F02BA + F02C3 = ⑩)이라
 * 한 글리프로 식별하지 않는다. F00DA 는 원본 글꼴 모양(네모 안 "예")이 공용 정책 글과 달라 넣지 않는다. F080F(━)는 쪽 머리·꼬리
 * 장식 줄로 쪽마다 찍힌 문서가 있어(hwp3-sample11) 넣지 않는다.
 */
const KNOWN: Record<string, [number, number]> = {
  "25c7519ef8303490": [0xf0288, 3], // ⓪
  "7a4d4fc73a94fd6f": [0xf0288, 12], // ⓪
  "9ac1486abd17f333": [0xf0288, 16], // ⓪
  "70cd3f569bae37e4": [0xf0288, 32], // ⓪
  "f3fc6c0b35446527": [0xf0289, 3], // ①
  "c8b18f8b6909f7eb": [0xf0289, 12], // ①
  "8eb0a9d7ed539b5a": [0xf0289, 16], // ①
  "ea3a316f2ca28f88": [0xf0289, 32], // ①
  "56308212eb08ddc6": [0xf028a, 3], // ②
  "81526da89b2a83e7": [0xf028a, 12], // ②
  "57c21fc91bbd187a": [0xf028a, 16], // ②
  "0a9a9842c5859d24": [0xf028a, 32], // ②
  "64ef43392a5f4907": [0xf028c, 3], // ④
  "e42417ac350732cd": [0xf028c, 12], // ④
  "0a7304ef03051e39": [0xf028c, 16], // ④
  "38ddce9cc21efe51": [0xf028c, 32], // ④
  "1b8460dc6e7b912c": [0xf028d, 3], // ⑤
  "5f2fe78b05094aec": [0xf028d, 12], // ⑤
  "0d490cbd51284f7e": [0xf028d, 16], // ⑤
  "59cdc6f9196deb3b": [0xf028d, 32], // ⑤
  "a9248e357c6d2f94": [0xf028e, 3], // ⑥
  "14fd2828f84314b2": [0xf028e, 12], // ⑥
  "a374bf3d8ac0390d": [0xf028e, 16], // ⑥
  "9dc030a3d48eab2d": [0xf028e, 32], // ⑥
  "3d4c8ecea5f954a2": [0xf028f, 3], // ⑦
  "011d2e114e023812": [0xf028f, 12], // ⑦
  "dccf0cd2cb2920de": [0xf028f, 16], // ⑦
  "aadf43754e54c718": [0xf028f, 32], // ⑦
  "19f7f2f56a38f6c7": [0xf0290, 3], // ⑧
  "c705ca51164a86fa": [0xf0290, 12], // ⑧
  "f0674c0791905a3b": [0xf0290, 16], // ⑧
  "4c1a5d0e7a2078a2": [0xf0290, 32], // ⑧
  "6171ffd64e69e3c0": [0xf0291, 3], // ⑨
  "7f8640f0b5f6962b": [0xf0291, 12], // ⑨
  "975feebe80392a7a": [0xf0291, 16], // ⑨
  "c713cb5f4a98611e": [0xf0291, 32], // ⑨
  "1b0a094dcfd7aefc": [0xf02b1, 3], // ①
  "75ad8123e5e01977": [0xf02b1, 12], // ①
  "8a4af2cf2dfe3238": [0xf02b1, 16], // ①
  "7828251a7a571442": [0xf02b1, 32], // ①
  "aae8317fb2a0107a": [0xf02b2, 3], // ②
  "b89bc7926f0c3f01": [0xf02b2, 12], // ②
  "7332dcab9d77002b": [0xf02b2, 16], // ②
  "8d74bcf8acd941a3": [0xf02b2, 32], // ②
  "8f24a5ed56b3bf1b": [0xf02b3, 3], // ③
  "4352941ed1545430": [0xf02b3, 12], // ③
  "e7cc725807eae1ae": [0xf02b3, 16], // ③
  "f6a21cbb2b062080": [0xf02b3, 32], // ③
  "9d4c236dfd7b8185": [0xf02b4, 3], // ④
  "04c4fa723908a3fd": [0xf02b4, 12], // ④
  "3956a9db6baa74ef": [0xf02b4, 16], // ④
  "4c850a0e2e079596": [0xf02b4, 32], // ④
  "de1c0ac7276ae7ae": [0xf02b5, 3], // ⑤
  "b153a10aa5d3636c": [0xf02b5, 12], // ⑤
  "8340732dc5f6a75a": [0xf02b5, 16], // ⑤
  "2cfe943ce9a12ec8": [0xf02b5, 32], // ⑤
  "520e685af87659bd": [0xf02b6, 3], // ⑥
  "142011df67c9b44f": [0xf02b6, 12], // ⑥
  "1412a79bd9ed7fdb": [0xf02b6, 16], // ⑥
  "ed6ad4f3954e8ceb": [0xf02b6, 32], // ⑥
  "0ef28db85f8cec3c": [0xf02b7, 3], // ⑦
  "67f0a679b7f2d027": [0xf02b7, 12], // ⑦
  "64760d2273d92363": [0xf02b7, 16], // ⑦
  "f35d358a18f7686a": [0xf02b7, 32], // ⑦
  "51a2cf4d6a635cb7": [0xf02b8, 3], // ⑧
  "a29075d7a2fb6d84": [0xf02b8, 12], // ⑧
  "eb19943ef67624e2": [0xf02b8, 16], // ⑧
  "97311736edcf72f5": [0xf02b8, 32], // ⑧
  "641fdd5b007be3ed": [0xf02b9, 3], // ⑨
  "3302bd6c6a89f170": [0xf02b9, 12], // ⑨
  "c70d5cf181c87ff3": [0xf02b9, 16], // ⑨
  "cfc718a620755cc7": [0xf02b9, 32], // ⑨
  "bb7a2a3ab48d5bfd": [0xf02ef, 3], // ·
  "0def640ab8b3d0dd": [0xf02ef, 12], // ·
  "92cde1460f8b9741": [0xf02ef, 16], // ·
  "bf4a39ce21068bca": [0xf02ef, 32], // ·
  "88bc8d90af006b6e": [0xf031c, 15], // ■
  "aa4c7212192186fa": [0xf031c, 48], // ■
  "4d42e9990c15cced": [0xf03a7, 15], // ⊟
  "6857a6fa443ea10a": [0xf03a7, 48], // ⊟
  "f1aba8be3af5e204": [0xf03a8, 15], // ⊞
  "941878859ff9044f": [0xf03a8, 48], // ⊞
  "0f4a7a4e4706126d": [0xf0806, 15], // ┌
  "75c326411cb5667d": [0xf0806, 48], // ┌
  "dda10d803b819e44": [0xf0807, 15], // ┬
  "5c3d963f00d6c0eb": [0xf0807, 48], // ┬
  "a8ff5c3ff51cfd3d": [0xf0808, 15], // ┐
  "8500249727d63a45": [0xf0808, 48], // ┐
  "8c4b57517c58ee56": [0xf080c, 15], // └
  "a42ba1e406489654": [0xf080c, 48], // └
  "442960c8dfd5e763": [0xf080e, 15], // ┘
  "f1d0f30f61e84248": [0xf080e, 48], // ┘
  "65d24bb2fe5dcf5a": [0xf0810, 15], // │
  "5644629ab371a597": [0xf0810, 48], // │
}
export function knownFontGlyph(name: string | undefined, outline: GlyphOutline, width: unknown): string | null {
  const face = FACES[name?.replace(/^[A-Z]{6}\+/, "") ?? ""]
  if (!face) return null
  const hit = KNOWN[createHash("sha256").update(JSON.stringify([outline.upm, width, outline.contours])).digest("hex").slice(0, 16)]
  return hit && hit[1] & face ? mapPuaText(String.fromCodePoint(hit[0])) : null
}
