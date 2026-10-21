/**
 * 부서 서식 견본으로 새 문서 만들기 (generate --template) — 견본은 kordoc 이 직접 만든 합성 문서(서울방침 프리셋:
 * 제목표·담당 줄·요약 상자·장 상자·□ㅇ-▸※·데이터 표·참고 띠). 실제 부서 문서는 저장소에 두지 않는다.
 */

import { describe, it, before } from "node:test"
import assert from "node:assert/strict"
import JSZip from "jszip"
import { markdownToHwpx } from "../src/index.js"
import { validateHwpx } from "../src/validate.js"
import { scanTemplate } from "../src/hwpx/gen-from-template.js"
import { lineRole } from "../src/hwpx/template-scan.js"
import { registerGenerateTools } from "../src/mcp/tools-generate.js"

const TEMPLATE_MD = `# 견본 사업 추진계획

일자리정책과장 : 김견본 ☎1111 담당 : 이견본 ☎2222

> 견본 사업을 체계적으로 추진하기 위한 계획을 수립하고자 함

## 추진배경

□ 견본 현황

ㅇ 견본 제도 시행에 따른 후속 조치 필요

- 견본 지침 개정

▸ 견본 세부 지침

※ 견본 참고 문구

| 구분 | 견본내용 | 비고 |
| --- | --- | --- |
| 가 | 견본 하나 | 1 |
| 나 | 견본 둘 | 2 |
| 다 | 견본 셋 | 3 |

| 참고1 | 견본 참고 자료 |

ㅇ 견본 참고 항목
`

const NEW_MD = `# 스마트 행정 시범사업 계획

2026. 10. 21.(수) 스마트정보과장 : 홍길동 ☎1234 담당 : 김담당 ☎5678

> 시범사업으로 행정 업무를 개선하고자 함

## 현황

□ 새 현황

ㅇ 새 첫째 항목

- 새 세부 내용

· 새 넷째 단계

※ 새 참고 문구

| 항목 | 1분기 | 2분기 | 3분기 | 비고 |
| --- | --- | --- | --- | --- |
| 준비 | 계획 | 계약 | - | 내부 |
| 운영 | - | 시범 | 확대 | 외부 |

## 참고2 관련 법령

ㅇ 새 참고 항목
`

const entry = async (buf: ArrayBuffer | Uint8Array, name: string) => (await JSZip.loadAsync(buf)).file(name)!.async("text")
/** 새 글이 든 최상위 문단 — 문단 여는 태그와 그 글을 담은 run 의 charPr */
function paraOf(sec: string, text: string): { paraPr: string; charPr: string } {
  const i = sec.indexOf(text)
  assert.ok(i >= 0, `본문에 "${text}" 없음`)
  const pOpen = sec.lastIndexOf("<hp:p ", i)
  const run = sec.lastIndexOf("<hp:run ", i)
  return { paraPr: /paraPrIDRef="(\d+)"/.exec(sec.slice(pOpen))![1], charPr: /charPrIDRef="(\d+)"/.exec(sec.slice(run))![1] }
}

