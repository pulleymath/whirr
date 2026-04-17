---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "batch-retry-and-minutes-flow"
---

# batch-retry-and-minutes-flow — 개발 계획서

## 개발 범위

배치 녹음 모드에서 세그먼트 전사 실패 시 자동·수동 재시도를 지원하고, 모든 세그먼트가 성공한 뒤에만 세션 저장 → 회의록 파이프라인(`enqueuePipeline`)이 실행되도록 한다. 현재 `pendingPromisesRef`(Set) 기반 비순차 전사를 **워커 큐** 기반 시간순 엄격 순차 처리로 교체하고, 녹음 중 조용한 배지 UI + 녹음 종료 후 재시도 컨트롤 UI를 추가한다.

### 변경 대상 파일

| 파일                                                    | 변경 유형                                                |
| ------------------------------------------------------- | -------------------------------------------------------- |
| `src/hooks/use-batch-transcription.ts`                  | 대규모 수정 (워커 큐, online 리스너, retry 반환 타입)    |
| `src/components/recorder.tsx`                           | 수정 (persistBatchResult, handleRetry, 새 컴포넌트 통합) |
| `src/components/batch-retry-control.tsx`                | 신규 (재시도 배지 + 버튼 UI)                             |
| `src/hooks/__tests__/use-batch-transcription.test.tsx`  | 대규모 추가                                              |
| `src/components/__tests__/recorder-batch.test.tsx`      | 추가 (재시도→파이프라인 연동)                            |
| `src/components/__tests__/batch-retry-control.test.tsx` | 신규                                                     |
| `docs/ARCHITECTURE.md`                                  | 한 줄 추가 (배치 재시도 언급)                            |

## 기술적 접근 방식

### 1. 워커 큐 모델 (`use-batch-transcription.ts`)

현재 `pendingPromisesRef: Set<Promise<void>>`를 제거하고 다음으로 교체한다:

- `queueRef: MutableRefObject<number[]>` — 전사할 세그먼트 인덱스 대기열
- `workerRunningRef: MutableRefObject<boolean>` — 워커 실행 중 여부
- `workerIdlePromiseRef` + `workerIdleResolveRef` — stop/retry가 워커 종료를 대기할 수 있는 Promise

**`enqueueIndices(indices: number[])`**: 큐에 인덱스를 추가하고, 워커가 돌고 있지 않으면 `runWorker()`를 시작한다.

**`runWorker()`**: 큐에서 인덱스를 하나씩 꺼내 `runTranscribeWithRetries`로 순차 처리한다. 큐가 비면 `workerIdleResolveRef`를 호출하여 대기자에게 알린다.

### 2. 세그먼트 회전 시 자동 재시도

5분 회전 콜백에서:

1. `failedSegments`(시간순 정렬 — 인덱스가 곧 시간순)를 큐에 먼저 넣고
2. 현재 새 세그먼트 인덱스를 큐에 추가
3. `enqueueIndices([...failedIndices, newIndex])`

### 3. `window.online` 리스너

`startRecording` 내부에서 `window.addEventListener('online', handler)` 등록. handler는 녹음 중일 때만 `failedSegments`를 `enqueueIndices`에 전달. `stopAndTranscribe` 또는 cleanup 시 리스너 해제.

### 4. `stopAndTranscribe` 변경

1. 세션 정지 + 마지막 세그먼트 추출
2. 마지막 세그먼트를 큐에 넣고 `enqueueIndices`
3. `workerIdlePromise`를 await하여 모든 전사 완료를 대기
4. 실패가 남아 있으면 `status: 'error'` → `BatchStopResult`는 `null` 반환
5. 전부 성공하면 기존 로직대로 `BatchStopResult` 반환

### 5. `retryTranscription` 반환 타입 변경

`string | null` → `BatchStopResult | null`으로 변경하여 Recorder가 파이프라인을 이어갈 수 있도록 한다. 성공 시 `{ partialText, finalBlob: null, segments }` 형태로 반환한다.

### 6. 재시도 진행률 (`retryTotalCount` / `retryProcessedCount`)

