# batch-retry-and-minutes-flow — 작업 요약

## 구현된 기능

- 배치 모드에서 세그먼트 전사를 **단일 워커 큐**로 순차 처리하고, **회전 시** 이전 실패 인덱스를 먼저 `enqueue`한 뒤 신규 인덱스를 넣도록 정리함.
- 녹음 중 **`window.online`** 시 실패 세그먼트를 다시 큐에 넣어 재시도(녹음 중일 때만 리스너 등록).
- **`retryTranscription` → `Promise<BatchStopResult | null>`** 로 바꿔, 성공 시 Recorder가 **`persistBatchResult`**로 `saveSession` → `saveSessionAudio` → **`enqueuePipeline`**까지 동일 경로로 이어가게 함.
- **`BatchRetryControl`**: 녹음 중 실패 시 작은 배지, 종료 후 실패 시 **다시 시도** 버튼 및 재시도 진행 `(k/N)` 표시.
- **`useBeforeUnload`**: 배치 `transcribing` 중에도 이탈 경고.

## 주요 기술적 결정

- 마지막 세그먼트는 기존과 같이 **워커 전사 없이 `finalBlob`**으로 파이프라인에 넘김(계획 문구와 다를 수 있으나 제품 모델 유지).
- 워커는 `void runWorker()`로 시작하되, **예외는 catch에서 삼켜** unhandled rejection을 막음.

## 테스트 커버리지

- `use-batch-transcription.test.tsx`: 재시도 결과 형태, `online` 재시도, 기존 시나리오 타이머 보강.
- `batch-retry-control.test.tsx`: 배지·버튼·진행 문구.
- `recorder-batch.test.tsx`: **실패 중지 → 재시도 성공 → `saveSession` + enqueue** 통합 1건 추가.
- `recorder-session-resilience` / `recorder-ui`: 훅 mock 필드 정합.

## 파일 변경 목록

- `src/hooks/use-batch-transcription.ts`
- `src/components/recorder.tsx`
- `src/components/batch-retry-control.tsx`
- `src/hooks/__tests__/use-batch-transcription.test.tsx`
- `src/components/__tests__/recorder-batch.test.tsx`
- `src/components/__tests__/batch-retry-control.test.tsx`
- `src/components/__tests__/recorder-session-resilience.test.tsx`
- `src/components/__tests__/recorder-ui.test.tsx`
- `docs/ARCHITECTURE.md`
- `Issues/batch-retry-and-minutes-flow/*`, `Issues/STATUS.md`

## 알려진 제한 사항

- 계획서에 나열한 훅 TDD describe 전부(순차 fetch 순서 등)는 아직 일부만 반영됨.
- 무제한 재시도로 인한 부하는 서버 레이트 리밋·관측에 의존.

## 다음 단계 (해당 시)

- `01_plan.md` Step 4·online 등록 문구를 실제 구현에 맞게 짧게 수정.
- 회전 순서·fetch 호출 순서를 단언하는 추가 단위 테스트.
