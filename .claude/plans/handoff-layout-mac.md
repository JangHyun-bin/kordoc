# 인계: 렌더·reflow 한컴 조판 맞추기 (2026-10-14 기준 현재 상태)

목표: kordoc 렌더(`src/render/svg-render.ts`·`table-pages.ts`)와 reflow(`src/render/reflow.ts`·`src/hwpx/text-metrics.ts`·`font-metrics.ts`·`face-width-fix.ts`)를
한컴 조판(저장본 linesegarray·한컴 PDF)과 100% 같게.

## 작업 규칙 (사용자 지시)

- 사이클마다 **커밋 + main 직접 푸시만**. 버전업·npm 게시·릴리스 금지(요청 있을 때만).
- 테스트 → tsc → 빌드(`npm run build`) → `node bench/verify-reflow.mjs --gate` → `node bench/verify-pages.mjs --gate` → 커밋 → 푸시를 `&&` 로만. push 는 파이프 없이 exit code 확인.
- 커밋 메시지 수치는 실측한 것만. 채택은 `reflow-cmp` 전 코퍼스 전→후(두 줄+·줄 수·본문 vertpos)와 문서별 손해(`PERFILE`), 그리고 2022 재조판 304문서로.
- 커밋 메시지·주석·문서에 조판 규칙·폭표를 **어디서 어떻게 알아냈는지(출처)를 쓰지 않는다**. "한컴 저장본·PDF·한글 2022 줄 나눔과 맞춤" 같은 결과·규칙 서술만.
- 윈도 한글 COM 은 **2024 로 돌려 둠**(2026-10-14 사용자 허락). 관리자 권한이 없어 HKLM(2022 HOffice120) 은 그대로 두고 사용자 범위
  `HKCU\Software\Classes\{WOW6432Node\,}CLSID\{2291CF00-64A1-4877-A9B4-68CFE89612D6}\LocalServer32` = `...\Office 2024\HOffice130\Bin\Hwp.exe -Automation` 로 덮었다.
  재조판 저장본 appVersion 13.0.0.866. **2022 로 되돌리기** = 그 HKCU 키 둘을 `reg delete ... /f` 로 지운다.
  ⚠️ 이 2024 는 **13.0.0.866(2024년 1월 초판)** 이라 코퍼스 13.x 저장본(빌드 3050~3901)과 조판이 다르다 — 304문서 2024 재조판
  (`.claude/win-data/oracle/relayout24-out`)은 13.x 저장본과 9,176 / 9,517 일치로 2022 재조판(9,202)보다 덜 맞는다. 정답으로 쓰지 말 것.
  업데이터(`HncUpdater.exe /update`)는 "업데이트 서버에 연결할 수 없습니다"(update.hancom.com 80·443 무응답) — 최신 빌드로 못 올림.
- 응답은 한국어 반말.

## 현재 수치 (main f51cb75)

| 지표 | 값 |
|---|---|
| reflow 두 줄+ 문단 줄 시작 전부 일치 (12 코퍼스 저장본) | 24,890 / 25,187 (98.82%) |
| reflow 문단 줄 수 일치 | 306,620 / 306,744 |
| reflow 본문 첫 줄 vertpos 일치 · 본문 높이·기준선·간격 일치 | 73,156 · 78,087 / 78,287 (칸 205,083 / 205,234) — ba257ce 때 잰 값 |
| 같은 지표, 한글 2022 재조판 304문서 대비 (`.claude/win-data/oracle/relayout-out`) | 두 줄+ 17,039 / 17,173 · 줄 수 150,376 / 150,410 |
| 렌더 쪽 수 = 한컴 PDF 쪽 수 (짝 1,128) | 1,127 (남은 156775700 은 HWPX 에 통계표 24쪽이 없음 — 못 맞춤) |
| 렌더 글 조각 위치 PDF ±1.5pt | 23,585 / 24,054 (98.1%) |
| 렌더 그림 위치 PDF ±2pt | 3,570 / 3,686 (96.9%) |

정정: 39a75e7 "render text unchanged" 는 틀림(23,568 → 23,576) · 95d6ac4 탐침 "1,072 -> 1,440" 은 1,380 · 01c341f "one 2020 save" 는 2018~2022 저장본 4건(−1씩)·3건(+1씩).

## 확정한 사실

