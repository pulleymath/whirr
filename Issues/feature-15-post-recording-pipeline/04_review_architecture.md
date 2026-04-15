---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "feature-15-post-recording-pipeline"
  review_kind: architecture
---

# Architecture & Code Style Review

## Summary

`feature-15` 계획서의 핵심 구조(배치 훅 ↔ `transcribe-segment` 유틸 분리, 레이아웃 단 `PostRecordingPipelineProvider`, 세션 선저장·점진 갱신, 녹음 중 내비 제한용 별도 Context)는 `docs/ARCHITECTURE.md`가 말하는 **브라우저 vs 호스팅 앱 경계**와도 잘 맞습니다. 다만 파이프라인 Context 한 파일에 **오케스트레이션·상태·I/O·JSON 파싱**이 몰려 있어 유지보수 시 응집도/가독성 측면에서 다듬을 여지가 있습니다. 치명적인 아키텍처 위반은 보이지 않습니다.

## Architecture Findings

### 잘 맞는 점 (계획·문서 정합)

- **신뢰 경계**: `transcribe-segment.ts`는 클라이언트에서 `/api/stt/transcribe`만 호출하고, `PostRecordingPipelineProvider`는 `/api/summarize`와 IndexedDB(`updateSession`)를 조합합니다. 장기 키는 서버에 두는 기존 가정을 깨지 않습니다.
- **계획 대비 구현**: `01_plan.md`의 “유틸 추출 + 마지막 블롭은 훅 밖(Context)에서 전사” 흐름이 `use-batch-transcription.ts`의 `stopAndTranscribe` 반환값(`partialText`, `finalBlob`)과 `context.tsx`의 `enqueue` 처리로 그대로 이어집니다.
- **레이아웃 수준 상태**: `MainAppProviders`에 `PostRecordingPipelineProvider`를 넣어 SPA 이동 후에도 파이프라인이 살아 있게 한 선택은 계획과 일치합니다.
- **내비 정책 분리**: 전사/요약 중 자유·녹음 중만 링크 비활성이라는 결정을 `RecordingActivityProvider` + `SessionList`로 나눈 것은 **파이프라인 busy와 녹음 상태를 decouple**하는 데 유리합니다.

### 주의·개선 (아키텍처 관점)

| 심각도         | 내용                                                                                                                                                                                                                                                                                                            | 권장                                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Important**  | `PostRecordingPipelineProvider`가 전사 재시도, DB 갱신, 요약 fetch, phase/타이머, 에러 문구까지 한 컴포넌트에서 처리합니다. 기능 단위로는 맞지만, **“파이프라인 단계”와 “부수 효과(I/O)”**가 한 덩어리라 테스트·재사용 시 파일 단위가 무거워집니다.                                                             | 비동기 본문을 `runPostRecordingPipeline(input, deps)` 같은 **순수 모듈**로 빼고 Provider는 구독·abort·phase만 두는 식으로 층을 나누는 것을 검토하세요. |
| **Suggestion** | `docs/ARCHITECTURE.md`의 “일괄 전사 경로”는 `POST /api/stt/transcribe`까지 잘 설명하지만, 이번에 추가된 **요약 프록시(`/api/summarize`)**와 세션의 `status`·`summary` 필드는 문서에 없습니다. 구현과 개념 문서가 어긋납니다.                                                                                    | 아키텍처 문서에 “녹음 후 파이프라인(마지막 세그먼트 전사 → 요약 → 로컬 세션 갱신)” 한 단락을 추가하는 편이 이후 온보딩에 유리합니다.                   |
| **Suggestion** | `Recorder`가 배치/스트리밍/파이프라인/UI 파생값(`deriveSummaryTabState`, `batchTranscriptText`, 세그먼트 in-flight 등)을 많이 담당합니다. **단일 진입 컴포넌트**로서는 자연스럽지만, 파일 크기·책임이 계속 커지면 “표시용 selector”를 `useRecorderTranscriptDisplay` 같은 훅으로 옮기는 패턴이 읽기 좋아집니다. | 동작 변경 없이 읽기 전용 파생 로직만 분리할 때 효과가 큽니다.                                                                                          |

## Code Style Findings

| 심각도         | 내용                                                                                                                                                                                                                                                                | 권장                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Suggestion** | `context.tsx`에서 요약 응답을 `unknown` + 수동 `"summary" in data` 가드로 파싱합니다. `src/app/api/summarize/route.ts`에 이미 `SummarizeResponseBody` 타입이 있습니다.                                                                                              | 클라이언트에서도 동일 스키마를 import하거나, `parseSummarizeResponse(data: unknown): string` 같은 **작은 파서**로 빼면 중복과 줄 길이가 줄어듭니다. |
| **Suggestion** | `use-batch-transcription.ts`는 ref·상태가 많아 한 파일이 깁니다. 스타일/가독성 측면에서 **상수 블록**, **“세그먼트 루프/정지” 섹션 주석**, 또는 내부 헬퍼 함수 분리만으로도 읽는 순서가 좋아집니다.                                                                 | 동작 변경 없이 구획만 나누는 수준을 권장합니다.                                                                                                     |
| **Suggestion** | 테스트에서 `vi.mock("@/lib/post-recording-pipeline/context", …)`로 훅만 부분 대체하는 패턴은 일관되고 좋습니다. 다만 mock이 반환하는 객체가 여러 테스트 파일에 복제되면 **공통 `createMockPostRecordingPipeline()`** 팩토리로 모으는 편이 스타일 일관에 유리합니다. | 중복이 늘어날 때만 추출해도 됩니다.                                                                                                                 |
| **(양호)**     | `transcribe-segment.ts`는 `"use client"` 없이 순수 모듈로 두어, 훅·Context·테스트에서 재사용하기 좋습니다. 네이밍도 `BATCH_*` / `transcribeBlobOnce` 등 역할이 분명합니다.                                                                                          | 유지.                                                                                                                                               |
| **(양호)**     | `RecordingActivityProvider`는 최소 API(`isRecording`, `setIsRecording`)로 `SessionList` 결합도를 낮게 유지합니다.                                                                                                                                                   | 유지.                                                                                                                                               |

## Verdict

**승인 가능(아키텍처·코드 스타일 기준).** 계획서의 경계 설계(유틸 분리, 레이아웃 Context, 녹음 전용 내비 가드)는 코드에 반영되어 있고, `ARCHITECTURE.md`의 브라우저/서버 역할 구분과도 충돌하지 않습니다. merge 전·후로 손보기 좋은 것은 **파이프라인 Provider의 I/O 분리**, **요약 응답 파싱 정리**, **문서에 요약 단계 반영** 정도입니다.
