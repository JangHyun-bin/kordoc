# 인계: 렌더·reflow 한컴 조판 맞추기 (2026-10-14 기준 현재 상태)

목표: kordoc 렌더(`src/render/svg-render.ts`·`table-pages.ts`)와 reflow(`src/render/reflow.ts`·`src/hwpx/text-metrics.ts`·`font-metrics.ts`·`face-width-fix.ts`)를
한컴 조판(저장본 linesegarray·한컴 PDF)과 100% 같게.

## 작업 규칙 (사용자 지시)

- 사이클마다 **커밋 + main 직접 푸시만**. 버전업·npm 게시·릴리스 금지(요청 있을 때만).
- 테스트 → tsc → 빌드(`npm run build`) → `node bench/verify-reflow.mjs --gate` → `node bench/verify-pages.mjs --gate` → 커밋 → 푸시를 `&&` 로만. push 는 파이프 없이 exit code 확인.
- 커밋 메시지 수치는 실측한 것만. 채택은 `reflow-cmp` 전 코퍼스 전→후(두 줄+·줄 수·본문 vertpos)와 문서별 손해(`PERFILE`)로만.
- 커밋 메시지·주석·문서에 조판 규칙·폭표를 **어디서 어떻게 알아냈는지(출처)를 쓰지 않는다**. "한컴 저장본·PDF 와 맞춤" 같은 결과·규칙 서술만.
- 응답은 한국어 반말.

## 현재 수치 (main 47863f0)

| 지표 | 값 |
|---|---|
| reflow 두 줄+ 문단 줄 시작 전부 일치 (12 코퍼스) | 24,670 / 25,187 (97.95%) |
| reflow 문단 줄 수 일치 | 306,526 / 306,744 |
| reflow 본문 첫 줄 vertpos 일치 | 72,685 |
| 렌더 쪽 수 = 한컴 PDF 쪽 수 (짝 1,128) | 1,126 |
| 렌더 글 조각 위치 PDF ±1.5pt | 23,383 / 24,051 (97.2%) |
| 렌더 그림 위치 PDF ±2pt | 3,551 / 3,685 (96.4%) |

## 확정한 사실

1. 윈도 PC(`ssh win783d`)의 한글 COM 은 **2022(12.0.0.535)**. 2022 재조판은 2022 이하로 저장된 문서의 저장본과 거의 같다(대조군 두 줄+ 1,019문단 100%).
   **2024(13.x)로 저장된 문서는 2022 와 일부 다르게 조판된다** — 304문서 중 저장본 ≠ 2022 재조판 문단이 13.x 문서에 몰려 있다(315, 정책연구 보고서 146·SO-SUEOP 113).
   예: 휴먼명조 ‘ 를 2022 는 1em, 2024 저장본은 약 0.22em 로 잡는다. 13.x 문서의 정답 확인에는 2024 재조판이 필요하다(COM 2024 재등록은 사용자 확인 대기).
2. 글자 폭 = 4·MulDiv(글꼴 폭, ⌊크기/4⌋, unitsPerEm). TTF 폭은 반올림하지 않은 em 소수로 둬야 크기마다 1 HWPUNIT 씩 안 어긋난다(`face-width-fix.ts`).
3. **줄 나눔 폭 ≠ 그린 폭**: 글꼴에 없어 대체 글꼴로 그린 글자(‘’·• 등)는 PDF 에 대체 글꼴 폭으로 찍히지만 줄 나눔은 다른 폭(저장본에 맞춘 값)을 쓴다 —
   LEFT 사본 PDF·탐침 폭을 이런 글자에 그대로 쓰면 안 된다. 글꼴에 있는 글자는 그린 폭 = 줄 나눔 폭.
