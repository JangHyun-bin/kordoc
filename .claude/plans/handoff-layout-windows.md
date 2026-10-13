# 인계: 렌더·reflow 한컴 조판 맞추기 — 윈도 PC 이어가기 (2026-10-14)

목표: kordoc 렌더(`src/render/svg-render.ts`·`table-pages.ts`)와 reflow(`src/render/reflow.ts`·`src/hwpx/text-metrics.ts`·`font-metrics.ts`)를
한컴 조판(저장본 linesegarray·한컴 PDF)과 100% 같게.

## 작업 규칙 (사용자 지시)

- 사이클마다 **커밋 + main 직접 푸시만**. 버전업·npm 게시·릴리스 금지(요청 있을 때만).
- 테스트 → tsc → tsup → 게이트 → 커밋 → 푸시를 `&&` 로만 잇기. push 는 파이프 없이 exit code 확인.
- 커밋 메시지 수치는 실측한 것만(예측값 금지).
- 커밋 메시지·주석·문서에 조판 규칙을 **어디서 어떻게 알아냈는지(출처)를 쓰지 않는다**. "한컴 저장본·PDF 와 맞춤" 같은 결과·규칙 서술만.
- 응답은 한국어 반말.

## 현재 수치 (main 1bd18b4, 맥에서 측정)

| 지표 | 값 |
|---|---|
| 렌더 쪽 수 = 한컴 PDF 쪽 수 (짝 1,128) | 1,126 |
| reflow 두 줄+ 문단 줄 시작 전부 일치 (12 코퍼스) | 24,318 / 25,187 (96.55%) |
| reflow 문단 줄 수 일치 | 306,293 / 306,744 |
| reflow 본문 첫 줄 vertpos 일치 | 69,789 |
| 렌더 글 조각 위치 PDF ±1.5pt | 23,340 / 24,049 (97.1%) |
| 렌더 그림 위치 PDF ±2pt | 3,551 / 3,685 (96.4%) |

이번 세션 커밋: a7696da(첫 줄 뒤 앵커 개체 오프셋) · e03b0ff(쪽 채운 줄 겹침 = 새 쪽) · 1bd18b4(HFT 영문 폭표 94종) · 526a050(한양신명조 영문) 외.

## 측정 도구 (`bench/layout/`)

경로는 레포 기준이라 윈도에서도 그대로 돈다. 코퍼스 `bench/corpus/` 가 있어야 한다(맥미니에서 복사).

```powershell
$D = "seoul seoul2 seoul-old review korea-kr-pairs korea-kr-pairs2 licbyl licbyl2 rhwp gate-fill gate-fill3 korea-kr".Split(" ") | % { "bench/corpus/$_" }
node --import tsx bench/layout/reflow-cmp.mts @D          # reflow vs 저장 lineseg — "all ... 두 줄+ ... 전부일치" 줄이 핵심
node --import tsx bench/layout/pagecount.mts @D           # 쪽 수 vs 짝 PDF (pip install pymupdf, PYTHON 환경변수로 파이썬 지정)
python bench/layout/pdf-spans.py spans.json (짝 PDF 경로들)  # 글 조각 정답 → textpos.mts spans.json
python bench/layout/pdf-imgs.py imgs.json (짝 PDF 경로들)    # 그림 정답 → imgpos.mts imgs.json
node --import tsx bench/layout/textpos.mts spans.json      # BAD=1 이면 틀린 조각 목록
node --import tsx bench/layout/imgpos.mts imgs.json        # BAD=1 이면 틀린 그림 목록
```

`reflow-cmp.mts` 환경변수: `BLAME=out.json`(실패 줄의 글꼴·글자별 넓음/좁음 집계) · `PFV=1`(문서별 본문 vertpos 일치) ·
`FACEDOC=휴먼명조 FACEDUMP=1`(그 글꼴 문단의 틀린 줄 시작 + 문단 글) · `BRK=1`(갈린 자리 앞뒤 글).
spans/imgs json 의 키는 PDF 절대 경로라 윈도에서 새로 만들어야 한다.

## 윈도에서 할 일 — 한글(윈도) 조판 결과를 정답으로

