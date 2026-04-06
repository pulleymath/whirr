# Implementation & Test Review

## Summary

계획서의 핵심 범위(워클릿 `public/` 단일 파일, `audio.ts`/`useRecorder`/`Recorder`/페이지 통합, 16kHz mono PCM·Analyser 레벨·에러 매핑·구조·계약·모킹 테스트)는 대체로 충족합니다. 다만 `startPcmRecording`의 `getUserMedia` 거부 경로 테스트, 훅의 `onPcmChunk` 전달 검증, 이미 녹음 중일 때 `start` 재호출에 대한 방어가 비어 있어 완료 조건·TDD 항목을 **테스트·엣지 케이스** 관점에서 완전하다고 보기는 어렵습니다.

## Plan Compliance

| Plan Item                                          | Status  | Notes                                                                |
| -------------------------------------------------- | ------- | -------------------------------------------------------------------- |
| `getUserMedia` + 권한/에러 사용자 메시지           | PASS    | `mapMediaErrorToMessage` + `Recorder` `role="alert"`                 |
| 워클릿 `public/audio-processor.js` 단일 파일       | PASS    | 번들 분리, `addModule("/audio-processor.js")`                        |
| PCM 16-bit, 16kHz, mono 청크 전달                  | PASS    | 워클릿에서 다운믹스·리샘플·`Int16Array`·`postMessage`                |
| `src/lib/audio.ts` 캡슐화·정리                     | PASS    | `stop`에서 포트/노드/트랙/`close`; `addModule` 실패 시 정리          |
| `use-recorder` 타이머·상태·PCM 콜백                | PARTIAL | 훅은 `onPcmChunk` 지원하나 `Recorder`는 미연결; 이중 `start` 무방어  |
| UI: 버튼·경과 시간·레벨 시각화                     | PASS    | `formatElapsed` + meter 스타일 레벨 바                               |
| `page.tsx`에 `Recorder` 배치                       | PASS    |                                                                      |
| Step 1 structure 테스트                            | PASS    | 네 경로 assert                                                       |
| Step 2 워클릿 계약 테스트                          | PASS    | 식별자·16000·mono/Int16 등                                           |
| Step 3 `audio.test.ts` (getUserMedia 성공/실패 등) | PARTIAL | `addModule` 실패·`mapMedia`는 있음; **`getUserMedia` reject 미검증** |
| Step 4 `use-recorder.test` + fake timers           | PARTIAL | 상태·타이머·stop·에러는 있음; **`onPcmChunk` 전달·레벨 RAF 미검증**  |
| 완료 조건: 타이머 시작/중지                        | PASS    | `setInterval` + `stop` 시 `clearTimers`                              |
| 완료 조건: 레벨 시각화                             | PASS    | Analyser + RMS 유사값                                                |
| 완료 조건: 중지 시 완전 중단                       | PASS    | 타이머/RAF 정리 + `session.stop`                                     |

## Findings

### [MEDIUM] 녹음 중 `start` 재호출 시 이전 세션 누수 가능

- **Location:** `src/hooks/use-recorder.ts` (`start` 콜백)
- **Description:** `sessionRef`가 덮어씌워지기 전에 이전 `AudioContext`/스트림을 `stop`하지 않을 수 있음.
- **Suggestion:** `start` 초입에 `if (sessionRef.current) return` 또는 진행 중이면 먼저 `await stop()` 후 재시작.

### [MEDIUM] 계획 Step 3의 `getUserMedia` 실패 모킹이 `startPcmRecording`에 없음

- **Location:** `src/lib/audio.test.ts`
- **Suggestion:** `getUserMedia.mockRejectedValueOnce(...)` 케이스 추가.

### [LOW] `onPcmChunk` 연결에 대한 훅 테스트 부재

- **Location:** `src/hooks/use-recorder.test.ts`

### [LOW] 페이지·`Recorder`에서 PCM 소비자 미노출

- **Location:** `src/components/recorder.tsx`

## Test Coverage Assessment

구조·계약·모킹 테스트는 양호. `getUserMedia` reject, `onPcmChunk`, 연속 `start` 엣지에 갭이 있음.

## Verdict

**PASS_WITH_NOTES**
