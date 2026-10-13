# 인계: 렌더·reflow 한컴 조판 맞추기 — 맥 이어가기 (2026-10-14, 윈도 세션 결과)

목표: kordoc 렌더(`src/render/svg-render.ts`·`table-pages.ts`)와 reflow(`src/render/reflow.ts`·`src/hwpx/text-metrics.ts`·`font-metrics.ts`)를
한컴 조판(저장본 linesegarray·한컴 PDF)과 100% 같게.

## 작업 규칙 (사용자 지시)

- 사이클마다 **커밋 + main 직접 푸시만**. 버전업·npm 게시·릴리스 금지(요청 있을 때만).
- 테스트 → tsc → tsup → 게이트 → 커밋 → 푸시를 `&&` 로만 잇기. push 는 파이프 없이 exit code 확인.
- 커밋 메시지 수치는 실측한 것만(예측값 금지).
- 커밋 메시지·주석·문서에 조판 규칙을 **어디서 어떻게 알아냈는지(출처)를 쓰지 않는다**. "한컴 저장본·PDF 와 맞춤" 같은 결과·규칙 서술만.
- 응답은 한국어 반말.

## 현재 수치 (main, kordoc 소스는 윈도 세션에서 바꾸지 않음 — 윈도에서 같은 값 재현 확인)

| 지표 | 값 |
|---|---|
| 렌더 쪽 수 = 한컴 PDF 쪽 수 (짝 1,128) | 1,126 |
| reflow 두 줄+ 문단 줄 시작 전부 일치 (12 코퍼스) | 24,318 / 25,187 (96.55%) |
| reflow 문단 줄 수 일치 | 306,293 / 306,744 |
| 렌더 글 조각 위치 PDF ±1.5pt | 23,340 / 24,049 (97.1%) |
| 렌더 그림 위치 PDF ±2pt | 3,551 / 3,685 (96.4%) |

## 윈도 세션에서 확정한 사실

1. **윈도 한글 2024 = 저장본 조판 엔진**(글꼴이 다 있을 때). 틀린 문서 204 + 다 맞는 문서 100(대조군)의 줄 정보를 지우고 한글이 다시 조판해 저장:
   대조군 두 줄+ 1,019문단 **100%** 저장본과 같은 줄 시작. 빠진 글꼴(KoPub바탕체·문체부·서울남산체·나눔바른고딕 등 문서 글꼴 20종)을 설치하고 다시 조판하니
   304문서 전체 저장본 일치 89.52% → **97.02%**(17,059 중 16,550). 남은 차이 509문단 중 328 은 아직 없는 글꼴(윤고딕·윤명조 1xx — 상용,
   Helvetica·Apple SD 산돌고딕 Neo — Apple, 정부상징 부처명 — 기관 전용, 08서울남산체·08서울한강체 — 2008 원판 미배포) 문서,
   181 은 글꼴이 다 있는데도 다름(`SO-SUEOP` 118 등 — 저장본이 다른 환경 조판).
   같은 304문서에서 우리 reflow: 저장본 대비 94.91%, 윈도 재조판 대비 95.14%.
2. **글자 폭 = 4·MulDiv(글꼴 폭, ⌊크기/4⌋, unitsPerEm)** 이 TTF hmtx 와 그대로 맞는다(바탕 10pt·40pt 96자 전부).
   40pt 탐침의 PDF 좌표는 0.99945 배로 줄어 찍힌다(되돌리면 정확).
3. 문서 안 영문 이름 `Batang` 은 윈도 한글에서 batang.ttc(=바탕) 폭으로 찍힌다(숫자 596). 그러나 `"Batang": PDFFIT_바탕` 실험은 Batang 문단 74→78, 전체 변화 없음 →
   Batang 문서 저장본은 다른 폭으로 조판된 것(다른 환경 저장 의심). FIT_Batang 은 그대로 둔다.
4. 글꼴에 없는 글자는 한컴바탕(Haansoft Batang)·HCR·Wingdings·SegoeUISymbol 등으로 대체돼 찍힌다 — 탐침 결과에 글자별 실제 PDF 글꼴이 있다.
5. 한컴 비공개 글꼴(휴먼명조·한컴바탕·한컴 윤고딕 2xx·HY 계열 등)은 윈도 글꼴 등록 없이 `HOffice130\Shared\TTF\{All,Hwp}` 에 있다(목록 `Bin\FontDB\PrivateFontList.ini`).
   HFT 글꼴은 `HOffice130\Shared\Fonts`(이름 → 파일: `Bin\FontDB\hftinfo.dat`). 유형이 TTF 라도 그 이름 TTF 가 없으면 같은 이름 HFT 로 찍힌다(한양신명조 등).
6. 이 PC 의 문서보안 에이전트가 한글의 HWPX/HWP 저장을 "범주 정보를 찾을 수 없습니다" 알림으로 멈춘다 → `close-drm-alerts.ps1` 이 닫는다(파일은 평문 그대로).

## 맥에 옮긴 데이터 (`.claude/win-data/`, git 밖)