훅에서 `retryTotalCount`(재시도 대상 총 수), `retryProcessedCount`(현재까지 처리 완료)를 `useState`로 노출한다. `retryTranscription` 시작 시 total 설정, 각 세그먼트 성공/실패 시 processed 증가.

### 7. `BatchRetryControl` 컴포넌트

- **녹음 중** (`mode: 'recording'`): `failedCount > 0`일 때 작은 배지 `"N개 재시도 대기 중"` 표시
- **녹음 종료 후** (`mode: 'stopped'`): `failedCount > 0`이면 새로고침 아이콘 + 실패 수 + 진행 중이면 `"재시도 중… (k/N)"` 형태의 버튼. 클릭 시 `onRetry` 호출
- `isRetrying` prop으로 재시도 진행 상태 전달

### 8. Recorder 통합

- **`persistBatchResult(result: BatchStopResult)`**: `saveSession` → `saveSessionAudio` → `onSessionSaved` → `enqueuePipeline` 일련의 흐름을 추출한 함수
- **기존 `stop` 콜백**: `stopBatchTranscribe()` 성공 시 `persistBatchResult` 호출, 실패(null) 시 아무것도 하지 않음 (재시도 UI로 전환)
- **`handleRetry` 콜백**: `retryBatchTranscription()` 호출 → 성공 시 `persistBatchResult` → 실패 시 그대로 error 상태 유지
- `saveSession`은 재시도 전부 성공 시점에만 호출됨 (요구사항 6 충족)

## TDD 구현 순서

### Step 1: 워커 큐 — 순차 처리

**RED** — `src/hooks/__tests__/use-batch-transcription.test.tsx`

```typescript
describe("워커 큐 순차 처리", () => {
  it("5분 회전 시 세그먼트가 워커 큐를 통해 순차적으로 전사된다", ...);
  it("두 번 연속 회전 시 첫 번째 완료 후 두 번째가 전사된다", ...);
});
```

- 세그먼트 회전을 2회 발생시키고, fetch 호출 순서가 시간순인지 검증
- 첫 번째 fetch가 resolve 되기 전에 두 번째 fetch가 호출되지 않는지 확인

**GREEN** — `src/hooks/use-batch-transcription.ts`

- `pendingPromisesRef` 제거
- `queueRef`, `workerRunningRef`, `workerIdlePromiseRef` 추가
- `enqueueIndices`, `runWorker` 구현
- 세그먼트 회전 콜백에서 `enqueueIndices([newIndex])` 호출

**REFACTOR** — 기존 `pendingPromisesRef` 참조 정리, `stopAndTranscribe`에서 `Promise.allSettled` → `workerIdlePromise` await로 교체

### Step 2: 회전 시 실패 세그먼트 자동 재시도

**RED** — `src/hooks/__tests__/use-batch-transcription.test.tsx`

```typescript
describe("회전 시 자동 재시도", () => {
  it("이전 세그먼트 전사 실패 후 다음 회전 시 실패분을 먼저 재시도한다", ...);
  it("실패 세그먼트 재시도 성공 후 failedSegments에서 제거된다", ...);
  it("재시도 상한 없이 매 회전마다 실패분을 다시 시도한다", ...);
});
```

- 1번째 회전: fetch를 503으로 응답 → `failedSegments: [0]`
- 2번째 회전: fetch 호출 순서가 `[인덱스 0 재시도, 인덱스 1 신규]`인지 검증
- 재시도 성공 시 `failedSegments`가 빈 배열인지 확인

**GREEN** — `src/hooks/use-batch-transcription.ts`

- 회전 콜백에서 `enqueueIndices([...failedSegments, newIndex])` 패턴 적용
- `runWorker` 내부에서 성공 시 `failedSegments`에서 해당 인덱스 제거

**REFACTOR** — 회전 콜백의 인덱스 조합 로직을 인라인으로 정리

### Step 3: `window.online` 이벤트 재시도

**RED** — `src/hooks/__tests__/use-batch-transcription.test.tsx`

