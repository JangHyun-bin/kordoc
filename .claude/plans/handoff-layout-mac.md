# 인계: 렌더·reflow 한컴 조판 맞추기 (2026-10-14 기준 현재 상태)

목표: kordoc 렌더(`src/render/svg-render.ts`·`table-pages.ts`)와 reflow(`src/render/reflow.ts`·`src/hwpx/text-metrics.ts`·`font-metrics.ts`·`face-width-fix.ts`)를
한컴 조판(저장본 linesegarray·한컴 PDF)과 100% 같게.

## 작업 규칙 (사용자 지시)

- 사이클마다 **커밋 + main 직접 푸시만**. 버전업·npm 게시·릴리스 금지(요청 있을 때만).
- 테스트 → tsc → 빌드(`npm run build`) → `node bench/verify-reflow.mjs --gate` → `node bench/verify-pages.mjs --gate` → 커밋 → 푸시를 `&&` 로만. push 는 파이프 없이 exit code 확인.
- 커밋 메시지 수치는 실측한 것만. 채택은 `reflow-cmp` 전 코퍼스 전→후(두 줄+·줄 수·본문 vertpos)와 문서별 손해(`PERFILE`), 그리고 2022 재조판 304문서로.
- 커밋 메시지·주석·문서에 조판 규칙·폭표를 **어디서 어떻게 알아냈는지(출처)를 쓰지 않는다**. "한컴 저장본·PDF·한글 2022 줄 나눔과 맞춤" 같은 결과·규칙 서술만.
- 윈도 한글 COM 을 2024 로 재등록하거나 2024 자동화 서버를 띄우는 것은 사용자 확인 전 금지(사용자 RPA 가 COM 을 쓸 수 있다). 윈도에 Office 2024 도 깔려 있다.
- 응답은 한국어 반말.

## 현재 수치 (main 95d6ac4)

| 지표 | 값 |
|---|---|
| reflow 두 줄+ 문단 줄 시작 전부 일치 (12 코퍼스 저장본) | 24,756 / 25,187 (98.29%) |
| reflow 문단 줄 수 일치 | 306,569 / 306,744 |
| reflow 본문 첫 줄 vertpos 일치 | 73,021 |
| 같은 지표, 한글 2022 재조판 304문서 대비 (`.claude/win-data/oracle/relayout-out`) | 두 줄+ 16,932 / 17,173 · 줄 수 150,327 / 150,410 |
| 렌더 쪽 수 = 한컴 PDF 쪽 수 (짝 1,128) | 1,127 (남은 156775700 은 HWPX 에 통계표 24쪽이 없음 — 못 맞춤) |
| 렌더 글 조각 위치 PDF ±1.5pt | 23,576 / 24,054 (98.0%) |
| 렌더 그림 위치 PDF ±2pt | 3,570 / 3,686 (96.9%) |

정정: 커밋 39a75e7 메시지의 "render text unchanged" 는 틀림(23,568 → 23,576), 95d6ac4 의 탐침 "1,072 -> 1,440" 은 1,072 → 1,380 이 맞다.

## 확정한 사실

1. 윈도 PC(`ssh win783d`)의 한글 COM 은 **2022(12.0.0.535)**. 2022 재조판은 2022 이하로 저장된 문서의 저장본과 거의 같다.
   **2024(13.x)로 저장된 문서는 일부 규칙이 다르다** → `version.xml` appVersion 첫 수가 13 미만이면 `RenderStyles.before2024`(판을 모르면 2024 규칙). 지금 갈린 규칙:
   - 주석 머리 번호("1)") 폭: 2024 는 진하게를 빼고, 이전 판은 진하게 그대로
   - 줄머리 금지 글자 앞 글자도 줄머리 금지면: 이전 판은 끌어내리지 않는다
   - 휴먼명조 기호 폭 `BEFORE_2024_WIDTH`(‘’“”·ㆍ□◦▪ 전각, … 0.864, • 0.464, – 0.430) — 2024 는 기존 표 값
