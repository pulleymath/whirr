---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "feature-15-post-recording-pipeline"
  review_kind: implementation
---

# Implementation & Test Review

## Summary

`feature-15-post-recording-pipeline` 브랜치는 `01_plan.md` / `00_issue.md`의 핵심 결정(파이프라인 Context, 세션 선저장·`updateSession`, `beforeunload`, 녹음 중에만 세션 목록 링크 비활성, 파이프라인 busy 시 녹음 차단, 상세 클립보드, Mock 요약 API, 세그먼트 in-flight UI, Recorder 오디오 다운로드 제거)을 코드에 반영했습니다. `transcribe-segment` 추출·`stopAndTranscribe`가 마지막 블롭만 넘기는 흐름도 계획서 데이터 흐름과 맞습니다.

다만 **`git diff main`에는 추적되지 않은(`??`) 파일이 포함되지 않습니다.** 실제 구현의 상당 부분(`post-recording-pipeline/context.tsx`, `transcribe-segment.ts`, `use-before-unload.ts`, `/api/summarize`, 관련 테스트, 이슈 문서)은 워킹 트리에만 있어 diff만으로는 피처 완결성을 판단할 수 없었고, 본 리뷰는 워크스페이스 파일까지 읽어 검증했습니다.

검증 명령: `npm test`(265 tests 통과), `tsc --noEmit`, `eslint`, `npm run build` 모두 성공했습니다.

## Plan Compliance

| #   | 계획 결정                                                   | 구현 대응                                                                              | 상태 |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---- |
| 1   | 5분 세그먼트는 훅 유지, 마지막+요약만 Context               | `useBatchTranscription` + `transcribeBlobWithRetries`, `PostRecordingPipelineProvider` | 충족 |
| 2   | 세션 먼저 생성 → 점진 갱신                                  | `saveSession(..., { status })`, `updateSession`, `Session`에 `status`·`summary`        | 충족 |
| 3   | `beforeunload` — 전사/요약/녹음 중                          | `useBeforeUnload(recordingActive \|\| pipeline.isBusy)`                                | 충족 |
| 4   | SPA 내비: 녹음 중만 제한                                    | `SessionList` + `useRecordingActivity().isRecording` 시 `Link` 대신 비활성 `span`      | 충족 |
| 5   | 파이프라인 진행 중 새 녹음 비허용                           | `pipeline.isBusy` 시 `start` 조기 반환 + 녹음 시작 버튼 `disabled`                     | 충족 |
| 6   | 클립보드는 세션 상세만                                      | `session-detail.tsx` `navigator.clipboard` + aria-label                                | 충족 |
| 7   | Mock 요약 API                                               | `POST /api/summarize` 지연 + `[Mock 요약]` 접두                                        | 충족 |
| 8   | 세그먼트 in-flight 로딩                                     | `TranscriptView` `isSegmentInFlight` + `transcript-segment-loading`                    | 충족 |
| 9   | 홈 Recorder 오디오 다운로드 제거                            | `recorder.tsx`에서 다운로드 버튼 제거(상세는 유지)                                     | 충족 |
| —   | streaming/webSpeech: 텍스트 완성 시 `summarizing` 후 요약만 | `stop` 비-batch 경로에서 `saveSession(..., summarizing)` + `finalBlob: null` + enqueue | 충족 |

## Findings (severity)

### Important

1. **`enqueue` 단일 in-flight 가드** (`context.tsx`): `inFlightRef.current`가 이미 true이면 두 번째 `enqueue`는 조용히 무시됩니다. 정상 단일 세션 흐름에서는 문제 없으나, 동시에 두 건이 쌓이는 비정상/버그 경로에서는 두 번째 저장·파이프라인이 유실될 수 있습니다. 필요 시 큐 또는 “이미 처리 중” 사용자 피드백을 고려할 수 있습니다.

