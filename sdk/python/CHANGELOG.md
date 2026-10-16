# Python SDK Changelog

## 0.2.0 — 2026-10-16

- OCR 줄·상자·신뢰도 내보내기(`ocr_lines`)와 검출 모델·해상도·로컬 인식 모델 선택을 지원합니다. `OcrModelFile`, `OcrPageLines`, `OcrLine`, `OcrBox` 타입을 제공합니다. 새 OCR 기능은 npm kordoc 엔진 4.22.0 이상이 필요합니다.
- 동시 시작·종료, 워커 교체·warmup 중 취소, timeout 후 복구 및 임시 파일 정리를 보완했습니다. Python 3.14에서 동기 `close()`가 시작되기 전에 Ctrl-C로 중단되어도 워커를 종료합니다.
- NaN·Infinity 등 JSON으로 보낼 수 없는 옵션과 존재하지 않는 엔진 경로를 워커 실행 전에 거부합니다.

## 0.1.0 — 2026-10-10

- 상주 엔진 워커를 사용하는 동기·비동기 Python SDK 최초 배포.