```typescript
describe("online 이벤트 재시도", () => {
  it("녹음 중 online 이벤트 발생 시 failedSegments를 재시도한다", ...);
  it("녹음 중이 아닐 때 online 이벤트는 무시한다", ...);
  it("stopAndTranscribe 후 online 리스너가 해제된다", ...);
});
```

- `failedSegments`에 인덱스가 있는 상태에서 `window.dispatchEvent(new Event('online'))` 발생
- fetch 호출이 발생하는지 확인
- 녹음 중지 후 online 이벤트로 추가 fetch가 발생하지 않는지 확인

**GREEN** — `src/hooks/use-batch-transcription.ts`

- `startRecording`에서 `window.addEventListener('online', onOnline)` 등록
- `onOnline`: `statusRef.current === 'recording'`일 때만 `enqueueIndices([...failedSegments 스냅샷])`
- 정리: `stopAndTranscribe` 및 cleanup effect에서 리스너 제거

**REFACTOR** — 리스너 등록/해제를 `onlineListenerRef`로 관리하여 중복 방지

### Step 4: `stopAndTranscribe` — 워커 대기 후 결과 판정

**RED** — `src/hooks/__tests__/use-batch-transcription.test.tsx`

```typescript
describe("stopAndTranscribe 워커 대기", () => {
  it("stop 호출 시 진행 중인 워커를 대기한 후 결과를 반환한다", ...);
  it("워커 완료 후 실패가 남아있으면 null을 반환하고 error 상태가 된다", ...);
  it("워커 완료 후 전부 성공이면 BatchStopResult를 반환한다", ...);
});
```

- 5분 회전 + 즉시 stop → 워커가 회전 세그먼트 전사 완료를 기다린 뒤 결과 반환 확인
- 실패 시 null 반환, 성공 시 정상 `BatchStopResult` 반환

**GREEN** — `src/hooks/use-batch-transcription.ts`

- `stopAndTranscribe`에서 마지막 세그먼트를 큐에 넣고 `await workerIdlePromise`
- `failedSegments.length > 0`이면 error 상태 + null 반환
- 전부 성공이면 기존 로직대로 `BatchStopResult` 조립

**REFACTOR** — `stopAndTranscribe` 내 `Promise.allSettled` 코드 제거, 중복 실패 체크 정리

### Step 5: `retryTranscription` — `BatchStopResult | null` 반환

**RED** — `src/hooks/__tests__/use-batch-transcription.test.tsx`

```typescript
describe("retryTranscription 반환 타입", () => {
  it("재시도 성공 시 BatchStopResult를 반환한다 (partialText + segments, finalBlob null)", ...);
  it("재시도 실패 시 null을 반환하고 error 상태를 유지한다", ...);
  it("retryProcessedCount가 진행에 따라 증가한다", ...);
});
```

- 기존 retryTranscription 테스트의 반환 타입 검증을 `BatchStopResult` 형태로 변경
- `retryProcessedCount` 값이 각 세그먼트 처리 후 증가하는지 검증

**GREEN** — `src/hooks/use-batch-transcription.ts`

- `retryTranscription` 반환 타입을 `BatchStopResult | null`로 변경
- 성공 시: `{ partialText: join된 전문, finalBlob: null, segments: segmentsRef.current }`
- `retryTotalCount`, `retryProcessedCount` 상태 추가 및 노출
- 처리 루프에서 각 세그먼트 완료 시 `setRetryProcessedCount(prev => prev + 1)`

**REFACTOR** — `UseBatchTranscriptionReturn` 타입에 `retryTotalCount`, `retryProcessedCount` 추가, 기존 테스트 중 `retryTranscription` 반환값이 `string`인 케이스 업데이트

### Step 6: `BatchRetryControl` 컴포넌트

**RED** — `src/components/__tests__/batch-retry-control.test.tsx`

```typescript
describe("BatchRetryControl", () => {
  it("녹음 중 실패가 있으면 'N개 재시도 대기 중' 배지를 표시한다", ...);
  it("녹음 중 실패가 없으면 아무것도 렌더링하지 않는다", ...);
  it("녹음 종료 후 실패가 있으면 다시 시도 버튼과 실패 수를 표시한다", ...);
  it("재시도 진행 중이면 '재시도 중… (k/N)' 텍스트가 표시된다", ...);
  it("버튼 클릭 시 onRetry를 호출한다", ...);
});
```