2. 글자 폭 = 4·MulDiv(글꼴 폭, ⌊크기/4⌋, unitsPerEm). TTF 폭은 반올림하지 않은 em 소수(`face-width-fix.ts`).
3. **진하게**: 굵은 글꼴이 없는 옛 HFT(한양·명조·고딕·필기·휴먼 HFT …)는 글자마다 **+50**(em×1000, 2022 탐침 323문단 전부 50 에서만 맞음).
   굵은 글꼴이 있는 HFT 영문은 `"<글꼴> Bold"` 폭표(HCI Tulip Bold·HCI Hollyhock Bold, ASCII 만)로 — 획 넓히기 없이.
4. **줄 나눔 폭 ≠ 그린 폭·글꼴 파일 폭**: 휴먼명조 TTF 파일의 … ※ 는 1em 이지만 2022 줄 나눔은 0.864·0.768. 폭은 재조판 줄 나눔으로만 판정.
   HFT·대체 글꼴 글자의 PDF 폭은 쓰지 말 것.
5. **줄 나눔 폭 탐침**(`bench/layout/line-probe.py` → 윈도 재조판 → `reflow-cmp PARADUMP` → `line-probe-fit.mts`): 같은 글자 반복 문단의 줄당 글자 수로
   글자 폭 구간을 푼다. 600·700 크기는 일부 글자가 4 넓게 잡혀 800 이상만 쓴다. 금칙 글자는 폭으로 안 풀린다.
6. 어울림 개체 양쪽에 1440(0.2인치) 이상 남는 한 줄 문단은 왼쪽 조각 + 오른쪽 빈 조각(textpos = 문단 끝 + 1) 두 줄, 1439 이하 조각은 비운다.
7. 커닝은 줄 나눔에 영향 없음. 저장본의 새 쪽 첫 줄 vertpos 가 앞 쪽 값에 이어지기도 한다(우리 0 이 맞다).
8. 표만 든 빈 문단의 줄: 대부분 제자리, 표 아래로 내려가는 경우 31 — 가르는 조건 미확인.
9. 렌더: 양쪽 정렬은 남는 폭을 빈칸에만 · 인라인 그림은 높이 85% 를 기준선 위 · 엇갈린 병합 행은 미지수 하나인 칸부터 · 첫 줄도 못 놓는 칸이 있는 행은 행째 다음 쪽 ·
   끝 빈 쪽은 "쪽 나누기 없이 넘어갔고 앞 쪽 내용이 본문 안 + 떠 있는 표 때문 아님"일 때만 찍는다.

## 윈도 한글 원격 실행

- 맥의 `~/bin/hwp-job '<bash 명령>'` 이 ssh 로 윈도 `C:\github_project\kordoc` 의 Git Bash 를 돌린다(데스크톱 세션 예약 작업). 한 번에 한 작업(돌고 있으면 exit 98).
  윈도 기본 셸은 PowerShell 이라 `ssh win783d '<명령>'` 을 직접 쓰지 말고 hwp-job 을 쓴다. 파일은 `scp 파일 win783d:C:/tmp/…`.
- 재조판: `~/bin/hwp-job "T=600 FORMAT=HWPX OUT=/c/tmp/x/out bash bench/layout/batch-pdf.sh /c/tmp/x/in"`(문서당 11~40초, 큰 탐침은 T 를 늘린다). PDF 는 FORMAT 없이.
- 규칙 실험 틀: 사본에서 의심 설정 하나만 바꿔 재조판 → 줄 시작 비교. 개체 위치를 바꾼 사본으로 문턱 찾기(1440 조각 문턱이 이렇게 나왔다).
- rhwp 일부 HWPX 는 zip CRC 가 틀려 python zipfile 이 못 읽는다 — `unzip -p` 로 읽어 다시 묶는다.

## 측정·분석 도구 (`bench/layout/`)