`bench/hangul-com-pdf.ps1 -Src a.hwpx -Out a.pdf` 가 한글 COM 으로 PDF 를 만든다. 윈도 한글은 저장본과 같은 조판이라 **정밀 정답**이다
(맥 한글 앱은 글자 폭이 달라(한글 996·숫자 504 @10pt) 근사로만 쓸 수 있었다).

1. **글자 폭 직접 읽기**: 문서 사본에서 `<hp:linesegarray>` 를 지우고 header.xml 의 `horizontal="JUSTIFY|DISTRIBUTE|CENTER|RIGHT"` 를
   `LEFT` 로 바꿔 PDF 로 찍는다 → 늘임 없는 줄이라 PyMuPDF `rawdict` 글자 원점 차이(pt×100)가 한컴이 쓴 글자별 폭(HWPUNIT)이다.
   우리 `hancomCharWidth(ch, 크기, 장평, 자간, faceClassForReflow(글꼴))` 와 글꼴·크기·글자별로 대조 → 다른 글자만 폭표 수정.
   우선순위: **Batang**(실패 글자 5,144 — 폭 원본 없음, 저장본 추정 표 FIT_Batang), 휴먼명조(본문 2,375/2,522), 바탕, 맑은 고딕, KoPub.
2. **줄 나눔 정답**: 같은 사본을 정렬은 그대로 두고 찍어서 저장본 lineseg 와 줄 시작이 같은지 먼저 확인(윈도 = 저장본이어야 정상).
   그다음 의심 규칙을 사본에서 하나씩 바꿔(공백 최소값·자간·금칙 문자·칸 여백 등) 찍어 보면 규칙을 바로 확인할 수 있다.
3. 각 수정은 `reflow-cmp.mts` 전 코퍼스 전→후로만 채택(줄 시작·줄 수·vertpos 셋 다 확인, 문서별 손해는 `PFV=1` 로).

## 남은 것

- **쪽 수 2건**: `156775700`(HWPX 에 PDF 의 통계표 24쪽이 아예 없음 — 못 맞춤) / `6902633`(문서 끝 빈 문단이 표가 거의 꽉 찬 쪽 다음에
  저장 vertpos 0 으로 넘어감 — PDF 는 빈 2쪽을 찍음). 끝 빈 쪽 버림 규칙(svg-render.ts "문서 끝의 빈 문단만 든 쪽")을
  "쪽 나누기 걸림 또는 앞 줄이 본문 바닥을 넘침" 일 때만으로 좁히면 6902633 은 맞지만 rhwp `table_text_anchor_wrap`(PDF 3쪽)이 4쪽이 된다 — 둘을 가르는 조건 미확인.
- **reflow**: 줄 시작 차이 844곳은 대부분 ±1~2자 글자 폭 문제(글자 하나씩 폭 자동 탐색은 +1~4 로 포화 → 1번 실측이 답).
  휴먼명조는 우리가 줄에 글자를 더 넣는 쪽이 2:1(공백 폭·문단 설정 의심). hwp3 변환 문서(#세나루·강낭콩)는 원래 낮음.
- **렌더 글 위치**: 보도자료 6건은 PDF 쪽 전체가 (10,9.4)·(12,12)pt 밀려 찍힘(프린터 환경, 못 맞춤) · 시험지(3-xx 통합) 미주·수식 위치 ·
  맑은 고딕 위첨자 0.6pt · 본교재 문단 번호 "0^1".
- **렌더 그림**: 138건 중 29건은 위 쪽 밀림, 시험지 41건, `table_giant_cell_overfill`(칸 안 그림 여러 장이 쪽을 넘음).

## 해 봤는데 안 된 것 (반복 금지)

자간 반올림 방식 변경 · 시스템 글꼴 고정폭 · 반대 방향 공백 최소값 · 칸 빈 문단 두 조각 · Batang 에 PDF 중앙값 영문 폭 ·
줄 폭 판정 엄격화(cap −1·−4) · 글자 하나씩 폭 ±4~32 자동 탐색 · HYhaeseo·HY울릉도B 표 추가·Gulim 등 영문 이름 별칭(변화 0) ·
끝 빈 쪽을 쪽 나누기 때만 버리기(1,126 → 1,122).