describe("generate --template (부서 서식 견본)", () => {
  let tpl: ArrayBuffer
  let out: ArrayBuffer
  let tplSec: string, outSec: string, tplHead: string, outHead: string
  const warnings: string[] = []

  before(async () => {
    tpl = await markdownToHwpx(TEMPLATE_MD, { gongmun: { preset: "서울방침" } })
    out = await markdownToHwpx(NEW_MD, { template: tpl, warnings })
    tplSec = await entry(tpl, "Contents/section0.xml")
    outSec = await entry(out, "Contents/section0.xml")
    tplHead = await entry(tpl, "Contents/header.xml")
    outHead = await entry(out, "Contents/header.xml")
  })

  it("견본 역할 판정 — 제목표(담당 줄 칸 포함)·요약 상자·장 띠·참고 띠·데이터 표·□ㅇ-▸·※", () => {
    const scan = scanTemplate(tplSec, tplHead)
    for (const role of ["title", "summary", "chapter", "band", "table", "L0", "L1", "L2", "L3", "ref"]) {
      assert.ok(scan.protos.has(role as never), `역할 ${role} 없음 — ${[...scan.protos.keys()].join(",")}`)
    }
    assert.equal(scan.contactInTitle, true)
    assert.match(scan.head, /<hp:secPr\b/)
    // 한컴 PUA 글머리(󰏚)도 □ 로 본다
    assert.equal(lineRole("\u{F03DA} 현   황"), "L0")
    assert.equal(lineRole("  ○ 내용"), "L1")
    assert.equal(lineRole("▶ 관련 법령"), "sym:▶")
    assert.equal(lineRole("ㅇ이응으로 시작하는 낱말"), null)
  })

  it("검증 통과 — mimetype 무압축 첫 엔트리, 구역 정의 하나, 줄 배치 캐시 없음, header 그대로", async () => {
    const v = await validateHwpx(out)
    assert.ok(v.ok, JSON.stringify(v.issues))
    const b = new Uint8Array(out)
    assert.deepEqual([...b.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04])
    assert.equal(b[8] | (b[9] << 8), 0, "mimetype 은 STORE")
    assert.equal(new TextDecoder().decode(b.slice(30, 30 + (b[26] | (b[27] << 8)))), "mimetype")
    assert.equal(outSec.match(/<hp:secPr\b/g)?.length, 1)
    assert.doesNotMatch(outSec, /linesegarray/)
    assert.equal(outHead, tplHead, "견본 header.xml 의 글자·문단 모양 id 는 손대지 않는다")
  })

  it("견본 글은 남지 않고 새 내용만", () => {
    assert.doesNotMatch(outSec, /견본|김견본|☎1111/)
    for (const t of ["스마트 행정 시범사업 계획", "시범사업으로 행정 업무를 개선하고자 함", "새 첫째 항목", "관련 법령", "참고2"]) assert.ok(outSec.includes(t), t)
  })

  it("단계별 문단 모양·글자 모양이 견본과 같다 (□ ㅇ - ▸ ※)", () => {
    const pairs: Array<[string, string]> = [["견본 현황", "새 현황"], ["견본 제도 시행에 따른 후속 조치 필요", "새 첫째 항목"],
      ["견본 지침 개정", "새 세부 내용"], ["견본 세부 지침", "새 넷째 단계"], ["견본 참고 문구", "새 참고 문구"]]
    for (const [a, b] of pairs) assert.deepEqual(paraOf(outSec, b), paraOf(tplSec, a), `${a} ↔ ${b}`)
    // 부호 글자는 견본 것 (원고의 · 대신 견본 4단계 ▸)
    assert.match(outSec, /▸[^<]*<hp:tab[^>]*\/><\/hp:t><\/hp:run><hp:run charPrIDRef="\d+"><hp:t>새 넷째 단계/)
  })

  it("제목표 — 제목 칸 글자 모양 유지, 담당 줄 칸에 새 ☎ 줄", () => {
    assert.deepEqual(paraOf(outSec, "스마트 행정 시범사업 계획"), paraOf(tplSec, "견본 사업 추진계획"))
    assert.match(outSec, /2026\. 10\.(?: |<hp:nbSpace\/>)21\.\(수\) {1,2}스마트정보과장 : 홍길동 ☎1234 {1,2}담당 : 김담당 ☎5678/)
  })

  it("표 — 원고 열 수(5)로 짜고 머리행·본문 칸 테두리는 견본 표 칸 것, 열 너비 합 = 견본 표 폭", async () => {
    const tbl = /<hp:tbl\b[^>]*rowCnt="3" colCnt="5"[^>]*>[\s\S]*?<\/hp:tbl>/.exec(outSec)?.[0]
    assert.ok(tbl, "3×5 표 없음")
    const tplTbl = /<hp:tbl\b[^>]*rowCnt="4" colCnt="3"[^>]*>[\s\S]*?<\/hp:tbl>/.exec(tplSec)![0]
    const bf = (x: string) => [...x.matchAll(/<hp:tc\b[^>]*borderFillIDRef="(\d+)"/g)].map((m) => m[1])
    const tplBf = bf(tplTbl), outBf = bf(tbl!)
    assert.equal(outBf[0], tplBf[0], "머리행 첫 칸")
    assert.equal(outBf[4], tplBf[2], "머리행 끝 칸")
    assert.equal(outBf[5], tplBf[3], "본문 첫 칸")
    const width = (x: string) => Number(/<hp:sz width="(\d+)"/.exec(x)![1])
    assert.equal(width(tbl!), width(tplTbl))
    const row0 = [...tbl!.split("</hp:tr>")[0].matchAll(/<hp:cellSz width="(\d+)"/g)].reduce((a, m) => a + Number(m[1]), 0)
    assert.equal(row0, width(tplTbl))
  })

  it("장 띠·참고 띠 — 견본 띠 표를 복제해 번호·제목만 바꾼다", () => {
    assert.match(outSec, /<hp:t>Ⅰ<\/hp:t>[\s\S]*?<hp:t>현황<\/hp:t>/)
    assert.match(outSec, /<hp:t>참고2<\/hp:t>[\s\S]*?<hp:t>관련 법령<\/hp:t>/)
  })

  it("개체 id·instid 는 문서 안에서 유일하다", () => {
    const ids = [...outSec.matchAll(/<hp:(?:tbl|pic|rect|container)\b[^>]*\bid="(\d+)"/g)].map((m) => m[1])
    assert.ok(ids.length >= 5)
    assert.equal(new Set(ids).size, ids.length)
  })

  it("원고에 담당 줄이 없으면 견본 담당 칸은 비운다 (견본 담당자 정보가 새 문서에 남지 않게)", async () => {
    const buf = await markdownToHwpx("# 제목만\n\n□ 항목\n", { template: tpl })
    const sec = await entry(buf, "Contents/section0.xml")
    assert.doesNotMatch(sec, /☎|김견본/)
    assert.ok(sec.includes("제목만"))
  })

  it("표 원형이 없는 견본 — header 에 실선 테두리 하나만 덧붙여 기본 표", async () => {
    const plainTpl = await markdownToHwpx("# 표 없는 견본\n\n□ 견본 항목\n\nㅇ 견본 둘째\n", { gongmun: { preset: "서울방침" } })
    const w: string[] = []
    const buf = await markdownToHwpx("# 새 문서\n\n□ 항목\n\n| 가 | 나 |\n| --- | --- |\n| 1 | 2 |\n", { template: plainTpl, warnings: w })
    assert.ok((await validateHwpx(buf)).ok)
    const head0 = await entry(plainTpl, "Contents/header.xml"), head1 = await entry(buf, "Contents/header.xml")
    assert.equal((head1.match(/<hh:borderFill\b/g)?.length ?? 0) - (head0.match(/<hh:borderFill\b/g)?.length ?? 0), 1)
    assert.ok(w.some((x) => x.includes("데이터 표")), w.join(" / "))
  })

  it("합계 행 — 견본 모드 기본은 원고 그대로(keep), totalRow: top 이면 머리행 바로 아래", async () => {
    const md = "# 표\n\n| 구분 | 금액 |\n| --- | --- |\n| 가 | 1 |\n| 나 | 2 |\n| 합계 | 3 |\n"
    const order = async (o: { totalRow?: "top" }) => {
      const sec = await entry(await markdownToHwpx(md, { template: tpl, ...o }), "Contents/section0.xml")
      return [...sec.matchAll(/<hp:t>(가|나|합계)<\/hp:t>/g)].map((m) => m[1]).join(",")
    }
    assert.equal(await order({}), "가,나,합계")
    assert.equal(await order({ totalRow: "top" }), "합계,가,나")
  })

  it("구역이 둘인 견본 — 첫 구역만 쓰고 manifest·spine·secCnt 를 함께 맞춘다", async () => {
    const z = await JSZip.loadAsync(tpl)
    z.file("Contents/section1.xml", tplSec)
    let hpf = await z.file("Contents/content.hpf")!.async("text")
    hpf = hpf.replace(/(<opf:item\b[^>]*\bid="section0"[^>]*\/>)/, `$1<opf:item id="section1" href="Contents/section1.xml" media-type="application/xml"/>`)
      .replace(/(<opf:itemref\b[^>]*\bidref="section0"[^>]*\/>)/, `$1<opf:itemref idref="section1" linear="yes"/>`)
    z.file("Contents/content.hpf", hpf)
    z.file("Contents/header.xml", tplHead.replace(/\bsecCnt="\d+"/, "secCnt=\"2\""))
    assert.match(hpf, /idref="section1"/, "견본 조립 확인")
    const w: string[] = []
    const buf = await markdownToHwpx("# 새 문서\n\n□ 항목\n", { template: await z.generateAsync({ type: "uint8array" }), warnings: w })
    assert.ok((await validateHwpx(buf)).ok)
    const outHpf = await entry(buf, "Contents/content.hpf")
    assert.doesNotMatch(outHpf, /section1/)
    assert.match(outHpf, /idref="section0"/)
    assert.match(await entry(buf, "Contents/header.xml"), /secCnt="1"/)
    assert.ok(w.some((x) => x.includes("첫 구역")))
  })

  it("서식 옵션과 함께 쓰면 오류 (라이브러리·MCP)", async () => {
    await assert.rejects(markdownToHwpx("# x", { template: tpl, gongmun: { preset: "보고서" } }), /template.*gongmun/)
    let callback: any
    registerGenerateTools({ tool(name: string, ...args: any[]) { if (name === "generate_document") callback = args.at(-1) } } as any)
    const r = await callback({ markdown: "# x", output_path: "C:/nowhere/x.hwpx", template_path: "C:/nowhere/t.hwpx", preset: "보고서" })
    assert.ok(r.isError)
    assert.match(r.content[0].text, /견본\(template\)은 preset/)
  })
})
