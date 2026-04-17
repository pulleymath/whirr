---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: batch-retry-and-minutes-flow
  review_kind: implementation
---

# Implementation & Test Review

## Summary

워커 큐(`queueRef` / `queueSetRef` / `runWorker` / `awaitWorkerIdle`), 회전 시 `toEnqueue`(이전 `null` partial + 신규 인덱스), `retryTranscription`의 `BatchStopResult | null` 반환 및 진행률 상태, `Recorder`의 `persistBatchResult`·`handleBatchRetry`·`BatchRetryControl` 통합, `ARCHITECTURE.md` 보강은 요구 방향과 대체로 맞습니다. 다만 계획서에 명시된 **Recorder 통합 테스트(`recorder-batch.test.tsx`) 추가**와 훅 쪽 **TDD로 적어둔 다수의 전용 테스트(순차 처리·회전 시 실패 우선 재시도·online 부정/정리 등)**가 diff 상 반영되지 않았거나 기존 테스트만으로는 검증이 약합니다. `stopAndTranscribe`는 계획 문구상 “마지막 세그먼트를 큐에 넣음”과 달리 **마지막 인덱스는 `finalBlob`로만 넘기고 워커에는 넣지 않는** 기존 제품 모델을 유지한 것으로 보이며, 이는 파이프라인 설계와는 일치하지만 계획 문서와의 문구 불일치는 남습니다.

## Plan Compliance

| 계획 항목                                             | 상태       | 비고                                                                                                                 |
| ----------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| `pendingPromisesRef` 제거 → 워커 큐                   | 충족       | `queueRef`/`runWorker`/`enqueueIndices`/`awaitWorkerIdle`                                                            |
| 회전 시 `[...실패, newIndex]` enqueue                 | 충족       | `toEnqueue`: `i < index` 중 `partial === null` + `index`                                                             |
| `window.online` + 녹음 중만 재시도                    | 부분 충족  | `useEffect([status])`에서 `status === "recording"`일 때만 등록·해제; 계획은 `startRecording` 내부 등록과 문구 상이   |
| `stopAndTranscribe`에서 워커 대기 후 성공/실패 판정   | 부분 충족  | `awaitWorkerIdle` + 구간 검증; **마지막 세그먼트는 큐에 넣지 않음**(의도적일 가능성 높음, 계획 Step 4 문구와 불일치) |
| `retryTranscription` → `BatchStopResult \| null`      | 충족       | + `finalBlob: null`, `segments`                                                                                      |
| `retryTotalCount` / `retryProcessedCount`             | 부분 충족  | 상태·훅 반환 있음; **진행률 전용 단위 테스트는 계획 대비 약함**(재시도 경로에서만 `trackRetryProgressRef`)           |
| `BatchRetryControl`                                   | 부분 충족  | 계획의 `data-testid="batch-retry-button"` 없음; `role`+`aria-label` 중심                                             |
| `Recorder`: `persistBatchResult`, `handleRetry`, 배지 | 충족       | `useBeforeUnload`에 `transcribing` 포함은 합리적 확장                                                                |
| `recorder-batch.test.tsx`에 파이프라인 연동 테스트    | **미충족** | `git diff main`에 해당 파일 없음; 파일 내용에도 retry/persist 관련 검색 결과 없음                                    |
| `use-batch-transcription.test.tsx` 대규모 시나리오    | **부분**   | online 성공 1건·기존 케이스 타이머 조정·retry 반환 검증; 계획의 다수 `describe` 블록 미구현                          |
| `ARCHITECTURE.md`                                     | 충족       | 한 문단 수준으로 반영                                                                                                |
| 완료 조건 8 (`npm run test` 전체 통과)                | 미검증     | 본 리뷰에서 테스트 명령은 실행하지 않음                                                                              |

## Findings

### [Important] 계획 Step 7 — `recorder-batch.test.tsx` 통합 테스트 미이행

계획서는 `retryTranscription` 성공 시 `saveSession`·`enqueuePipeline`, 실패 시 미호출, 녹음 중 배지·종료 후 컨트롤 노출 등을 `src/components/__tests__/recorder-batch.test.tsx`에 추가하도록 했습니다. 현재 브랜치 diff에는 이 파일이 없고, 워크스페이스의 `recorder-batch.test.tsx`에도 해당 주제의 테스트가 보이지 않습니다. **Recorder 통합과 파이프라인 연동(완료 조건 6·7)**은 코드로는 들어갔으나 테스트로 고정되지 않았습니다.

### [Important] 계획 Step 1·2·4·5 — 훅 단위 테스트가 TDD 범위를 충분히 덮지 못함

`use-batch-transcription.test.tsx`에는 계획에 나온 다음류가 빠져 있거나 한 건만 존재합니다.

- 두 번 연속 회전 시 **fetch가 겹치지 않고 시간순(또는 큐 순서)으로만** 호출되는지
- 첫 회전 실패 후 두 번째 회전에서 **`[실패 인덱스, 신규 인덱스]` 순서**로 호출되는지
- `online`에 대해 **녹음 중이 아닐 때 무시**, **`stopAndTranscribe` 이후 추가 fetch 없음** 등

구현(`enqueueIndices`의 정렬, 회전 시 `toEnqueue`)은 요구에 가깝지만, **완료 조건 1·2·3**을 테스트로 봉인하지 못했습니다.

### [Suggestion] `BatchRetryControl`와 계획의 test id 불일치

계획은 종료 후 버튼에 `data-testid="batch-retry-button"`을 명시합니다. 현재는 `aria-label`과 역할 기반 쿼리로 테스트해 동작은 검증 가능하나, 계획·다른 테스트와의 일관성을 위해 test id 추가를 고려할 수 있습니다.

### [Suggestion] 계획 문서 vs `stopAndTranscribe`의 “마지막 세그먼트 큐잉”

구현은 `lastIdx`를 워커에 넣지 않고 `finalBlob`로 반환합니다. 제품 동작으로 타당하면 **계획서 Step 4를 실제 설계에 맞게 수정**하는 편이 이후 리뷰·온보딩에 유리합니다.

### [Suggestion] 구현은 잘 된 부분(유지 권장)

- `queueSetRef`로 중복 enqueue 방지, `sort`로 인덱스(시간) 순 처리.
- `runWorker`의 “큐에 다시 들어온 작업” 루프 처리.
- `retryTranscription`에서 워커 큐 재사용 및 `BatchStopResult` 조립.
- `Recorder`에서 `persistBatchResult` 단일화 및 재시도 시 `batchRetryInFlightRef`로 중복 클릭 완화.

## Test Coverage Assessment

| 영역                                               | 평가                                                                                                                                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `batch-retry-control.test.tsx`                     | 배지·무실패·종료 후 클릭·진행 중 비활성 문구 등 핵심 UI는 얇지만 존재. 계획의 5개 it와 거의 동등.                                                                                                   |
| `use-batch-transcription.test.tsx`                 | 기존 시나리오에 타이머 버퍼를 늘리고, online 성공·retry 결과 형태를 보강한 점은 좋음. 그러나 **워커 순차성·실패 우선 재시도·online 부정/리스너·retry 진행률 단계** 등 계획 표의 행을 커버하지 못함. |
| `recorder-session-resilience` / `recorder-ui` mock | 훅 시그니처 변경에 맞춘 수정으로 보이며 호환 목적에 적합.                                                                                                                                           |
| `recorder-batch.test.tsx`                          | 본 기능의 **saveSession / enqueuePipeline 연동**을 검증하는 신규/갱신 테스트가 없음 — 가장 큰 구멍.                                                                                                 |

## Verdict

**NEEDS_FIXES**