| 경로 | 내용 |
|---|---|
| `oracle/widths.json` | 글꼴 156종 × 코퍼스에 쓰인 글자 — 한글이 쓴 폭(HWPUNIT, 40pt → /4 = em×1000)과 글자별 실제 PDF 글꼴 |
| `oracle/cmp.txt` | 위 폭 ↔ 우리 `hancomCharWidth` 글꼴별 다른 글자 수(빈도순) |
| `oracle/faces.json` · `face-files.json` | 글꼴(이름\|유형)별 글자·빈도 / 이 PC 의 글꼴 파일(없는 글꼴 32종은 file=null — 그 글꼴 탐침 값은 대체 글꼴 폭이라 쓰면 안 됨. `Noto Serif KR Light` 는 한글이 ExtraLight 로 찍어 의심) |
| `oracle/probe/` | 탐침 HWPX·PDF(`index.json`: 번호 → 글꼴·글자) |
| `oracle/relayout-out/` | 윈도 한글 재조판 HWPX 304개(`index.json`: 번호 → 원본 코퍼스 경로, 앞 204 = 틀린 문서, 뒤 100 = 대조군) |
| `oracle/pair.json` | 저장본 ↔ 윈도 재조판 문단별 대조(다른 문단의 두 textpos 와 글) |
| `oracle/perfile*.json` · `reflow-*.txt` | 우리 reflow 문서별 결과(코퍼스 전체 / 윈도 재조판 정답 / 같은 304 원본) |
| `oracle/variants/` | 크기 9~15pt·장평 90~105·자간 −10~+5 변형 탐침(상위 글꼴 13종) — 결과는 아래 |
| `winfonts/` · `winfonts-add/` · `hnc/` | 코퍼스가 쓰는 윈도 글꼴 30개, 윈도에 추가 설치한 글꼴 33개(공식 배포처·맥 사본), 한컴 비공개 TTF·HFT |
| `oracle/pair-v1.json` · `widths-v1.json` | 글꼴 추가 설치 전 결과(비교용) |

## 측정 도구 (`bench/layout/`)

```bash
D="seoul seoul2 seoul-old review korea-kr-pairs korea-kr-pairs2 licbyl licbyl2 rhwp gate-fill gate-fill3 korea-kr"
node --import tsx bench/layout/reflow-cmp.mts $(for d in $D; do echo bench/corpus/$d; done)   # PERFILE=out.json 문서별
node --import tsx bench/layout/width-probe-cmp.mts .claude/win-data/oracle/widths.json .claude/win-data/oracle/faces.json   # DUMP='휴먼명조|TTF|4000|100|0'
python bench/layout/lineseg-pair.py 재조판폴더 출력폴더 out.json          # 저장본 ↔ 재조판 문단 대조
node --import tsx bench/layout/reflow-cmp.mts .claude/win-data/oracle/relayout-out   # 윈도 재조판을 정답으로
```

윈도 전용(한글 COM): `face-chars.py`(글꼴별 글자) → `width-probe-gen.py`(탐침 HWPX, `PROBE_H/RATIO/SPACING/FACES`) → `batch-pdf.sh`(PDF, `FORMAT=HWPX OUT=` 면 재조판 저장)
→ `width-probe-read.py`(폭 json). 재조판은 `strip-lineseg.py` 로 줄 정보 지운 사본을 만든다. `face-files.py` 는 글꼴 이름 → 파일.
기존: `pagecount.mts`·`textpos.mts`·`imgpos.mts`·`pdf-spans.py`·`pdf-imgs.py`(사용법 각 파일 머리).

## 맥에서 할 일 (순서대로)

1. **폭표 교정**: `width-probe-cmp` 로 글꼴별 다른 글자를 뽑아 폭표(`font-metrics.ts`·`hft-latin-widths.ts`)에 반영. 빈도 큰 글꼴부터
   (명조 HFT 8 · 바탕 58 · 맑은 고딕 86 · 휴먼명조 TTF 32 · 한양신명조 HFT 19 · 돋움 56 · KoPub바탕체 Light 78 · 함초롬바탕 13 · KoPub돋움체 Light 23 · HYSinMyeongJo-Medium 55).
   PDF 글꼴이 다른 글자(대체)는 그 글꼴 표가 아니라 대체 폭 규칙(`HANCOM_FALLBACK_W`)의 문제다. 각 수정은 reflow-cmp 전 코퍼스 전→후로만 채택.
   `face-files.json` 에서 file=null 인 글꼴은 탐침 값이 대체 글꼴 폭이라 제외(KoPub바탕체·윤고딕 1xx·서울남산체 등).
2. **변형 탐침**으로 크기·장평·자간 양자화 산식 확인(아래 결과). 산식이 맞으면 남은 폭 차이는 순수 폭표 문제다.
3. **틀린 869문단 3자 분류**: `pair.json`(윈도 = 저장?) × 우리 결과. 윈도 = 저장인데 우리만 다른 문단이 고칠 대상.
   윈도 ≠ 저장 문단(글꼴 없음·다른 환경 저장)은 저장본을 정답으로 맞추려 하지 말 것.
