---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "feature-10-batch-transcription"
  review_kind: implementation
---

# Implementation & Test Review

## Summary

`feature-10-batch-transcription`은 계획서의 핵심 산출물(`startBlobRecording`, `POST /api/stt/transcribe`, `useBatchTranscription`, Recorder 배치 분기, `TranscriptView` 확장, `user-facing` 매핑, `maxDuration`)이 구현되었고 **`npm run test`(38 파일 / 168 테스트) 전부 통과**합니다. 실시간 경로는 `mode === "realtime"`일 때 기존 `prepareStreaming` / `useRecorder` 흐름을 유지하고, `webSpeechApi`만 미지원으로 남겨 계획과 맞습니다.

다만 계획 **TDD Step 4**에 명시된 **55분 경고·60분 자동 전사**에 대한 `vi.useFakeTimers()` 기반 테스트가 없고, **Step 5**의 **docs 다수 갱신**은 diff에 없으며 `Issues/STATUS.md`는 Feature 10을 여전히 “진행 중”으로 표기합니다. 또한 계획에 적힌 일부 단위 테스트 항목(예: opus 미지원 시 webm 폴백, 업스트림 비 JSON 본문)은 테스트로 고정되지 않았습니다.

## Plan Compliance

| 계획 항목 (`01_plan.md` / 완료 조건)                     | 상태                          | 비고                                                                       |
| -------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| `startBlobRecording` + `BlobRecordingSession` + Analyser | **충족**                      | `pickWebmRecordingMimeType` 분리, `happy-dom` 단위 테스트                  |
| opus → webm 폴백 동작                                    | **부분**                      | 런타임 로직은 있으나, 목에서 opus 미지원 시나리오 테스트 없음              |
| `POST /api/stt/transcribe` 프록시·`{ text }`             | **충족**                      | OpenAI URL·FormData·`language`/`auto` 처리                                 |
| 레이트 리밋·25MB·MIME·503/502 등                         | **충족**                      | `stt-transcribe-constants`, `resetSttTokenRateLimitForTests` 사용          |
| `useBatchTranscription` 상태 머신·FormData               | **충족**                      | `stopAndTranscribe`가 `Promise<string \| null>` 반환(Recorder 저장에 유리) |
| Recorder 배치 UI·저장·요약 탭 후처리                     | **충족**                      | `persistAfterTranscript`로 실시간/배치 공통화                              |
| 55분 안내·60분 자동 전사                                 | **구현 충족 / 테스트 미충족** | 훅 `setInterval` + `autoHardRef`; 계획한 타이머 테스트 없음                |
| `TranscriptView` 배치 안내·전사 중 로딩                  | **충족**                      | `emptyStateHint`, `loadingMessage`, `role="status"`                        |
| 문서 §2.7 (`docs/*`, STATUS 완료 표기 등)                | **미충족**                    | `Issues/STATUS.md`만 소폭 변경, `docs/DECISIONS.md` 등 diff 없음           |
| `npm run test` 전부 통과                                 | **충족**                      | 로컬 실행 기준 168/168 통과                                                |

## Findings

### [HIGH] 계획 Step 4 TDD: 55분/60분 타이머에 대한 자동화 테스트 부재

- Location: `src/hooks/use-batch-transcription.ts`, `src/components/__tests__/recorder-batch.test.tsx`
- Description: 구현은 있으나 `vi.useFakeTimers()` 기반 시나리오가 없음.
- Suggestion: 훅 테스트에 소프트 리밋 1회·하드 리밋 시 전사 요청 1회 검증 추가.

### [MEDIUM] 이슈/계획 Step 5: 문서·트래킹 미완

- Location: `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/PRD.md`, `Issues/STATUS.md`
- Description: §2.7 문서 갱신 및 완료 표기 미반영.
- Suggestion: 문서 반영 및 STATUS 완료 처리.

### [MEDIUM] `POST /api/stt/transcribe` 비 JSON 업스트림 본문 테스트 공백

- Location: `src/app/api/stt/transcribe/__tests__/route.test.ts`
- Description: `res.json()` 실패 분기 테스트 선택적 공백.
- Suggestion: 비 JSON 200 응답에 대한 502 테스트 추가.

### [LOW] `startBlobRecording` opus 폴백 단위 테스트

- Location: `src/lib/__tests__/audio-blob-recording.test.ts`
- Description: `isTypeSupported` 스텁으로 폴백 분기 검증 없음.
- Suggestion: 선택적 추가.

## Test Coverage Assessment

| 영역           | 파일                               | 계획 대비                                                    |
| -------------- | ---------------------------------- | ------------------------------------------------------------ |
| Blob 녹음      | `audio-blob-recording.test.ts`     | 주요 케이스 충족; opus 폴백·MediaRecorder 시작 실패는 미포함 |
| Transcribe API | `route.test.ts`                    | 대부분 충족                                                  |
| 배치 훅        | `use-batch-transcription.test.tsx` | 기본 전이·오류; 타이머·재시작 오염 선택적 공백               |
| Recorder 배치  | `recorder-batch.test.tsx`          | 안내·로딩·저장 충족; 가짜 타이머 55/60분 없음                |

## Verdict

**PASS_WITH_NOTES** — 구현은 계획과 대체로 일치하나 타이머 테스트·문서 Step 5가 남아 있음.