```bash
D=(seoul seoul2 seoul-old review korea-kr-pairs korea-kr-pairs2 licbyl licbyl2 rhwp gate-fill gate-fill3 korea-kr)   # zsh: ${D/#/bench/corpus/}
node --import tsx bench/layout/reflow-cmp.mts ${D/#/bench/corpus/}      # PERFILE=out.json 문서별 · PARADUMP=out.tsv 문단별 · DUMPKIND=body
node --import tsx bench/layout/reflow-cmp.mts .claude/win-data/oracle/relayout-out   # 2022 재조판 304문서 대비
node --import tsx bench/layout/vpos-scan.mts ${D/#/bench/corpus/} > v.tsv
node --import tsx bench/layout/para-widths.mts 문서.hwpx "문단 글" [구역번호]  # 글자별 폭·누적(ALL=1 전부)
python bench/layout/relayout-cls.py 원본.tsv 재조판.tsv index.json [out.json]  # 저장=재조판인데 우리만 틀린 문단
python bench/layout/line-probe.py bench/corpus/rhwp/SO-SUEOP.hwpx out.hwpx spec.json ; node --import tsx bench/layout/line-probe-fit.mts out.hwpx.rows.json pd.tsv 라틴id 진하게 글꼴 out.json
```

데이터(git 밖 `.claude/win-data/`): `oracle/widths.json`(2022 PDF 탐침 폭 — HFT·대체 글꼴엔 쓰지 말 것) · `oracle/relayout-out/`(304문서 2022 재조판) · `oracle/appver.json` · `winfonts*`.

## 남은 것

- **reflow 두 줄+ 431문단**(저장본). 304문서 기준 저장=2022 재조판인데 우리만 틀린 문단 약 210(`relayout-cls.py`) — 정책연구 보고서 43·SO-SUEOP 15·편람 8, 나머지 1~4씩.
- **2024 규칙 더 찾기**: 13.x 저장본과 2022 재조판이 다른 문단(약 420)의 원인. 2024 측정 없이도 "13.x 저장본에서만 이득"인 규칙은 위 before2024 틀로 넣을 수 있다.
- **금칙**: 닫는 꺾쇠(」』〉》】・) 반복 문단에서 2022 는 줄당 2자 덜 든다(폭은 1em) — 규칙 미확인. ‧ ※ 는 반복 문단 폭과 문서 글 폭이 다르다.
- **경계 4 HWPUNIT**: 정책·SO-SUEOP 일부 문단은 줄 폭을 4 넘는 덩어리를 우리가 받아 준다(어디서 여유가 생기는지 미확인).
- **세로 위치**: `vpos-scan` SAME 유형, 표만 든 빈 문단의 줄 위치(위 8번).
- **렌더**: 프린터 밀림 PDF(용지 594×842 등, 글 약 120·그림 약 25 — 못 맞춤) · 시험지 다단 미주 흐름(그림 41) · `table_giant_cell_overfill` 이어진 쪽 3.75pt.

## 해 봤는데 안 된 것 (반복 금지)

자간 반올림 방식 변경 · 자간을 글자 크기 기준으로(−2,400) · 시스템 글꼴 고정폭 · 반대 방향 공백 최소값 · Batang 에 PDF 중앙값·바탕 폭·2022 PDF 탐침 폭(−2) ·
줄 폭 판정 엄격화 · 글자 하나씩 폭 자동 탐색 · 끝 빈 쪽을 쪽 나누기 때만 버리기 · 기호 칸(symbol) 글꼴로 기호 재기 · 명조 HFT ‘’“” 반각(−67) ·
각주 번호 뒤 빈칸·자간 제외 · HCI·모르는 TTF 글꼴도 substFont 로(−6) · 꼬리말 자리까지 본문 확장(FOOTX) · 서울남산체 새 판 폭(−3) ·
문단 기준 어울림 영역에 바깥 위 여백(0) · 개체 줄 줄간격을 줄 높이로(affectLSpacing 없이, vertpos −28,000) · HFT 영문 글자 자간 0 ·
진하게 가산 46 을 2024 저장본에만(−2) · 줄머리 금지 묶음 전체 + 앞 글자 함께 내리기(V2, V1 보다 못함) · 미주 번호 진하게 빼기를 모든 판에(2022 재조판 −11) ·
‧·※ 2022 폭을 문서에(재조판 −7·−1) · 필기 영문 반각 고정(탐침은 맞지만 코퍼스 영향 0 — 미반영).
윈도: COM 글자 모양 지정 탐침(HWPX 를 직접 만든다) · 한 COM 세션에서 문서 여러 개(두 번째에서 멈춤).
