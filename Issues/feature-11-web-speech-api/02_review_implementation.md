---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "feature-11-web-speech-api"
  review_kind: implementation
---

# Implementation & Test Review

## Summary

Feature 11(Web Speech API)는 계획서의 핵심 범위—`WebSpeechProvider`·`isWebSpeechApiSupported`·`createWebSpeechProvider`, 사용자 메시지·`no-speech` 3초 디바운스, `useTranscription`의 `tokenlessProvider` 분기, Recorder·설정 패널 통합, 단위/훅/컴포넌트 테스트 및 문서 갱신—를 대체로 충실히 반영했습니다. `TranscriptionProvider` 계약과 이슈의 완료 조건과 잘 맞습니다. 계획 Step 2에서 명시한 **`onresult`의 `resultIndex`~`length` 루프 검증 테스트**는 단일 결과 위주로만 커버되어, 테스트 관점에서만 소폭 미달이 있습니다.

## Plan Compliance

| Plan item                                                                                                     | Status  | Notes                                                                                                     |
| ------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `web-speech.ts`: `WebSpeechProvider`, `isWebSpeechApiSupported`, `createWebSpeechProvider`, `sendAudio` no-op | Met     | `continuous`/`interimResults`/`lang` 설정 및 팩토리 주입 구현됨                                           |
| `continuous` + `interim`, `onPartial`/`onFinal`                                                               | Met     | `onresult`에서 `isFinal` 분기                                                                             |
| `onend` 재시작, `stop`/`disconnect` 시 중단                                                                   | Met     | `active`/`closed`로 제어                                                                                  |
| 언어 BCP-47 (`ko`→`ko-KR`, `en`→`en-US`)                                                                      | Met     | `mapSettingsLanguageToWebSpeechLang`; `auto` 등은 `ko-KR`                                                 |
| `user-facing-error.ts`: Web Speech 코드 매핑 + `no-speech` 3s 디바운스, `aborted` 무시                        | Met     | 디바운서는 순수 함수 + Provider에서 `performance.now()` 사용                                              |
| `use-transcription.ts`: `tokenlessProvider` 시 토큰 경로 스킵                                                 | Met     | `prepareStreaming` 분기; Web Speech 에러는 `parseWebSpeechProviderError` → `userFacingWebSpeechErrorCode` |
| `recorder.tsx`: `webSpeechApi` 시 `tokenlessProvider`, 미지원 안내                                            | Met     | `prepareStreaming` 후 `startRecording`; 미지원 시 메시지·조기 반환                                        |
| `settings-panel.tsx`: 미지원 시 라디오 비활성 + 힌트 + `data-testid`                                          | Met     | `useEffect`로 `isWebSpeechApiSupported` 반영, `aria-disabled`                                             |
| `index.ts` export                                                                                             | Met     | `createWebSpeechProvider`, `isWebSpeechApiSupported` re-export                                            |
| Tests                                                                                                         | Partial | `resultIndex` 루프 전용 케이스 없음                                                                       |
| Docs: DECISIONS / ARCHITECTURE / PRD, STATUS                                                                  | Met     |                                                                                                           |

## Findings

### [HIGH] `onresult`의 `resultIndex`~`length` 루프 테스트 부재

- Location: `src/lib/stt/__tests__/web-speech.test.ts`
- Description: 구현은 루프가 올바르나, `resultIndex` 오프셋·복수 결과 시나리오 테스트가 없음.
- Suggestion: `resultIndex === 1` 등으로 `onPartial`/`onFinal` 호출을 검증하는 케이스 추가.

### [MEDIUM] `formatWebSpeechProviderError` / `parseWebSpeechProviderError` 단위 테스트

- Suggestion: 접두사·슬라이스 경계 1~2건 추가 가능.

### [LOW] `recognitionFactory` 동기 throw 전용 테스트

- Suggestion: 회귀 방지용 한 건.

## Test Coverage Assessment

Web Speech Provider·사용자 메시지·디바운서·`useTranscription`·Settings/Recorder 통합 테스트는 양호. `resultIndex` 루프 직접 검증 보강 권장.

## Verdict

**PASS_WITH_NOTES**