2. **`PostRecordingPipelineProvider` 단위 테스트 부재**: Recorder 테스트는 `usePostRecordingPipeline`을 목으로 바꿔 실제 `enqueue` → 전사 → `updateSession` → 요약 fetch 시퀀스를 검증하지 않습니다. 회귀 방지를 위해 Provider를 `vi.mock` 없이 DB·fetch를 목킹하는 소수의 통합 테스트가 있으면 계획의 “핵심 경로 검증”에 더 직접적으로 부합합니다.

3. **신규 파일 미추적**: 위 피처의 핵심 파일이 아직 `git add` 되지 않았다면 PR/리뷰에서 누락되기 쉽습니다. 브랜치에 반드시 포함되는지 확인하는 것이 좋습니다.

### Suggestions

1. **`isBusy`가 `phase === "done"`일 때도 true** (`context.tsx`): 요약 완료 직후 짧은 구간(`IDLE_RESET_MS`) 동안에도 `pipeline.isBusy`가 true라 “이전 녹음을 처리 중” 메시지·녹음 비활성이 유지됩니다. 의도된 UX면 유지해도 되고, “처리 완료 직후”만 완화하려면 `done` 구간의 `isBusy` 정의를 조정할 수 있습니다.

2. **`useBeforeUnload` 테스트**: 리스너 등록/해제만 검증하고, `preventDefault`/`returnValue` 동작은 검증하지 않습니다. 브라우저 환경 한계는 있으나, 핸들러가 기대한 속성을 건드리는지 스파이로 보강할 여지는 있습니다.

3. **테스트 실행 로그**: `npm test`는 전부 통과하지만 콘솔에 다수의 `POST .../transcribe 500` 및 happy-dom `AbortError` 스택이 출력됩니다. 실패는 아니나 CI 로그 노이즈·디버깅 혼동을 줄이려면 해당 테스트의 로깅/모킹을 정리할 수 있습니다.

## Test Coverage Assessment

| 영역                                    | 테스트                              | 평가                                        |
| --------------------------------------- | ----------------------------------- | ------------------------------------------- |
| DB `saveSession`/`updateSession`·status | `db.test.ts`                        | 양호                                        |
| 전사 유틸 재시도·abort                  | `transcribe-segment.test.ts`        | 양호                                        |
| Mock 요약 API                           | `summarize/__tests__/route.test.ts` | 양호                                        |
| `beforeunload` 훅                       | `use-before-unload.test.ts`         | 최소 수준(등록 여부 중심)                   |
| 배치 훅 stop 결과·세그먼트 대기         | `use-batch-transcription.test.tsx`  | 계획 변경(마지막 블롭 미전사)에 맞게 갱신됨 |
| Recorder 배치 중지 → 선저장·enqueue     | `recorder-batch.test.tsx`           | 양호(파이프라인 목)                         |
| 스트리밍 저장 상태                      | `recorder-session-storage.test.tsx` | `summarizing` 반영                          |
| 세션 목록 녹음 중 링크                  | `session-list.test.tsx`             | Provider 래핑으로 컨텍스트 요구 충족        |
| 상세 클립보드                           | `session-detail.test.tsx`           | 양호                                        |
| 전사 뷰 in-flight                       | `transcript-view.test.tsx`          | 양호                                        |
| 파이프라인 Context 본체                 | —                                   | 테스트 없음(위 Important 참고)              |

## Verdict

**조건부 통과(구현·테스트 관점).** 계획서 대비 기능 매핑과 데이터 흐름은 일치하고, `npm test` / `tsc` / eslint / build는 통과했습니다. 다만 **`git diff main`만으로는 추적되지 않은 신규 파일이 보이지 않으므로**, 머지 전에 해당 파일 전부가 커밋에 포함되는지 확인하고, **파이프라인 Provider 직접 검증 테스트**와 **`enqueue` 중복 호출 시 동작**을 한 번 더 점검하면 완료 조건에 더 안전하게 부합합니다.