**GREEN** — `src/components/batch-retry-control.tsx`

- Props: `mode: 'recording' | 'stopped'`, `failedCount: number`, `isRetrying: boolean`, `retryProcessed: number`, `retryTotal: number`, `onRetry: () => void`
- 녹음 중: 배지 (`role="status"`, `data-testid="batch-retry-badge"`)
- 종료 후: 버튼 (`RefreshCw` 아이콘 + 실패 수 + 진행 텍스트)

**REFACTOR** — 아이콘·색상 일관성, aria 속성 정리

### Step 7: Recorder 통합 — `persistBatchResult` + `handleRetry`

**RED** — `src/components/__tests__/recorder-batch.test.tsx`

```typescript
describe("Recorder 배치 재시도 → 파이프라인 연동", () => {
  it("retryTranscription 성공 시 saveSession과 enqueuePipeline이 호출된다", ...);
  it("retryTranscription 실패 시 saveSession이 호출되지 않는다", ...);
  it("녹음 중 실패 세그먼트가 있으면 배지가 표시된다", ...);
  it("녹음 종료 후 실패가 있으면 retry 컨트롤이 표시된다", ...);
});
```

**GREEN** — `src/components/recorder.tsx`

- `persistBatchResult` 함수 추출: `BatchStopResult` → `saveSession` → `saveSessionAudio` → `onSessionSaved` → `enqueuePipeline`
- `stop` 콜백: 기존 인라인 로직을 `persistBatchResult` 호출로 교체
- `handleRetry`: `retryBatchTranscription()` → 성공 시 `persistBatchResult(result)` → 실패 시 noop
- `BatchRetryControl` 렌더링 추가 (녹음 중 + 종료 후 양쪽)

**REFACTOR** — 기존 `stop` 콜백 내 배치 분기의 중복 코드 정리, `handleRetry`와 `stop` 사이 공통 로직을 `persistBatchResult`로 통합

### Step 8: 기존 테스트 호환성 + ARCHITECTURE.md 업데이트

**RED** — 전체 테스트 스위트 실행 (`npm run test`), 기존 테스트 중 `retryTranscription` 반환 타입이 `string`이던 부분에서 실패 확인

**GREEN**

- `src/hooks/__tests__/use-batch-transcription.test.tsx`: 기존 `retryTranscription` 테스트의 assertion을 `BatchStopResult` 형태로 수정
- `src/components/__tests__/recorder-session-resilience.test.tsx`: mock의 `retryTranscription` 반환 타입 수정
- `src/components/__tests__/recorder-ui.test.tsx`: mock에 `retryTotalCount`, `retryProcessedCount` 추가

**REFACTOR** — `docs/ARCHITECTURE.md`의 "일괄 전사(녹음 후) 경로" 섹션에 배치 재시도 메커니즘 한 줄 추가

## 파일 변경 계획

### `src/hooks/use-batch-transcription.ts` (대규모 수정)

- `pendingPromisesRef` 삭제 → `queueRef`, `workerRunningRef`, `workerIdlePromiseRef`, `workerIdleResolveRef` 추가
- `enqueueIndices(indices: number[])` 내부 함수 추가
- `runWorker()` 내부 함수 추가 — 큐에서 인덱스를 하나씩 꺼내 순차 전사
- `retryTotalCount`, `retryProcessedCount` 상태 추가
- 회전 콜백: `[...failedSegments, newIndex]` → `enqueueIndices`
- `startRecording`: `window.addEventListener('online', ...)` 등록
- `stopAndTranscribe`: 마지막 세그먼트를 큐에 넣고 `workerIdlePromise` 대기, `pendingPromisesRef` 관련 코드 제거
- `retryTranscription`: 반환 타입 `BatchStopResult | null`, 순차 처리 + 진행률 갱신
- `UseBatchTranscriptionReturn`에 `retryTotalCount`, `retryProcessedCount` 추가
- cleanup effect: online 리스너 해제 추가

### `src/components/batch-retry-control.tsx` (신규)

