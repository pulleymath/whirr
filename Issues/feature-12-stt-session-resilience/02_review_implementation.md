---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "feature-12-stt-session-resilience"
  review_kind: implementation
---

# Implementation & Test Review

## Summary

`feature-12-stt-session-resilience` 브랜치는 플랜의 핵심 동작(선제 갱신·재연결 분기·프로바이더 `onclose`·배치 재시도·UI 안내·문서 반영)을 대체로 충실히 구현했고, 변경된 Vitest 스위트는 전부 통과했다. 다만 플랜 Step 7에서 예정한 Recorder 단위/통합 테스트가 diff에 없고, Web Speech 포그라운드 재시도가 플랜 문구(“1회”)와 완전히 일치하지 않으며, 배치 쪽 네트워크 예외 재시도는 테스트로 고정되지 않았다.

## Plan Compliance

| Plan 항목                                                          | Status  | Notes                                                                                                                                              |
| ------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI Realtime 55분 선제 갱신 + `SESSION_PROACTIVE_RENEW`         | PASS    | `openai-realtime.ts`의 `proactiveRenewalAfterMs`(기본 55분)·`stop()` 후 `onclose`에서 신호 전달, 단위 테스트로 단축 타이머 검증                    |
| 서버 60분 한도 `error` 메시지 보존·훅 재연결                       | PASS    | `handleIncomingMessage`에서 메시지 그대로 `onError`; `isSttReconnectRecoverableMessage`에 포함                                                     |
| 비정상 `onclose` → `SESSION_EXPIRED_OR_DISCONNECTED`               | PASS    | OpenAI·AssemblyAI 모두 구현 및 전용 테스트                                                                                                         |
| 사용자 주도 종료 시 `onclose`에서 세션 에러 미보고                 | PASS    | `userInitiatedClose` / `suppressCloseError`·`stop()`·`disconnect()` 경로 테스트                                                                    |
| AssemblyAI `onclose` 패턴                                          | PASS    | `assemblyai.ts` + `assemblyai-onclose.test.ts`                                                                                                     |
| Web Speech `start()` 실패·연속 실패 3회 중단                       | PASS    | `web-speech.ts` + `web-speech-restart-failure.test.ts`                                                                                             |
| Web Speech 포그라운드 복귀 재시도                                  | PARTIAL | `visibilitychange` 처리는 있으나 플랜의 “재시도 1회” 제한은 코드에 명시되지 않음(visible일 때마다 조건 맞으면 시도)                                |
| `use-transcription` 재연결·`finals` 유지·3회 한도·비복구 즉시 종료 | PASS    | `reconnectToast`, `MAX_STT_RECONNECTS`, `prepareStreaming` 시 카운터 리셋; 훅 테스트로 재연결·보존·한도 검증                                       |
| 배치 Blob 유지·503/네트워크 재시도·4xx 비재시도·수동 retry         | PASS    | `lastRecordingBlobRef`, `BATCH_TRANSCRIBE_MAX_ATTEMPTS` 3(1+2회 재시도), `shouldRetryBatchTranscribeStatus`; 다만 `fetch` throw 전용 테스트는 없음 |
| Recorder 경과 시간·55분 안내·재연결 토스트·배치 “다시 시도”        | PASS    | `displayElapsedMs`, `streamingSessionHint`, `reconnectToast`, 배치 에러 시 버튼                                                                    |
| 문서(DECISIONS / ARCHITECTURE / TROUBLESHOOTING)                   | PASS    | diff에 반영됨                                                                                                                                      |
| Step 7 Recorder 테스트(플랜 명시)                                  | FAIL    | `recorder-*.test.tsx` 변경 없음; 플랜의 RED 케이스(실시간 경과·55분 문구·Web Speech 분기·배치 retry UI) 미추가                                     |

## Findings

### [HIGH] 플랜 Step 7 Recorder 테스트 미구현

