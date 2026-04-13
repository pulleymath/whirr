---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "feature-14-batch-transcription-refinement"
---

# 배치 전사 시스템 개선 — 개발 계획서

## 개발 범위

1. **마지막 청크 누락 및 전사 결과 합산 버그 수정**: `stopAndTranscribe` 시점에 진행 중인 백그라운드 전사 Promise들을 모두 기다리도록 개선.
2. **녹음 시간 제한 완화**: `BATCH_HARD_LIMIT_MS`를 60분에서 240분(4시간)으로 상향.
3. **전사 진행률 UI**: 총 세그먼트 대비 완료된 전사 수를 추적하여 `(완료/전체)` 형태로 표시.
4. **단일 오디오 파일 저장**: `MediaRecorder`를 중지하지 않고 `requestData()`를 사용하여 5분마다 청크를 추출하고, 최종적으로 모든 청크를 하나의 Blob으로 병합하여 저장.
5. **UX 개선**:
   - **5-1. 실시간 부분 전사**: 녹음 중에도 완료된 세그먼트의 결과를 즉시 노출.
   - **5-2. 세그먼트별 재시도**: 실패한 세그먼트만 식별하여 개별 재시도 가능하도록 로직 개선.
   - **5-4. 인라인 오디오 플레이어**: `SessionDetail` 페이지에 오디오 재생 기능 추가.

## 기술적 접근 방식

- **Promise 추적**: `Set<Promise<string | null>>`을 사용하여 진행 중인 전사를 추적.
- **MediaRecorder 제어**: `MediaRecorder.start(SEGMENT_DURATION_MS)` 대신 `start()` 후 `setInterval`에서 `requestData()` 호출.
- **데이터 병합**: `new Blob(allChunks, { type: mimeType })`를 사용하여 단일 파일 생성.
- **상태 관리**: `completedCount`, `totalCount`, `failedSegments` 등 추가 상태 도입.

## TDD 구현 순서

### Step 1: 오디오 세그먼트 회전 및 병합 로직 개선 (audio.ts)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/__tests__/audio-segmented-recording.test.ts`
- 케이스: `rotateSegment` 호출 시 기존 리코더가 중지되지 않고 데이터만 추출되는지 확인. 최종 Blob이 모든 데이터를 포함하는지 확인.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/audio.ts`
- 내용: `requestData()` 기반의 세그먼트 추출 로직 구현.

**REFACTOR** — 코드 개선

- `MediaRecorder`의 `ondataavailable` 핸들러 최적화.

### Step 2: 전사 Promise 추적 및 결과 합산 (use-batch-transcription.ts)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/hooks/__tests__/use-batch-transcription.test.tsx`
- 케이스: `stopAndTranscribe` 호출 시 지연되는 백그라운드 전사가 완료될 때까지 기다리는지 확인.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/hooks/use-batch-transcription.ts`
- 내용: `pendingPromisesRef` 추가 및 `Promise.allSettled` 대기 로직 구현.

### Step 3: 진행률 및 실시간 전사 UI (recorder.tsx)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-batch.test.tsx`
- 케이스: 녹음 중 `transcript`가 업데이트되는지, 진행률 텍스트가 올바른지 확인.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/hooks/use-batch-transcription.ts`, `src/components/recorder.tsx`
- 내용: `completedCount`, `totalCount` 상태 추가 및 UI 연동.

### Step 4: 세그먼트별 오류 관리 및 재시도

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/hooks/__tests__/use-batch-transcription.test.tsx`
- 케이스: 특정 세그먼트 실패 시 `failedSegments`에 기록되는지, `retry` 시 해당 세그먼트만 다시 시도하는지 확인.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/hooks/use-batch-transcription.ts`
- 내용: `failedSegmentsRef` 및 개별 재시도 로직 구현.

### Step 5: 인라인 오디오 플레이어 (session-detail.tsx)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/session-detail-audio.test.tsx`
- 케이스: 오디오 데이터가 있을 때 `<audio>` 태그가 렌더링되는지 확인.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/session-detail.tsx`
- 내용: `URL.createObjectURL`을 사용한 오디오 플레이어 추가.

## 파일 변경 계획

- `src/lib/audio.ts`: `MediaRecorder` 제어 방식 변경.
- `src/hooks/use-batch-transcription.ts`: Promise 추적, 진행률, 실시간 합산, 개별 재시도 로직 추가.
- `src/components/recorder.tsx`: 진행률 UI 및 실시간 전사 연동.
- `src/components/session-detail.tsx`: 오디오 플레이어 추가.

## 완료 조건

- 모든 세그먼트의 전사가 누락 없이 합산됨.
- 녹음 중에도 전사된 내용이 실시간으로 표시됨.
- 4시간 이상의 장시간 녹음이 가능함 (논리적 제한 완화).
- 오디오가 단일 파일로 저장 및 다운로드됨.
- 상세 페이지에서 오디오 재생 가능.

## 테스트 전략

- `Vitest` + `HappyDOM`을 사용한 유닛 및 통합 테스트.
- `MediaRecorder`의 `requestData` 동작 모킹 강화.
- 비동기 전사 완료 시점 제어를 위한 `vi.advanceTimersByTime` 활용.