1. 윈도 PC(`ssh win783d`)의 한글 COM 은 **2022(12.0.0.535)**. 2022 재조판은 2022 이하로 저장된 문서의 저장본과 거의 같다.
   **2024(13.x)로 저장된 문서는 일부 규칙이 다르다** → `version.xml` appVersion 첫 수가 13 미만이면 `RenderStyles.before2024`(판을 모르면 2024 규칙). 지금 갈린 규칙:
   - 주석 머리 번호("1)") 폭: 2024 는 진하게를 빼고, 이전 판은 진하게 그대로
   - 줄머리 금지 글자 앞 글자도 줄머리 금지면: 이전 판은 끌어내리지 않는다
   - 휴먼명조 기호 폭 `BEFORE_2024_WIDTH`(‘’“”·ㆍ□◦▪ 전각, … 0.864, • 0.464, – 0.430) — 2024 는 기존 표 값
   - 금칙: 내린 글자도 줄머리 금지면 한 글자 더(최대 둘) 내림(2024 는 한 글자만) · 줄에 안 드는 단어를 글자로 쪼갤 때 줄머리 금칙은 두 판 다 없음, 줄끝 금칙은 이전 판만 없음
2. 글자 폭 = 4·MulDiv(글꼴 폭, ⌊크기/4⌋, unitsPerEm). TTF 폭은 반올림하지 않은 em 소수(`face-width-fix.ts`).
3. **진하게**: 굵은 글꼴이 없는 옛 HFT(한양·명조·고딕·필기·휴먼 HFT …)는 글자마다 **+50**(em×1000, 2022 탐침 323문단 전부 50 에서만 맞음).
   굵은 글꼴이 있는 HFT 영문은 `"<글꼴> Bold"` 폭표(HCI Tulip Bold·HCI Hollyhock Bold, ASCII 만)로 — 획 넓히기 없이.
4. **줄 나눔 폭 ≠ 그린 폭·글꼴 파일 폭**: 휴먼명조 TTF 파일의 … ※ 는 1em 이지만 2022 줄 나눔은 0.864·0.768. 폭은 재조판 줄 나눔으로만 판정.
   HFT·대체 글꼴 글자의 PDF 폭은 쓰지 말 것.
5. **줄 나눔 폭 탐침**(`bench/layout/line-probe.py` → 윈도 재조판 → `reflow-cmp PARADUMP` → `line-probe-fit.mts`): 같은 글자 반복 문단의 줄당 글자 수로
   글자 폭 구간을 푼다. 600·700 크기는 일부 글자가 4 넓게 잡혀 800 이상만 쓴다. 금칙 글자는 폭으로 안 풀린다.
6. 어울림 개체 양쪽에 1440(0.2인치) 이상 남는 한 줄 문단은 왼쪽 조각 + 오른쪽 빈 조각(textpos = 문단 끝 + 1) 두 줄, 1439 이하 조각은 비운다.
6-1. 주석: 본문 참조 번호는 글자 크기 3/4 로 잰다(위첨자 16/25 아님, 1~3자리 탐침) · 주석 머리 번호에는 자간을 안 매긴다 · 글자 모양 위·아래 첨자는 16/25 가 맞다.
6-2. 글자 단위 줄에서도 영문 분류 글자(ASCII·U+00A1~024F·U+2018~201F)는 이어서 한 단어("it’s", "’’’…" 는 긴 단어로 쪼갬).
6-3. **언어 칸**: 글자는 제 언어 칸(fontRef hangul·latin·hanja·japanese·symbol)의 글꼴·장평·자간·상대크기로 잰다. 기호 칸 = 한글·영문·한자·가나 밖 전부
   (문장부호·도형·「」、。·전각·그리스·키릴). 코퍼스 1,643문서에서 기호 칸이 한글 칸과 다르다(휴먼명조 + 한양신명조 기호가 가장 흔함).
   ⚠️ 탐침에서 칸을 안 바꾸면(fontRef 가 목록 밖) 한컴은 한컴바탕으로 대체해 잰다 — 탐침은 7개 칸을 다 바꿀 것.