4. 커닝(`useKerning="1"`)은 줄 나눔에 영향 없음 — 커닝 켬/끔 사본 24문서 2022 재조판 줄 시작 전부 같다.
5. 저장본은 새 쪽으로 넘어간 첫 줄 vertpos 를 앞 쪽 값(본문 바닥 밖)에 이어 적기도 한다 — 실제는 새 쪽 위(둘째 줄부터 같다). 우리 0 이 맞다.
6. 표만 든 빈 문단의 줄: 대부분 제자리(268), 표 아래로 내려가는 경우 31(11.x 결재문서 일부·편람) — 가르는 조건 미확인.
7. 이번 세션에 들어간 규칙(커밋 1b8871f~47863f0): TTF 정확 폭 19종 · titleMark 8슬롯 · HFT 합성 굵기(#세나루·강낭콩·HCI Tulip·신명 태고딕, 휴먼 계열은 HFT 항목만) ·
   TTF 로 적힌 한양 글꼴은 substFont · 폭표 없던 글꼴 16종 · 하이퍼링크 필드 시작 컨트롤은 다음 줄 머리 · useFontSpace=1 은 글꼴 빈칸 폭 ·
   용지 기준 어울림 개체도 둘레 흐름(오프셋 + 바깥 여백) · 문단 모양 lineWrap=SQUEEZE · U+F0A0 은 글꼴 빈칸 폭 · reflow-cmp 제본 여백.

## 윈도 한글 원격 실행

- `ssh win783d`(키 인증, 같은 LAN). 한글 작업은 반드시 `~/bin/hwp-job '<bash 명령>'` — 윈도 `C:\github_project\kordoc` 에서 Git Bash 로, 데스크톱 세션 예약 작업이 돌린다.
  한 번에 한 작업(돌고 있으면 exit 98). 작업 전 `~/bin/hwp-job "git pull --ff-only"`. 작업 폴더는 `C:/tmp` 아래. 파일은 `scp`.
- 재조판: `~/bin/hwp-job "FORMAT=HWPX OUT=C:/tmp/x/out bash bench/layout/batch-pdf.sh C:/tmp/x/in"`(줄 정보 지운 사본을 넣는다, 문서당 11~40초). PDF 는 FORMAT 없이.
- 규칙 실험 틀: 사본에서 의심 설정 하나만 바꿔(정렬 LEFT·자간 0·커닝 끔 …) 재조판 → 줄 시작 비교. 글자 폭은 `leftify.py` 사본 PDF 로.

## 측정·분석 도구 (`bench/layout/`)

```bash
D=(seoul seoul2 seoul-old review korea-kr-pairs korea-kr-pairs2 licbyl licbyl2 rhwp gate-fill gate-fill3 korea-kr)   # zsh: ${D/#/bench/corpus/}
node --import tsx bench/layout/reflow-cmp.mts ${D/#/bench/corpus/}      # PERFILE=out.json 문서별 · PARADUMP=out.tsv 문단별 · BRK=1 · BLAME=out.json · DUMPKIND=body
node --import tsx bench/layout/vpos-scan.mts ${D/#/bench/corpus/} > v.tsv   # 구역마다 본문 첫 줄 vertpos 가 처음 갈리는 문단(SAME=줄 나눔 같음 → 세로 규칙 문제)
node --import tsx bench/layout/para-widths.mts 문서.hwpx "문단 글" [구역번호]  # 글자별 폭·누적(ALL=1 전부)
node --import tsx bench/layout/table-rows.mts 문서.hwpx section0 문단번호    # 표 행 높이 저장본 vs reflow, 다른 칸 문단
python bench/layout/relayout-cls.py 원본.tsv 재조판.tsv relayout-out/index.json  # 저장=재조판인데 우리만 틀린 문단
python bench/layout/leftify.py in.hwpx out.hwpx ; node --import tsx bench/layout/glyph-widths.mts out.hwpx gw.json ; python bench/layout/glyph-fit.py out.pdf gw.json
```

데이터(git 밖 `.claude/win-data/`): `oracle/widths.json`(2022 탐침 폭) · `oracle/relayout-out/`(304문서 2022 재조판 + index.json) · `oracle/appver.json`(문서 → 저장 버전) · `winfonts*`(글꼴 파일).

## 남은 것

- **reflow 두 줄+ 517문단**: 정책연구 보고서·SO-SUEOP(2024 저장, 2022 로 정답 못 냄) 약 175, 나머지는 문서마다 1~10문단씩(칸 안 글꼴 없는 문서·서울남산체 2008판 등).
  304문서 기준 저장=재조판인데 우리만 틀린 문단 약 280(`relayout-cls.py`).
- **세로 위치**: `vpos-scan` SAME 유형 — 앞 문단 표가 있는 경우(칸 문단 줄 수 차이로 표가 커짐), 표만 든 빈 문단의 줄 위치(위 6번).
- **쪽 수 2건**: `156775700`(HWPX 에 PDF 통계표 24쪽 없음 — 못 맞춤) / `6902633`(끝 빈 쪽 조건, rhwp `table_text_anchor_wrap` 과 상충).
- **렌더 글 위치**: 보도자료 6건 쪽 전체 밀림(프린터 환경) · 시험지 미주·수식 · 맑은 고딕 위첨자 · 본교재 문단 번호.
- **렌더 그림**: 138건 중 29건 위 쪽 밀림, 시험지 41건, `table_giant_cell_overfill`.

## 해 봤는데 안 된 것 (반복 금지)

자간 반올림 방식 변경 · 자간을 글자 크기 기준으로(−2,400) · 시스템 글꼴 고정폭 · 반대 방향 공백 최소값 · 칸 빈 문단 두 조각 · Batang 에 PDF 중앙값·바탕 폭(+1) ·
줄 폭 판정 엄격화 · 글자 하나씩 폭 자동 탐색 · 끝 빈 쪽을 쪽 나누기 때만 버리기 · 저장 버전별 폭 분기(2022 폭을 12.x 문서에만, 손해) ·
기호 칸(symbol) 글꼴로 기호 재기(−9~+5) · 휴먼명조 ‘’• 등 2022 폭으로(−40) · 명조 HFT ‘’“” 반각(−67) · 각주 번호 뒤 빈칸·자간 제외(±) ·
HCI·모르는 TTF 글꼴도 substFont 로(−6) · 꼬리말 자리까지 본문 확장(FOOTX, vertpos −27,000) · 서울남산체 새 판 폭(득실 −3) · 문단 기준 어울림 영역에 바깥 위 여백(변화 0).
윈도: COM 글자 모양 지정 탐침(영문 글꼴 이름 못 찾음 — HWPX 를 직접 만든다) · 한 COM 세션에서 문서 여러 개(두 번째에서 멈춤).