4. 남은 쪽 수 2건·렌더 글/그림 위치는 아래 "남은 것" 그대로.

## 윈도 PC 가 다시 필요한 것

- 아직 없는 글꼴(윤고딕·윤명조 1xx·3xx — `-윤고딕130` 은 304문서 중 94개가 씀, 정부상징 부처명, 08서울남산체 원판)을 구하면 설치(`bench/layout/install-fonts.py`) 후 해당 문서 재조판.
- 규칙 실험: 사본에서 의심 규칙 하나만 바꿔(공백 최소값·자간·금칙 문자·칸 여백 등) `FORMAT=HWPX` 로 재조판 → 줄 시작 비교. 문서당 약 6초.
- 맥에서 원격으로 쓰려면 윈도에 OpenSSH 서버가 필요(관리자 권한 설치, 미설치).

## 변형 탐침 결과 (`oracle/widths-variants.json`·`cmp-variants.txt`)

상위 글꼴 13종 × (9·10·11·12·13·15pt / 11pt 장평 90·95·105 / 11pt 자간 −10·−5·+5 / 11pt 장평 95·자간 −5) — 우리 `hancomCharWidth` 와 ±2 넘게 다른 글자 수:

| 글꼴 | 범위 | | 글꼴 | 범위 |
|---|---|---|---|---|
| 명조 HFT | 8 (전 조합 같음) | | 돋움체 | 6~8 |
| 바탕 | 11~32 | | 돋움 | 6~22 |
| 맑은 고딕 | 86~99 | | 함초롬바탕 | 13~14 |
| 휴먼명조 TTF | 33~41 | | 고딕 HFT | 5 |
| 굴림체 | 0~1 | | 한양중고딕 HFT | 5~6 |
| 한양신명조 HFT | 19~21 | | 휴먼명조 HFT | 1 |
| Batang | 82~85 | | | |

크기·장평·자간을 바꿔도 다른 글자 수가 거의 그대로다 → **양자화·장평·자간 산식은 맞고, 남은 차이는 특정 글자의 폭 값(또는 대체 글꼴 폭)**.
바탕·돋움처럼 크기마다 수가 흔들리는 글꼴은 em 값이 반올림 경계 근처라 크기마다 드러나는 글자가 다른 것 — 40pt 값(=em×1000)으로 표를 고치면 된다.

## 남은 것

- **쪽 수 2건**: `156775700`(HWPX 에 PDF 의 통계표 24쪽이 아예 없음 — 못 맞춤) / `6902633`(문서 끝 빈 문단이 표가 거의 꽉 찬 쪽 다음에
  저장 vertpos 0 으로 넘어감 — PDF 는 빈 2쪽을 찍음). 끝 빈 쪽 버림 규칙(svg-render.ts "문서 끝의 빈 문단만 든 쪽")을
  "쪽 나누기 걸림 또는 앞 줄이 본문 바닥을 넘침" 일 때만으로 좁히면 6902633 은 맞지만 rhwp `table_text_anchor_wrap`(PDF 3쪽)이 4쪽이 된다 — 둘을 가르는 조건 미확인.
- **reflow**: 줄 시작 차이 869곳. 대부분 ±1~2자 글자 폭 문제 → 위 1번. hwp3 변환 문서(#세나루·강낭콩)는 원래 낮음.
- **렌더 글 위치**: 보도자료 6건은 PDF 쪽 전체가 (10,9.4)·(12,12)pt 밀려 찍힘(프린터 환경, 못 맞춤) · 시험지(3-xx 통합) 미주·수식 위치 ·
  맑은 고딕 위첨자 0.6pt · 본교재 문단 번호 "0^1".
- **렌더 그림**: 138건 중 29건은 위 쪽 밀림, 시험지 41건, `table_giant_cell_overfill`(칸 안 그림 여러 장이 쪽을 넘음).

## 해 봤는데 안 된 것 (반복 금지)

자간 반올림 방식 변경 · 시스템 글꼴 고정폭 · 반대 방향 공백 최소값 · 칸 빈 문단 두 조각 · Batang 에 PDF 중앙값 영문 폭 ·
Batang 을 바탕 폭표로(+4문단, 전체 0) · 줄 폭 판정 엄격화(cap −1·−4) · 글자 하나씩 폭 ±4~32 자동 탐색 ·
HYhaeseo·HY울릉도B 표 추가·Gulim 등 영문 이름 별칭(변화 0) · 끝 빈 쪽을 쪽 나누기 때만 버리기(1,126 → 1,122).
윈도: 한글 COM 글자 모양 지정(CharShape)으로 탐침 — 영문 글꼴 이름을 못 찾아 함초롬으로 대체(문서 HWPX 를 직접 만들어야 한다) ·
한 COM 세션에서 문서 여러 개 이어 열기 — 두 번째에서 멈춤(문서마다 새로 띄움).
