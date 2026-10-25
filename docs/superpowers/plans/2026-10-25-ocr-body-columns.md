# OCR Body-Supported Column Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 본문 위치 근거로 OCR에서 결합된 머리행 열을 복원하고 PR 생성 직전까지 준비한다.

**Architecture:** 기존 OCR 위치 정보를 내부 근거로 보존하고 무괘선 표 후보 안에서 반복되는 경계를 검증한다. 검증한 경계를 칸 배정까지 유지하며 원본 item의 소비 관계를 보존한다. 실제 진단이 더 작은 해법을 입증하면 ledger에 판정을 기록한다.

**Tech Stack:** TypeScript, Node test runner, tsx, 기존 PP-OCRv5·sharp·PDF pipeline.

**Spec:** `docs/superpowers/specs/2026-10-25-ocr-body-columns-design.md`

## Global Constraints

- 공개 API, CLI, SDK 옵션과 IR schema를 추가하지 않는다.
- 새 model, dependency, outbound 경로를 추가하지 않는다. 기존 정답·평가기·제외 모수를 변경하지 않는다.
- PR 생성, 원격 push, main 반영, 배포는 하지 않는다.
- 다른 제품의 구현·patch·test를 참고하거나 옮기지 않는다.
- commit message는 전문 영어로 작성한다.

## Review Focus

- 결합 box의 일부만 표에 배정되었을 때 원문이 사라지거나 본문에 중복되지 않는가.
- 본문 두 행만 있는 원본과 한 행뿐인 불충분한 후보를 구분하는가.
- 기존 후처리가 문자 수를 바꾸거나 crop·deskew·2배 재인식이 좌표를 바꾸는 경우 위치 근거가 잘못 사용되지 않는가.
- 실제 병합 머리행·숫자 내부 공백·두 단 본문을 오분할하지 않는가.
- `tables:false`·OCR 끔·공개 `ocrLines` 결과에 내부 정보가 노출되거나 불필요한 동작 변화가 없는가.

---

### Task 1: Restore body-supported columns and prepare a reviewed local change

**Files:**
- Modify as demonstrated necessary: `src/ocr/engine.ts`, `src/ocr/pdf-ocr.ts`, `src/pdf/text-line.ts`, `src/pdf/page-blocks.ts`, `src/pdf/cluster-detector.ts`.
- Create only if necessary: a focused private geometry helper under `src/ocr/` or `src/pdf/`.
- Test: `tests/ocr-column-recovery.test.ts`; extend existing OCR/cluster tests where their existing behavior is exercised.
- Document: `CHANGELOG.md` Unreleased and local verification/PR preparation notes.

**Interfaces:**
- Consumes: existing `parse(input, options)`, `OcrEngine.recognizePage`, `ocrItemsToBlocks`, `detectClusterTables` and existing source-item identities.
- Produces: the same public ParseResult shape, with correctly separated table columns; no new consumer options.
- Internal evidence representation is chosen after the baseline/oracle diagnosis. Record its exact type and propagation sites in the ledger before implementing it.

- [x] **Step 1: Establish a clean baseline and reproduce native OCR.**
  Run `npm test`, `npm run typecheck`; parse the hashed receipt with `ocrLines:"all"` and save the complete baseline JSON outside tracked files.
  Expected: existing suite passes; receipt records the current column count and exact OCR boxes, or an environmental failure is diagnosed before product changes.
- [x] **Step 2: Verify the downstream upper bound with manually separated geometry.**
  Feed known correct header/value pieces through the existing block pipeline. Assert four columns, both numeric rows, and no lost/duplicate item text. Record where existing grouping recombines fragments.
  Expected: this identifies the necessary assignment change; do not present oracle output as native OCR improvement.
- [x] **Step 3: Write and run a failing regression before production edits.**
  Add `tests/ocr-column-recovery.test.ts` with body/header geometric evidence, the original two-row case, missing-evidence fallback and adversarial inputs from Review Focus. Run `node --import tsx --test tests/ocr-column-recovery.test.ts`.
  Expected: the positive regression fails because current behavior retains joined columns; negative cases record existing correct behavior.
- [x] **Step 4: Implement the smallest complete evidence-to-assignment path.**
  Reuse CTC/pixel helpers; restrict refinement to supported OCR candidates; preserve original item identity through splits; keep accepted boundaries during assignment. Run the targeted test after each cohesive change.
  Expected: regression passes; text is preserved; no public metadata or extra inference is added without an explicit ledger ruling.
- [x] **Step 5: Verify actual inputs and broad regressions.**
  Reparse the original, compare against baseline and separate independent variants/counterexamples. Run relevant OCR/cluster/coordinate/surface tests, `npm test`, `npm run typecheck`, `npm run build`, then available corpus gates sequentially. Record skipped corpus explicitly and compare runtime/RSS in an isolated run.
  Expected: original native OCR improves to four columns with exact value placement; specified negative cases and existing tests pass.
- [x] **Step 6: Commit, independent review and PR preparation.**
  Commit the coherent change locally with an English message. Dispatch one read-only fresh reviewer against the base and HEAD plus spec and verification evidence. Resolve Important/Critical findings with RED→GREEN tests, record rulings, and prepare the exact PR title/body locally.
  Expected: reviewed local commit and concrete PR description; no push, PR creation, merge or publish.