6-4. 2024 이전 판에서 Batang(영문 이름) = 바탕(2022 재저장이 이름을 바탕으로 바꾸고 줄 나눔도 같다). 2024 저장본 Batang 은 모든 칸을 한컴바탕 폭으로 잰다(FIT_Batang 표는 이제 reflow 에서 안 쓰임).
6-5. 진하게 획 넓히기 +50 은 한양 계열도 HFT 항목만(TTF 한양해서 등은 그대로). 전각 빈칸(U+3000)이 넘치면 공백처럼 줄 끝에 건다.
6-5. 세로: TOP 정렬 문단의 기준선 0 · 글꼴 줄높이 = 반올림 ascent + 버린 descent · 고정 줄 간격 0 은 그대로 0 · 글자처럼 취급한 양식 컨트롤(체크 상자)은 그 높이.
6-6. 필드 끝 컨트롤은 넘친 줄에도 붙는다(떠 있는 개체 앵커 등 다른 폭 0 컨트롤은 다음 줄).
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
- **기호 폭**: 반복 탐침의 기호 폭(… 0.864·• 0.464·□ 1em 등)은 휴먼명조 2024 이전 판 문서에만 맞는다 — 'Batang' 탐침 값을 바탕 문서에 넣으면 −52, 모든 글꼴에 넣으면 −84.
  탐침 글꼴 이름(영문 Batang)과 문서 글꼴(바탕)이 한컴 안에서 다른 글꼴일 수 있다 — 다음 탐침은 문서의 글꼴 칸 그대로 쓸 것. ‧ ※ 도 같은 문제.
- **경계 4 HWPUNIT**: 정책·SO-SUEOP 일부 문단은 줄 폭을 4 넘는 덩어리를 우리가 받아 준다(어디서 여유가 생기는지 미확인).
- **세로 위치**: `vpos-scan` SAME 유형, 표만 든 빈 문단의 줄 위치(위 8번). vpos-scan 은 저장 vertpos 가 본문 밖이면 0 으로 바꿔 비교해 착시가 섞인다.
  칸 첫 줄 vertpos 불일치 5,339줄은 쪽에서 갈린 큰 칸(저장본은 쪽마다 0 부터, reflow 는 이어서) — `FVDUMP=cell FVJSON=out.json` 으로 본다.
- **맞출 수 없는 것(추가)**: 156765958 [별첨1] 등은 저장본 ≠ 2022 재조판(같은 2022 의 다른 빌드로 저장) · 156775701 은 같은 글자 모양 칸마다 줄 높이가 갈림(묵은 캐시)
  · 서울 결재문서 마스킹("*****") 문단은 줄 정보가 지워져 원래 줄 수를 알 수 없다.
- **렌더**: 프린터 밀림 PDF(용지 594×842 등, 글 약 120·그림 약 25 — 못 맞춤) · 시험지 다단 미주 흐름(그림 41) · `table_giant_cell_overfill` 이어진 쪽 3.75pt.

## 해 봤는데 안 된 것 (반복 금지)

자간 반올림 방식 변경 · 자간을 글자 크기 기준으로(−2,400) · 시스템 글꼴 고정폭 · 반대 방향 공백 최소값 · Batang 에 PDF 중앙값·바탕 폭·2022 PDF 탐침 폭(−2) ·
줄 폭 판정 엄격화 · 글자 하나씩 폭 자동 탐색 · 끝 빈 쪽을 쪽 나누기 때만 버리기 · 기호 칸(symbol) 글꼴로 기호 재기 · 명조 HFT ‘’“” 반각(−67) ·
각주 번호 뒤 빈칸·자간 제외 · HCI·모르는 TTF 글꼴도 substFont 로(−6) · 꼬리말 자리까지 본문 확장(FOOTX) · 서울남산체 새 판 폭(−3) ·
문단 기준 어울림 영역에 바깥 위 여백(0) · 개체 줄 줄간격을 줄 높이로(affectLSpacing 없이, vertpos −28,000) · HFT 영문 글자 자간 0 ·
미주 번호 폭을 문단 스타일(미주) 글자 모양으로(저장본 −2, 2022 재조판 −59 — SO-SUEOP 만 +3) · 옛 판 압축(condense) 끄기(−419) · 2024 한양중고딕→함초롬돋움(giant −11) · 진하게 가산 46 을 2024 저장본에만(−2) · 미주 번호 진하게 빼기를 모든 판에(2022 재조판 −11) · 참조 번호 본문 크기·80%·70%(3/4 보다 못함) ·
주석 머리 번호 장평 100(−7) · 반복 탐침 기호 폭을 모든 글꼴·바탕에(−84·−52) · 영문 단어 금칙 해제를 2024 저장본에도(−13) · Batang 탐침 폭(0·−2) ·
‧·※ 2022 폭을 문서에(재조판 −7·−1) · 필기 영문 반각 고정(탐침은 맞지만 코퍼스 영향 0 — 미반영).
윈도: COM 글자 모양 지정 탐침(HWPX 를 직접 만든다) · 한 COM 세션에서 문서 여러 개(두 번째에서 멈춤).
