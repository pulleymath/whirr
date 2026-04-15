---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "feature-15-post-recording-pipeline"
---

# Post-recording pipeline — 개발 계획서

## 개발 범위

녹음 중지 이후의 **마지막 세그먼트 전사 + 요약** 파이프라인을 레이아웃 Context 수준으로 끌어올려, SPA 내비게이션 후에도 완료까지 진행·저장되게 한다. 동시에 세션 저장 시점을 앞당기고(먼저 생성 → 점진 갱신), 네비게이션·동시 녹음 가드, 클립보드 복사, Recorder 오디오 다운로드 제거, 전사 in-flight 로딩 표시를 추가한다.

### 이슈 결정 요약

| #   | 결정                                                             | 구현 영향                                                 |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | 5분 세그먼트 전사는 기존 훅 유지, 마지막 세그먼트+요약만 Context | Pipeline Context 신설                                     |
| 2   | 세션 행 먼저 생성 → 점진 갱신                                    | `updateSession` 추가, `Session` 타입에 `status`·`summary` |
| 3   | `beforeunload` — 전사/요약/녹음 중 경고                          | `useBeforeUnload` 훅                                      |
| 4   | SPA 내비: 녹음 중에만 제한, 전사/요약 중 자유                    | `SessionList` 링크 비활성                                 |
| 5   | 파이프라인 진행 중 → 새 녹음 비허용                              | Pipeline `isBusy` 체크                                    |
| 6   | 클립보드 복사 — 세션 상세만                                      | `session-detail.tsx` 버튼                                 |
| 7   | Mock 요약 API                                                    | `/api/summarize/route.ts`                                 |
| 8   | 세그먼트 전사 in-flight 로딩 표시                                | `transcript-view.tsx`                                     |
| 9   | 홈 Recorder 오디오 다운로드 제거                                 | `recorder.tsx`                                            |

## 기술적 접근 방식

### 핵심 아키텍처 결정: 파이프라인을 Context로 분리

**선택한 접근**: `useBatchTranscription` 훅에서 전사 fetch 로직(`transcribeBlobOnce`, 재시도 로직)을 순수 비동기 유틸 `src/lib/transcribe-segment.ts`로 추출한다. 훅은 녹음 중 5분 세그먼트 전사에 이 유틸을 사용하고, 녹음 중지 시에는 **이미 진행 중인 세그먼트 전사만 대기**한 뒤 마지막 블롭+부분 텍스트를 반환한다. 마지막 세그먼트 전사 + 요약은 `PostRecordingPipelineContext`가 처리한다.

**대안 (기각)**: 훅 내부에서 전부 처리 후 Promise를 Context로 "이전" — 훅의 내부 ref에 의존하므로 생명주기 결합이 강하다. 유틸 추출이 더 깨끗하다.

### 데이터 흐름

```
[녹음 중]
  Recorder → useBatchTranscription (5분 세그먼트 전사, 기존 흐름)
       ↓ rotateSegment → transcribeBlobWithRetries() ← 추출된 유틸

[녹음 중지]
  useBatchTranscription.stopAndCollect()
    → 이미 진행 중인 세그먼트 전사만 대기 (Promise.allSettled)
    → 마지막 블롭 + 부분 텍스트 반환 (마지막 블롭 전사는 안 함)
       ↓
  Recorder
    → saveSession(partialText, { status: 'transcribing' })  ← 세션 먼저 생성
    → saveSessionAudio(sessionId, segments)
    → pipeline.enqueue({ sessionId, finalBlob, partialText, model, language })
    → onSessionSaved(sessionId)  ← 히스토리 목록 즉시 갱신
       ↓
  PostRecordingPipelineContext (레이아웃 수준, SPA 이동해도 유지)
    → transcribeBlobWithRetries(finalBlob)
    → fullText = partialText + " " + finalSegmentText
    → updateSession(sessionId, { text: fullText, status: 'summarizing' })
    → fetch('/api/summarize', { text: fullText })
    → updateSession(sessionId, { summary, status: 'ready' })
```

### streaming/webSpeech 모드 일관성

streaming·webSpeech에서는 전사 텍스트가 이미 완성된 상태로 중지되므로, 세션을 `status: 'summarizing'`으로 생성하고 파이프라인에 요약만 enqueue한다.

## TDD 구현 순서

(계획서 본문의 Step 1–8은 구현 시 참조 — 원문과 동일)

## 파일 변경 계획

계획 Task 원문의 표와 동일.

## 완료 조건

- `npm test`, `tsc`, eslint, build 통과
- 기능 검증 항목은 계획 Task 원문과 동일

## 테스트 전략

계획 Task 원문과 동일.
