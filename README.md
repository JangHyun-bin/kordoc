# kordoc

**모두 파싱해버리겠다.**

[![npm version](https://img.shields.io/npm/v/kordoc.svg)](https://www.npmjs.com/package/kordoc)
[![license](https://img.shields.io/npm/l/kordoc.svg)](LICENSE)

> *대한민국에서 둘째가라면 서러울 문서지옥. 거기서 7년 버틴 공무원이 만들었습니다.*

HWP 3.x·5.x, HWPX, HWPML, PDF, XLS·XLSX, DOCX, PPTX, PNG·JPG·WebP를 Markdown과 구조화 데이터로 변환합니다. 라이브러리·CLI·MCP 서버로 사용할 수 있습니다.

[English](README-EN.md) · [상세 사용법](docs/usage.md) · [벤치마크](docs/benchmarks.md) · [변경 이력](CHANGELOG.md)

- 📊 **PDF 공개 벤치 종합 0.963** — opendataloader-bench 200문서. 공개 12개 파서 비교 1위(2026-09-29 기록). [측정 조건](docs/benchmarks.md)
- 🇰🇷 **한국 공문서 표 구조 100%** — 원본 HWPX 2,429문서의 보이는 표 **10,461개 전부 구조 일치**. [4.22.0 검증](docs/benchmarks.md)

쓸모 있었다면 GitHub ⭐ 하나 눌러주세요. 다른 사람이 이 도구를 찾는 데 도움이 됩니다.

[![Kordoc 활용하기 — 영상 보기](./docs/video-demo.jpg)](https://youtu.be/Q13GmgDcIw0)

<sub>▶ 클릭하면 유튜브에서 재생됩니다.</sub>

**새 영상:** [kordoc 공개벤치 1위 마크](https://youtu.be/9kRbwiTRQLs) · 2026-09-27 · 1분 31초

## 설치

Node.js **20 이상** · macOS / Linux / Windows

```bash
npm install kordoc
```

CLI는 설치 없이 `npx kordoc`으로 실행할 수 있습니다. PDF·OCR 의존성은 기본 설치되며, `--omit=optional`로 제외하면 해당 기능이 제한됩니다.

**AI 에이전트에 연결**

```bash
npx -y kordoc setup
```

Claude Desktop·Claude Code·Cursor·Codex 등 설치된 클라이언트에 MCP를 등록합니다. 클라이언트를 재시작하면 파싱·비교·생성·렌더 등 **17개 도구**를 사용할 수 있습니다.

Claude Code 플러그인:

```text
/plugin marketplace add chrisryugj/kordoc
/plugin install kordoc@kordoc
```

[수동 MCP 등록과 설치 문제 해결](docs/usage.md)

## 빠른 시작

### CLI

```bash
npx kordoc 문서.hwpx -o 문서.md
npx kordoc *.pdf --jobs 4 -d ./결과
npx kordoc 문서.pdf --format json --pages 1-3
npx kordoc 스캔본.pdf --ocr -o 스캔본.md
npx kordoc generate 보고서.md --preset 보고서 -o 보고서.hwpx
npx kordoc fill --template gian -j 값.json -o 기안문.hwpx
```

`--jobs`는 파일 단위 병렬 변환이며 메모리 사용도 늘어납니다. [병렬 변환 안내](docs/parallel-batch.md)

보고서·계획서·개조식·서울방침은 `#` 제목 바로 뒤 인용문(`> …하고자 함`)이 요약 상자가 됩니다(개조식은 표지가 있을 때(기본) 본문 첫 쪽 제목 상자 아래 — `cover:false` 면 첫 `#` 이 장 머리라 인용문은 ※ 참고). 보고 목적 한 문장(쉼표 허용) 3줄 이내로 쓰고, 넘거나 두 문장 이상이면 경고합니다. 업무보고는 `> ▪ …` 인용문이 자리와 관계없이 성과 요약 상자가 됩니다.

### JavaScript / TypeScript

```typescript
import { parse, markdownToHwpx } from "kordoc"
import { writeFile } from "node:fs/promises"

const result = await parse("문서.hwpx")
if (result.success) {
  console.log(result.markdown)
  // result.blocks: 구조화 데이터, result.metadata: 문서 정보
}

const hwpx = await markdownToHwpx("# 추진계획\n\n본문", {
  gongmun: { preset: "보고서" },
})
await writeFile("보고서.hwpx", Buffer.from(hwpx))
```

[파싱 옵션·API·양식·렌더 예제](docs/usage.md#-빠른-시작)

## 주요 기능

| 작업 | 기능 |
| --- | --- |
| 읽기 | 문서 → Markdown·IR·쪽별 본문·RAG 청크, 로컬 OCR |
| 비교·편집 | 블록·셀 단위 비교, HWPX·HWP 서식 보존 패치 |
| 작성 | Markdown → HWPX, 공문서 프리셋, 표·수식·차트 |
| 양식 | 필드·누름틀 채우기, 표준 기안문 2종, 도장 날인 |
| 검토 | HWPX·HWP 미리보기·영역 추출, 구조·표기법 검사, 개인정보 마스킹 |

서식 보존 패치용 Markdown은 `--keep-layout-tables`로 추출합니다. 적용하지 못한 편집은 건너뛴 사유로 보고합니다. [CLI·API 상세](docs/usage.md#-cli)

## 검증 결과

**4.22.6 · 2026-10-18 검증**. 고정 코퍼스와 참조 기준으로 측정한 결과입니다.

| 대상 | 규모 | 결과 |
| --- | --- | --- |
| HWPX | 2,424문서 · 10,342표 | 표 구조 일치 **10,342/10,342 · 100%** |
| HWP 5.x ↔ HWPX | 1,130쌍 · 4,315표 | 짝 문서의 표 구조 일치 **100%** |
| PDF 글 | 744쌍 | 글자 재현율 **99.879%** · 정확도 **99.670%** · 읽기 순서 **99.247%** · 어절 F1 **99.049%** |
| PDF 표 | 708쌍 · 2,331표 | 표 탐지 **99.87%** · 구조 일치 **98.16%** · 칸 F1 **0.9918** |
| HWPX 재조판 | 다중줄 25,187문단 (12개 폴더) | 모든 줄 시작 일치 **24,938/25,187 · 99.01%** |
| PDF 중첩표 (텍스트층) | 29문서 · 101표 | 구조·칸 내용 **101/101 · 100%** |
| 법령 별표 | 272건 · 346표 | HWP **346/346**, PDF **342/346 · 98.84%** |
| PDF 전체 | 1,911문서 중 1,729건 채점 | 글 커버리지 **99.80%** |
| OCR | 53문서 · 102쪽 | CER **0.0409** · 글자 재현율 **99.02%** |

표 구조 점수와 셀 내용·화면 재현은 별도 지표입니다. 중첩표 100%는 위 101표에 한정하며 전체 PDF·조판의 완전 일치를 뜻하지 않습니다. 채점 범위·제외 기준·전 벤치 문서별 비교는 [벤치마크 상세](docs/benchmarks.md)에 있습니다.

**4.22.6 개선 검증(2026-10-18)**: 4.22.5와 같은 채점기·코퍼스로 다시 잰 결과 PDF 글 재현율 **0.99872→0.99879**, 띄어쓰기 F1 **0.99037→0.99049**, 표 셀 내용 완전 일치 **0.990677→0.991321**, 조판(12개 폴더 저장본 대조) 본문 첫 줄 위치 **76,443→76,525/78,375문단**, 표 칸 첫 줄 위치 **204,869→204,958/205,304**로 개선했습니다. 글자 겹치기 번호와 한컴 번호 PUA를 HWPX·HWP·PDF에서 같은 원 숫자로 내고 PDF의 유니코드 없는 한컴 글꼴 기호를 되살렸으며, 손글씨 인식 모델 프리셋(`ocrRec: "handwriting"`)을 더했습니다. PDF 표·별표·왕복은 문서별 하락 0, PDF 글은 4문서가 소폭 내렸습니다(반전 사각형 번호 등, [상세](docs/benchmarks.md)).

빈 행을 접을 때 기존 논리 격자 안의 병합 모서리 셀을 보존합니다. 재현 PDF의 번호 기호 6종은 복원했으며, HTML 선 출력과 미등록 글꼴 기호는 [남은 한계](docs/parsing-loss-reproductions.md)로 기록했습니다.

외부 PDF 벤치 **opendataloader-bench 200문서**는 4.22.6 배포 후보의 동일 코퍼스 재검증에서 기본값 종합 **0.963**, OCR 끔 **0.939**입니다. [옵션별 결과와 재현 방법](docs/benchmarks.md#pdf--markdown--opendataloader-bench)

## 최근 업데이트

최신 배포: **[4.22.6](https://github.com/chrisryugj/kordoc/releases/tag/v4.22.6)** · 2026-10-18

| 버전 | 주요 변경 |
| --- | --- |
| 4.22.6 | 손글씨 OCR 모델 프리셋(#164), 글자 겹치기 원 번호·한컴 번호 PUA 를 HWPX·HWP·PDF 에서 같게, PDF 한컴 글꼴 기호 복원, 칸 나눔 표·종이 기준 그림·옮긴 문단 조판 보정 — 본문 첫 줄 위치 76,443 → 76,525, 표 칸 204,869 → 204,958 |
| 4.22.5 | 0폭 탭·기호 폭·글머리표 예약·표 분할·줄 높이 보정, PDF 부분 셀 병합·본문 절 제목·누락 기호 복원 |
| 4.22.4 | 그림·테두리·공백·세로쓰기 기준선·따옴표 조판 보정, PDF 글머리 칸·주석·양식 제목·쪽 경계 목록 행 복원 |
| 4.22.3 | 넘친 표 점유 높이·그림 옆 줄 조각·선택 하이픈 조판 개선, PDF 감싸개 안 표 이어짐과 반복 자료행 복원, 빈 행을 접을 때 병합 모서리 셀 보존 |
| 4.22.2 | 부분 편집 문단 위치·그림 어울림·고정폭 빈칸 조판 개선, PDF 독립 제목·번호 행 보존 및 연락처·음영 행 내용 복원 |
| 4.22.1 | 텍스트층 PDF의 그림 영역 OCR에서 회전 보정·고해상도 재인식 좌표 혼합 수정. 전체 스캔의 기울기 보정 유지 |
| 4.22.0 | PDF 중첩표 94/101 → 101/101, 쪽 경계 셀·HWP 캡션·표 칸 안 각주 보존. OCR 줄 좌표·모델 선택 추가, 수식 OCR 설치 경량화 |
| 4.21.33 | 미주 단 흐름, 갈리는 표의 각주, 칸 간격 — 본문 줄 위치 일치 95.9% → 97.5%, 표 칸 99.5% → 99.7% |
| 4.21.32 | 렌더·reflow 쪽 배치 개선 — 쪽을 넘는 표 칸과 떠 있는 개체. 표 칸 줄 위치 일치 97.4% → 99.5%, 본문 87.2% → 95.9% |
| 4.21.31 | 렌더·reflow 조판 일치, 각주 안 표 구조 보존(#149), 인라인 수식 옵션(#150), 보안 점검 반영 |
| 4.21.23 | HWP·HWPX 그림 속 글 OCR(`ocr: true`, #143) |
| 4.21.0 | 중앙부처 기관 서식 `--agency`, 보도자료 담당 표 |

OCR 줄의 상자·신뢰도는 `--ocr --ocr-lines --format json`으로 받습니다. `--ocr-det`·`--ocr-det-long-side`로 검출 모델과 해상도를 선택할 수 있습니다. [OCR 줄·모델 사용법](docs/usage.md#ocr-줄모델-선택)

버전별 상세는 [변경 이력](CHANGELOG.md)에 있습니다.

## 자주 묻는 질문

**Q. HWP·HWPX 파일을 Markdown으로 바꾸려면?**
`npx kordoc 문서.hwp -o 문서.md` 한 줄입니다. 한컴오피스 없이 파일을 직접 읽으며, 여러 파일은 `npx kordoc *.hwpx -d ./output`으로 한 번에 바꿉니다.

**Q. Claude·Cursor 같은 AI가 한글 문서를 읽게 하려면?**
`npx -y kordoc setup`으로 MCP를 등록하면 AI가 파일 경로만 받아 HWP·PDF·엑셀을 읽고, 비교하고, 양식을 채웁니다.

**Q. 인터넷이 막힌 폐쇄망에서도 되나요?**
됩니다. `KORDOC_OFFLINE=1`이 외부 통신을 모두 막고, OCR도 API 키 없이 로컬 CPU에서 돕니다. [폐쇄망 설치](docs/offline-deployment.md)

**Q. RAG 색인용으로 쓸 수 있나요?**
`--format chunks`가 제목 경로를 붙인 구조 청크와 독립 표 청크를 냅니다. 표를 HTML 없이 받으려면 `--table-format gfm`(API는 `tableFormat: "gfm"`)을 씁니다. Python·Java에서는 [Python SDK](sdk/python/README.md)·[Java SDK](sdk/java/README.md)로 부릅니다.

## 문서·보안

- [상세 사용법](docs/usage.md): 전체 CLI·MCP 도구·API·지원 포맷
- [Java SDK](sdk/java/README.md) · [Python SDK](sdk/python/README.md): 상주 엔진 워커로 Java·Python 시스템에서 파싱 ([워커 프로토콜](docs/parse-worker-protocol.md))
- [공문서 생성 가이드](docs/gongmunseo-engine-spec.md) · [아키텍처](docs/architecture.md)
- [폐쇄망 설치](docs/offline-deployment.md): `KORDOC_OFFLINE=1`, MCP 접근 범위 `KORDOC_ROOT`
- [보안 정책](SECURITY.md) · [라이선스 MIT](LICENSE) · [오픈소스 고지](NOTICE)

## 만든 사람

대한민국 지방공무원. 광진구청에서 7년간 HWP 파일과 싸우다가 이걸 만들었습니다. 5개 공공 프로젝트에서 수천 건의 실제 관공서 문서를 파싱하며 검증했습니다.