- 녹음 중: 작은 배지 `"N개 재시도 대기 중"` (`data-testid="batch-retry-badge"`)
- 종료 후: `RefreshCw` 아이콘 + `"N개 실패"` + 진행 시 `"재시도 중… (k/N)"` 버튼 (`data-testid="batch-retry-button"`)

### `src/components/recorder.tsx` (수정)

- `persistBatchResult(result: BatchStopResult)` 함수 추출
- `stop` 콜백 배치 분기: 인라인 로직 → `persistBatchResult` 호출
- `handleRetry` 콜백 추가: `retryBatchTranscription()` → 성공 시 `persistBatchResult`
- 기존 단순 "다시 시도" 버튼 → `BatchRetryControl` 컴포넌트로 교체
- 녹음 중 배지 영역에 `BatchRetryControl` 조건부 렌더링 추가
- `useBatchTranscription`에서 `retryTotalCount`, `retryProcessedCount` 구조분해

### `docs/ARCHITECTURE.md` (한 줄 추가)

"일괄 전사(녹음 후) 경로" 섹션 끝에: 세그먼트 전사 실패 시 워커 큐 기반 시간순 자동 재시도 + online 이벤트 트리거가 동작하며, 모든 세그먼트 성공 후에만 세션 저장과 회의록 파이프라인이 이어진다는 내용.

## 완료 조건

1. **자동 재시도**: 5분 회전 시 이전 실패 세그먼트가 시간순으로 먼저 재전사된 후 현재 세그먼트가 전사된다
2. **online 이벤트**: 브라우저 online 복구 시 실패 세그먼트 재시도가 트리거된다
3. **재시도 상한 없음**: 녹음 종료 전까지 매 회전·online마다 실패분 재시도
4. **녹음 중 UI**: 실패 시 배지 `"N개 재시도 대기 중"` 표시
5. **녹음 종료 후 UI**: 실패 시 아이콘 + 실패 수 + `"재시도 중… (k/N)"` 버튼 노출
6. **파이프라인 연동**: 모든 세그먼트 성공 후 `saveSession` → `enqueuePipeline` → `/api/meeting-minutes` 호출
7. **세션 저장**: 재시도 전부 성공 시점에만 `saveSession` (부분 저장 없음)
8. **기존 테스트**: `npm run test` 전체 통과
9. **아키텍처 문서**: `ARCHITECTURE.md` 업데이트 완료

## 테스트 전략

### 단위 테스트 (Vitest + happy-dom)

| 파일                                                    | 검증 대상                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/hooks/__tests__/use-batch-transcription.test.tsx`  | 워커 큐 순차 처리, 회전 시 자동 재시도, online 이벤트 재시도, stop 워커 대기, retry 반환 타입, 진행률 카운터 |
| `src/components/__tests__/batch-retry-control.test.tsx` | 배지 조건부 렌더링, 버튼 상태별 텍스트, onRetry 콜백 호출                                                    |
| `src/components/__tests__/recorder-batch.test.tsx`      | 재시도 성공 시 saveSession + enqueuePipeline 호출, 실패 시 미호출                                            |

### 기존 테스트 호환

| 파일                                                            | 수정 내용                                                        |
| --------------------------------------------------------------- | ---------------------------------------------------------------- |
| `src/hooks/__tests__/use-batch-transcription.test.tsx`          | retryTranscription assertion을 `BatchStopResult` 형태로 업데이트 |
| `src/components/__tests__/recorder-session-resilience.test.tsx` | mock의 retryTranscription 반환 타입 수정                         |
| `src/components/__tests__/recorder-ui.test.tsx`                 | mock에 `retryTotalCount`, `retryProcessedCount` 추가             |

### 테스트 기법

- `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()`로 5분 회전 시뮬레이션
- `globalThis.fetch` mock으로 성공/실패 시나리오 제어
- `window.dispatchEvent(new Event('online'))`로 네트워크 복구 시뮬레이션
- `@testing-library/react`의 `renderHook` + `act`로 훅 상태 전이 검증
- `render` + `screen` + `fireEvent`로 컴포넌트 인터랙션 검증
