# Implementation & Test Review

## Summary

계획된 기능(토큰 API, `AssemblyAIRealtimeProvider`, `useTranscription`, `TranscriptView`, `Recorder` 통합)은 구현되어 있으며 Vitest 50개 테스트가 통과한다. 다만 계획서 Step 5에 명시된 **녹음 중지 시 `stop`/`disconnect` 호출 순서**를 검증하는 통합 테스트는 빠져 있어 TDD 체크리스트 대비 테스트가 불완전하다.

## Plan Compliance

| Plan Item                                                                      | Status | Notes                                                                                             |
| ------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------- |
| `POST /api/stt/token` — AssemblyAI 프록시, 키 없음/업스트림 실패 처리          | PASS   | `route.ts` + `route.test.ts`가 URL·`Authorization`·200/502/503·JSON 파싱 실패 분기를 다룸.        |
| `assemblyai.ts` — WS URL, Base64 `audio_data`, Partial/Final/terminate, 버퍼링 | PASS   | `assemblyai.test.ts`가 URL, `sendAudio`, 메시지 타입, `terminate_session`, `disconnect`를 검증.   |
| `useTranscription` — 토큰, connect, partial/final, `sendPcm`, 언마운트 정리    | PASS   | `fetchToken`/`createProvider` 주입으로 결정적 테스트.                                             |
| `TranscriptView` — partial 한 줄, finals 누적, 접근성                          | PASS   | `transcript-view.test.tsx`가 표시·`aria-live="polite"` 검증.                                      |
| `Recorder` + PCM → 전사, 시작 전 `prepareStreaming`                            | PASS   | `useRecorder(sendPcm)`, `start`/`stop` 플로우 구현됨.                                             |
| Step 5 RED: 중지 시 `stop`/`disconnect` 순서 테스트                            | FAIL   | `recorder-stt-integration.test.tsx`에 중지 버튼·`stopRecording` vs `finalizeStreaming` 순서 없음. |
| `@/lib/stt` export 보강                                                        | PASS   | `types.test.ts` 스모크 + `index.ts` re-export.                                                    |

## Findings

### [HIGH] Step 5 통합 테스트 — 중지 플로우 미검증

- Location: `src/components/__tests__/recorder-stt-integration.test.tsx`
- Description: `01_plan.md` Step 5는 녹음 중지 시 `stop`/`disconnect`(또는 동등한 `stopRecording` → `finalizeStreaming`) 호출 순서를 모의로 검증할 것을 요구한다. 현재 테스트는 시작·`sendPcm`만 다루고 중지 시나리오가 없다.
- Suggestion: 녹음 중 상태를 모의한 뒤 “중지” 클릭 시 `stopRecording`이 `finalizeStreaming`보다 먼저 호출되는지(또는 `callOrder`로 `["stopRecording", "finalizeStreaming"]`) 단언하는 케이스 추가.

### [MEDIUM] `SessionTerminated` 단독 수신 동작의 테스트 범위

- Location: `src/lib/stt/__tests__/assemblyai.test.ts`, `src/lib/stt/assemblyai.ts`
- Description: 계획은 `SessionTerminated`에 대한 “연결 정리 또는 완료 정책” 테스트를 나열한다. 구현은 `stop()` 흐름 안에서 `SessionTerminated`로 Promise 완료를 검증하지만, `stop()` 없이 서버만 세션을 종료하는 경우의 콜백/상태는 단위 테스트에서 직접 다루지 않는다.
- Suggestion: 필요 시 `openAndConnect` 후 `simulateMessage({ message_type: "SessionTerminated" })`만 호출해 `stopResolver`/타임아웃/소켓 상태가 기대와 맞는지 한 케이스 추가.

### [LOW] export 스모크 테스트의 검증 강도

- Location: `src/lib/stt/__tests__/types.test.ts`
- Description: `AssemblyAIRealtimeProvider`가 `function`인지만 확인해, `TranscriptionProvider` 메서드 시그니처와의 정합은 보장하지 않는다.
- Suggestion: 최소한 인스턴스에 대해 `connect`/`sendAudio` 존재 여부 확인 정도로 보강 가능.

### [LOW] 훅 테스트 — “리셋” 시나리오

- Location: `src/hooks/__tests__/use-transcription.test.tsx`, `01_plan.md` Step 3
- Description: 계획 문구는 “언마운트/리셋 시 `disconnect`”이다. 언마운트는 검증되나, 연속 `prepareStreaming` 실패 후 재시도 등 명시적 리셋 경로는 별도 케이스가 없다.
- Suggestion: 필수는 아니나, 두 번째 `prepareStreaming` 호출 전 이전 제공자가 끊기는지에 대한 회귀 테스트를 고려.

## Test Coverage Assessment

토큰 라우트·`AssemblyAIRealtimeProvider`·`useTranscription`·`TranscriptView`는 계획의 RED 항목 대부분을 충실히 반영하고, 모킹도 과하지 않다. `recorder-stt-integration.test.tsx`는 시작 순서(`prepareStreaming` → `startRecording`)와 PCM 전달만 검증해 **Step 5의 중지 순서 요구를 충족하지 못한다**. `npm test` 기준 13개 파일·50개 테스트 전부 통과.

## Verdict

PASS_WITH_NOTES