- Location: `src/components/__tests__/` (해당 diff 없음), `src/components/recorder.tsx` (구현만 존재)
- Description: `01_plan.md`는 `recorder-stt-integration.test.tsx` 확장 또는 `recorder-session-resilience.test.tsx` 신설을 TDD 순서에 포함하지만, `git diff main --name-only`에 Recorder 테스트 파일이 없다. UI 분기(`streamingSessionHint`, `reconnectToast`, 배치 “다시 시도”)는 수동 회귀 없이 회귀에 취약해질 수 있다.
- Suggestion: `render` + settings mock으로 실시간 녹음 중 `elapsedMs` 주입 또는 타이머로 55분 이상 경과를 시뮬레이션하고, OpenAI/AssemblyAI(`realtime` + 엔진)·Web Speech·배치 에러+retry 클릭 시 `retryBatchTranscription` 호출을 검증하는 테스트를 추가한다.

### [MEDIUM] Web Speech 포그라운드 재시도가 플랜의 “1회”와 불일치할 수 있음

- Location: `src/lib/stt/web-speech.ts` (대략 `visibilitychange` 핸들러)
- Description: 플랜은 visible 시 “재시도 1회”를 명시했으나, 구현은 `visibilityState === "visible"`일 때마다 `tryStartRecognition`을 호출할 수 있어, 반복 전환 시 의도보다 많은 `start()` 시도나 실패 카운터 누적 가능성이 있다.
- Suggestion: `visibilityRetryUsed` 같은 플래그로 최초 1회만 재시도하거나, 플랜/이슈 문구를 실제 제품 의도(여러 번 복구 허용)에 맞게 정정한다.

### [MEDIUM] 배치 전사 `fetch` throw(네트워크) 재시도가 테스트로 고정되지 않음

- Location: `src/hooks/__tests__/use-batch-transcription.test.tsx`
- Description: 플랜 Step 6는 `fetch` throw에 대한 백오프 재시도를 명시했고, 구현은 `status === 0`으로 재시도 분기하지만, Vitest에는 503 위주이며 연속 reject 시나리오가 없다.
- Suggestion: `globalThis.fetch = vi.fn().mockRejectedValueOnce(...)` 패턴으로 2회 지연 후 성공/최종 실패 케이스를 추가한다.

### [LOW] `isSttReconnectRecoverableMessage` 직접 단위 테스트 부재

- Location: `src/lib/stt/user-facing-error.ts`
- Description: 재연결 분기의 단일 진실은 이 함수인데, 훅 테스트로는 일부 메시지만 간접 검증된다. 회귀 시 분류 누락을 잡기 어렵다.
- Suggestion: `user-facing-error-session.test.ts` 또는 소형 전용 파일에서 허용/비허용 메시지 표를 테스트한다.

### [LOW] 재연결 토스트(`reconnectToast`) 상태에 대한 훅 테스트 없음

- Location: `src/hooks/use-transcription.ts`, `src/hooks/__tests__/use-transcription.test.tsx`
- Description: 플랜은 자동 재연결 중 토스트를 요구하고 Recorder에서 렌더하지만, `reconnectToast` 문자열이 재연결 시 설정되는지 `renderHook`으로 단언하지 않는다.
- Suggestion: 복구 가능 `onError` 한 번 후 `reconnectToast`가 기대 문구로 잠깐 설정되는지 `waitFor`로 검증한다.

## Test Coverage Assessment

- **플랜 TDD Step 1–6**: 대응 테스트 파일이 플랜과 거의 일치하며(`use-batch-transcription-retry.test.ts` 대신 기존 `use-batch-transcription.test.tsx`에 케이스 통합), RED 단계에서 기대한 행위(문구 매핑, AssemblyAI/OpenAI `onclose`, 선제 갱신, Web Speech 재시작, 훅 재연결·한도, 배치 재시도·retry)를 실제로 검증한다. tautology 위험은 낮다.
- **Step 7**: Recorder UI·통합 테스트가 빠져 플랜 대비 가장 큰 공백이다.
- **실행 결과**: `pnpm test --run` 기준 45개 파일·228개 테스트 전부 통과.

## Verdict

**PASS_WITH_NOTES** — 기능·훅·STT 프로바이더·배치·문서는 플랜과 대체로 정합하고 테스트도 대부분 행위를 뒷받침한다. 다만 플랜에 명시된 Recorder 테스트와 일부 엣지(네트워크 throw, Web Speech visible 재시도 정책 정합)를 보강하면 완료 조건에 더 안전하게 맞는다.
