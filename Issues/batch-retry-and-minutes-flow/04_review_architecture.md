---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: batch-retry-and-minutes-flow
  review_kind: architecture
---

## Summary

배치 전사를 **단일 워커 + 큐(Set으로 중복 제거, 정렬로 시간순)**로 묶고, **`retryTranscription` → `BatchStopResult`**로 바꿔 Recorder의 **`persistBatchResult` → 로컬 저장 → `enqueuePipeline`** 경로를 재사용한 점은 `docs/ARCHITECTURE.md`의 **브라우저 오케스트레이션 / 서버는 텍스트·회의록만** 경계와 잘 맞습니다. `window.online`은 녹음 중에만 큐를 돌리고 `status !== "recording"`이면 이펙트가 정리되며, 녹음 종료 후 실패 시 파이프라인을 타지 않도록 한 흐름도 요구사항 방향과 일치합니다.

다만 계획서 **Step 7·완료 조건**에 적힌 **Recorder 수준의 재시도→저장·파이프라인 통합 테스트**는 본 브랜치 diff에 포함되지 않았고(`recorder-batch.test.tsx`는 `main`과 동일), 구현 세부도 계획 문구(예: `online` 등록 위치, `stop`에서 마지막 세그먼트 큐잉)와 일부 어긋납니다. 기능은 대체로 타당해 보이나 **계획 대비 테스트·문서 정합성**에서 감점 요인이 있습니다.

## Findings

### 잘된 점 (아키텍처·경계)

- **레이어 분리**: STT 호출은 기존처럼 `transcribeBlobWithRetries`에 두고, 세션 저장·파이프라인은 Recorder의 `persistBatchResult`에 모아 **UI가 “언제 저장할지”만 결정**하는 형태가 명확합니다.
- **신뢰 경계**: 오디오는 클라이언트 Blob으로만 다루고, 서버로는 검증된 업로드 경로를 쓰는 기존 패턴을 유지합니다(`ARCHITECTURE.md`와 정합).
- **동시성 모델**: `pendingPromisesRef` 제거 후 **한 워커가 큐를 순차 소비**해 “시간순 엄격 순차” 요구에 부합합니다. 회전 시 `toEnqueue`에 이전 `null` partial 인덱스를 먼저 넣은 뒤 신규 인덱스를 append하고, `enqueueIndices`에서 인덱스 정렬로 순서를 보강한 것도 합리적입니다.
- **온라인 복구**: `status === "recording"`일 때만 리스너를 걸고, 핸들러에서도 `statusRef`로 한 번 더 가드한 점은 **녹음 중이 아닐 때 무시** 요구와 맞습니다.
- **Recorder 측 안전장치**: `handleBatchRetry`의 `batchRetryInFlightRef` + `pipeline.isBusy`, `useBeforeUnload`에 배치 `transcribing` 포함은 **이중 제출·탭 이탈** 리스크를 줄입니다.

### Critical (반드시 수정 권장)

- **비동기 오류 전파**: `enqueueIndices`가 `void runWorker()`로 워커를 시작합니다. `runWorker`는 `try/catch`에서 `rethrow`하므로, 하위 `transcribeBlobWithRetries` 등이 **throw**하면 **처리되지 않은 Promise rejection**이 될 수 있습니다. `stopAndTranscribe` / `retryTranscription`은 `await awaitWorkerIdle()`만으로는 그 rejection을 잡지 못할 수 있어, **워커 루프에서 throw를 삼키거나 상위로 연결(예: runWorker 반환 Promise를 추적해 await)**하는 쪽이 안전합니다.

### Important (수정 권장)

- **계획 대비 테스트 공백**: `01_plan.md` Step 7·테스트 전략표는 `src/components/__tests__/recorder-batch.test.tsx`에 **재시도 성공 시 `saveSession`+`enqueue` / 실패 시 미호출 / 배지·컨트롤 노출** 등을 추가할 것을 명시합니다. 현재 `git diff main`에 해당 파일이 없고, 워크스페이스의 `recorder-batch.test.tsx`는 **기존 배치 흐름만** 다루므로, **이번 변경의 Recorder 통합 회귀 방지**가 약합니다. 최소한 Step 7에 적힌 시나리오를 이 파일(또는 동등한 통합 테스트)에 반영하는 것이 좋습니다.
- **`online` 등록 위치**: 계획은 `startRecording` 내부 등록을 가정하지만, 구현은 **`status === "recording"`인 동안만** `useEffect`로 등록합니다. 동작은 대체로 동등하지만, “계획서와 코드 위치 불일치” 및 **effect 의존성(`[status]`)만으로 생명주기를 관리**한다는 점은 온보딩·리뷰 시 혼동을 줄이려면 계획서를 짧게 고치거나 주석으로 의도를 박아 두는 편이 낫습니다.
- **`stopAndTranscribe` vs 계획 문구**: 계획은 마지막 세그먼트까지 큐에 넣어 워커가 끝날 때까지 기다린다고 적혀 있으나, 구현은 **마지막 인덱스는 워커가 전사하지 않고 `finalBlob`으로만 반환**합니다. 훅 주석(“진행 중인 세그먼트만… 마지막은 반환”)과 제품 동작 측면에서는 **타당한 편차**로 보이나, **계획서·이슈 문구와 불일치**이므로 문서/계획을 코드에 맞추는 정리가 필요합니다.

### Suggestions (있으면 좋음)

- **`BatchRetryControl` API**: 녹음 중 모드에서는 `isRetrying`, `retryProcessed`, `retryTotal`, `onRetry`(no-op)가 **쓰이지 않습니다**. `mode`별로 props를 분리한 union 타입이면 결합도와 실수 여지가 줄어듭니다.
- **`Issues/batch-retry-and-minutes-flow/00_issue.md`**: “계획은 루트 외부 Cursor 플랜”이라고 되어 있는데 저장소에 `01_plan.md`가 생겼으므로, **참조 경로를 저장소 내부로** 맞추면 이슈 추적이 깔끔합니다.
- **`enqueueIndices`의 `raw` 변수**: `const index = raw`는 불필요해 보이며, 팀 스타일에 맞게 정리할 여지가 있습니다.

## Verdict

**PASS_WITH_NOTES**

- **아키텍처·신뢰 경계·Recorder/훅 분리**는 전반적으로 양호하고 `ARCHITECTURE.md` 업데이트도 의도를 잘 반영합니다.
- 다만 **계획서가 요구한 Recorder 통합 테스트가 diff에 없고**, **`void runWorker()` 기반의 잠재적 미처리 rejection**은 머지 전에 다루는 것이 좋습니다. 이 둘을 해소하면 **PASS**로 올리기 쉽습니다.
