---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "feature-12-stt-session-resilience"
---

# Feature 12: STT 세션 장시간 사용 시 안정성 개선 — 개발 계획서

## 개발 범위

- **OpenAI Realtime** (`src/lib/stt/openai-realtime.ts`, `src/hooks/use-transcription.ts`): 60분 세션 한도에 맞춰 **연결 시각 기준 55분 선제 감지** 후 정상 `stop()` 경로로 소켓을 닫고, 훅에서 **새 토큰 발급·재연결**을 수행한다. 서버 `error` 이벤트(예: `"Your session hit the maximum duration of 60 minutes."`) 수신 시에도 **복구 가능 에러**로 분류해 동일 오케스트레이션을 탄다. **`finals` React 상태는 유지**, `partial`만 재연결 구간에서 유실 가능. **최대 3회** 재연결 시도 후에는 영구 에러(수동 재시작 안내).
- **WebSocket 비정상 종료** (`openai-realtime.ts`, `src/lib/stt/assemblyai.ts`): `stop()`으로 유도한 종료(`stopResolver`가 있는 경우 등 **사용자/클라이언트 주도 종료**)가 아니면 `onError(new Error("SESSION_EXPIRED_OR_DISCONNECTED"))` 호출.
- **사용자 문구·표시 정책** (`src/lib/stt/user-facing-error.ts`, 필요 시 `recorder.tsx` / 훅 반환값): 이슈 표의 한국어 매핑 추가. **자동 재연결 진행 중**은 토스트(짧은 안내), **재연결 실패·한도 초과**는 기존처럼 **지속 에러**(`errorMessage`).
- **AssemblyAI** (`assemblyai.ts`): OpenAI와 동일한 `onclose` 패턴; 재연결은 **`TranscriptionProvider` 인터페이스 유지**한 채 훅 레벨에서만 처리.
- **Web Speech** (`src/lib/stt/web-speech.ts`): `recognition.start()` 실패(초기·`onend` 후 재시작 모두) 시 `onError` 보고, **연속 재시작 실패 3회** 시 재시작 중단. **`document.visibilitychange` / `visibilityState === "visible"`** 시 포그라운드 복귀 재시도 1회(이슈의 “포그라운드 복귀 시 시도”).
- **배치 전사** (`src/hooks/use-batch-transcription.ts`, UI는 `src/components/recorder.tsx`): 전사 실패 시 **Blob을 성공·사용자 폐기 전까지 ref로 유지**. **네트워크 실패·5xx**는 **2회 자동 재시도(2s, 4s 백오프)**, **4xx**는 재시도 없음. **수동 “다시 시도”** 액션 노출.
- **녹음 UI** (`recorder.tsx`): 실시간(OpenAI/AssemblyAI/Web Speech) 모드에서도 **경과 시간** 표시(이미 `useRecorder`의 `elapsedMs`가 있으므로 `displayElapsedMs` 분기 확장). **55분** 시점에 엔진별 안내: 자동 재연결 경로가 있으면 “세션이 곧 갱신됩니다”, Web Speech 등 없으면 “녹음 시간이 길어지고 있습니다…” 경고.
- **문서**: `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/TROUBLESHOOTING.md`에 세션 재연결·배치 재시도 정책 반영.

## 기술적 접근 방식

- **상수**: 선제 재연결 `55 * 60 * 1000` ms, 재연결 상한 `3`, 배치 자동 재시도 `2`회·백오프 `2000`/`4000` ms. OpenAI 프로바이더 테스트를 위해 **타이머 주입**(`vi.useFakeTimers()` 또는 생성자 옵션 `proactiveRenewalAfterMs` 등)을 검토해 **단위 테스트에서 55분을 실제로 기다리지 않는다**.
- **사용자 주도 종료 플래그**: `OpenAIRealtimeProvider` / `AssemblyAIRealtimeProvider`에 `userInitiatedClose` 또는 동등한 플래그를 두어 `disconnect()`, `stop()` 성공 경로에서는 `onclose`에서 `onError`를 호출하지 않는다.
- **선제 55분 처리 위치**: 이슈는 `openai-realtime.ts`에 타이머를 둔다. **토큰 재발급은 훅**(`fetchToken`)에만 있으므로, 프로바이더는 만료 임박 시 (1) 내부 `stop()`으로 정상 종료 플래그 설정 후 소켓 종료, (2) **`onError`에 복구용 고정 메시지**(예: `SESSION_PROACTIVE_RENEW`)를 한 번 보내 훅이 `fetchToken`→`createProvider`→`connect`를 수행하거나, (3) **`connect`에만 쓰는 선택 콜백**을 옵션으로 추가하는 방식 중 하나로 구현한다. **권장**: `TranscriptionProvider` 시그니처 변경을 피하려면 **복구용 `Error.message` 상수 + 훅 분기**로 통일.
- **`use-transcription.ts`**: 토큰 기반 경로의 `onError`에서 메시지를 **재연결 가능 / 불가**로 분류. 재연결 가능이면 `reconnectCountRef` 증가, 한도 내이면 `disconnectProvider()` 후 `fetchToken`·`createProvider`·`connect` 재호출, **`setFinals`는 유지**. 실패·한도 초과 시 기존처럼 `userFacingSttError` + 영구 `errorMessage`. **토스트**는 `recorder`에서 짧은 `useState` + `setTimeout` 또는 기존 토스트 유틸이 있으면 재사용(없으면 최소 구현).
- **Web Speech**: `onend` 내 `start()` 실패 시 `catch`에서 `onError` 및 실패 카운터 증가. `visibilitychange` 리스너는 `connect` 시 등록·`disconnect` 시 해제.
- **배치**: `stopBlobOnly()` 결과 Blob을 `recordingBlobRef` 등에 보관하고, 전사 성공 시에만 해제. 에러 시 `status === "error"`이지만 Blob 유지. `retryTranscription` 콜백과 `discardRecording`(또는 `startRecording` 시 초기화)로 생명주기 명시.

## TDD 구현 순서

### Step 1: 세션·재연결 관련 사용자 문구 매핑

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/stt/__tests__/user-facing-error-session.test.ts`
- 테스트 케이스 목록
  - `"Your session hit the maximum duration of 60 minutes."` → 이슈 표의 한국어 문구
  - `"SESSION_EXPIRED_OR_DISCONNECTED"` → 이슈 표의 한국어 문구
  - 재연결 실패용 내부 메시지(구현 시 확정한 상수, 예: `SESSION_RECONNECT_EXHAUSTED`) → “녹음을 다시 시작해 주세요” 계열 문구
  - (선택) `SESSION_PROACTIVE_RENEW` 등 선제 갱신 안내 문구가 토스트용으로 분리되는 경우 별도 함수 `userFacingSttReconnectToast` 단위 테스트

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/stt/user-facing-error.ts`
- 핵심 구현 내용: `userFacingSttError`의 `switch`에 위 케이스 추가. 토스트용 문구가 `default`와 겹치지 않게 **별도 export 함수**로 분리할지 이 단계에서 최소한으로 결정.

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: 세션 관련 문자열을 `as const` 상수 객체로 모아 오타 방지; Web Speech 접두어 패턴과 네이밍 일관성 유지.

### Step 2: AssemblyAI `onclose` 비정상 종료 시 `onError`

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/stt/__tests__/assemblyai-onclose.test.ts`
- 테스트 케이스 목록
  - `stop()` 호출로 인한 정상 종료 시 `onclose`에서 **`onError` 미호출**
  - 서버/네트워크로 소켓만 닫힌 경우(`stopResolver` 없음) **`onError` 1회**, 메시지 `SESSION_EXPIRED_OR_DISCONNECTED`
  - `disconnect()` 호출 시 **중복 `onError` 없음**

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/stt/assemblyai.ts`
- 핵심 구현 내용: `stop()`/`disconnect()` 진입 시 플래그 설정; `ws.onclose`에서 플래그·`stopResolver` 조합으로 분기.

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: OpenAI와 동일한 “정상 종료 vs 비정상 종료” 판별 로직을 주석으로 대응 관계 명시(공통 유틸 추출은 중복이 커질 때만).

### Step 3: OpenAI Realtime `onclose` + 선제 재연결 타이머

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/stt/__tests__/openai-realtime-reconnect.test.ts`
- 테스트 케이스 목록
  - **가짜 시간**: (주입된) 짧은 `proactiveRenewalAfterMs` 만료 시 `stop()` 유사 경로 후 **새 연결 시도를 유발할 신호**(메시지 이벤트 또는 두 번째 `MockWebSocket` 인스턴스) 검증
  - 서버 `error` 이벤트에 60분 문구 포함 시 `onError`에 해당 메시지 전달(기존 동작 유지 + 재연결은 훅에서 처리하므로 프로바이더는 메시지 보존)
  - 비정상 `onclose` 시 `SESSION_EXPIRED_OR_DISCONNECTED`
  - 정상 `stop()` 완료 후 `onclose`에서는 세션 에러 미보고
  - 재연결/타이머 정리: `disconnect()` 시 타이머 취소

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/stt/openai-realtime.ts`
- 핵심 구현 내용: `userInitiatedClose` 플래그, `onclose` 분기, `setTimeout` 기반 선제 갱신(테스트용 ms 옵션), `OpenAIRealtimeProviderOptions` 확장.

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: 타이머·플래그 필드를 한 블록으로 모으고, `disconnect()`에서 idempotent 정리.

### Step 4: Web Speech 재시작 실패·포그라운드 재시도

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/stt/__tests__/web-speech-restart-failure.test.ts`
- 테스트 케이스 목록
  - `recognition.start()`가 던지면 `onError` 호출(초기 connect 경로는 기존 `web-speech.test.ts`와 중복 최소화)
  - `onend` 후 `start()` 연속 실패 3회 시 **더 이상 `start` 호출 안 함**
  - `visibilitychange`로 visible 시 **카운터/상태가 허용하면 재시도**(모의 `document` 이벤트, `happy-dom` 또는 jsdom 환경 주석)

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/stt/web-speech.ts`
- 핵심 구현 내용: 실패 카운터, `onend`의 `catch`에서 `onError`, `visibilitychange` 리스너 등록.

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: 리스너 제거를 `disconnect`에서 보장해 누수 방지.

### Step 5: `use-transcription` 재연결 오케스트레이션

**RED** — 실패하는 테스트 작성

- 테스트 파일: 기존 `src/hooks/__tests__/use-transcription.test.tsx`에 케이스 추가 또는 `src/hooks/__tests__/use-transcription-reconnect.test.tsx` 분리
- 테스트 케이스 목록
  - `createProvider`가 연속으로 다른 mock을 반환할 때, **복구 가능 `onError`** 후 `fetchToken`·`createProvider`·`connect` 재호출
  - **`finals` 배열 유지**, `partial`은 재연결 로직에 맞게 초기화 가능
  - 재연결 **3회 초과** 시 영구 `errorMessage` 및 `disconnect`
  - **비복구** 메시지(예: 토큰/설정 오류)는 기존처럼 즉시 종료
  - `tokenlessProvider`(Web Speech) 경로는 이 스텝에서 **기존 동작 유지** 또는 Web Speech 전용 카운터와 충돌 없음을 검증

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/hooks/use-transcription.ts`
- 핵심 구현 내용: `reconnectAttemptsRef`, `classifySttReconnectError(message)`, 재연결 루프 내 `prepareStreaming` 재사용 또는 내부 헬퍼, 토스트용 상태/콜백은 필요 시 `return` 확장.

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: `prepareStreaming` 의존 배열·중복 `disconnect` 호출 제거; PCM pending 프레이밍 ref는 재연결 시 이슈 요구에 맞게 초기화.

### Step 6: 배치 전사 Blob 유지·자동/수동 재시도

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/hooks/__tests__/use-batch-transcription-retry.test.ts`
- 테스트 케이스 목록
  - `fetch` mock: **503** 응답 시 **최대 2회 재시도**, 지연 2s·4s(`vi.useFakeTimers` + `advanceTime`)
  - **400대** 응답 시 **재시도 없이** 즉시 에러
  - `fetch` throw(네트워크) 시 동일 백오프 재시도
  - 에러 후에도 내부 Blob ref가 유지되고, **수동 retry**로 동일 Blob 재전송
  - 성공 시 Blob 해제

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/hooks/use-batch-transcription.ts`
- 핵심 구현 내용: Blob ref, `transcribeWithRetry` 내부 함수, `retryTranscription` export, `stopAndTranscribe`에서 Blob을 null로 만들지 않는 분기 수정.

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: 재시도 정책 상수화; `transcribeInFlightRef`와 retry의 경합 방지.

### Step 7: Recorder 경과 시간·55분 안내·배치 재시도 버튼

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-stt-integration.test.tsx` 확장 또는 `src/components/__tests__/recorder-session-resilience.test.tsx` 신설
- 테스트 케이스 목록
  - 실시간 모드에서 `formatElapsed`가 **batch가 아닐 때도** 노출
  - OpenAI/AssemblyAI 설정 시 55분 경과 mock 시 “세션이 곧 갱신됩니다”(또는 훅에서 넘기는 문구)
  - Web Speech 모드에서는 경고 문구 분기
  - 배치 에러 시 “다시 시도” 버튼이 `retry`를 호출

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder.tsx`, (필요 시) `src/hooks/use-transcription.ts` 반환 필드 확장
- 핵심 구현 내용: `streamingSoftLimitMessage` 등 훅/로컬 타이머, `useBatchTranscription`의 `retryTranscription` 연결.

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: `displayElapsedMs`·메시지 블록 조건을 한눈에 읽히게 정리; 접근성 `role="status"` 유지.

## 파일 변경 계획

| 경로                                                              | 변경 요약                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------ |
| `src/lib/stt/user-facing-error.ts`                                | 세션·재연결·토스트 문구 매핑                           |
| `src/lib/stt/openai-realtime.ts`                                  | 선제 타이머, `onclose` 처리, 테스트용 옵션             |
| `src/lib/stt/assemblyai.ts`                                       | `onclose` 비정상 종료 시 `onError`                     |
| `src/lib/stt/web-speech.ts`                                       | `start()` 실패 보고, 연속 실패 한도, visibility 재시도 |
| `src/hooks/use-transcription.ts`                                  | 재연결 오케스트레이션, 토스트/일시 안내 상태           |
| `src/hooks/use-batch-transcription.ts`                            | Blob 유지, 백오프 재시도, 수동 retry API               |
| `src/components/recorder.tsx`                                     | 실시간 경과 시간·55분 문구·배치 재시도 UI              |
| `src/lib/stt/__tests__/user-facing-error-session.test.ts`         | 신규                                                   |
| `src/lib/stt/__tests__/assemblyai-onclose.test.ts`                | 신규                                                   |
| `src/lib/stt/__tests__/openai-realtime-reconnect.test.ts`         | 신규                                                   |
| `src/lib/stt/__tests__/web-speech-restart-failure.test.ts`        | 신규                                                   |
| `src/hooks/__tests__/use-batch-transcription-retry.test.ts`       | 신규                                                   |
| `src/hooks/__tests__/use-transcription.test.tsx` (또는 분리 파일) | 재연결 케이스                                          |
| `src/components/__tests__/recorder-*.test.tsx`                    | UI·통합 케이스                                         |
| `docs/DECISIONS.md`                                               | 55분 선제 재연결, 3회 한도, 배치 재시도 정책           |
| `docs/ARCHITECTURE.md`                                            | STT 복원력 레이어(프로바이더 vs 훅 책임)               |
| `docs/TROUBLESHOOTING.md`                                         | 세션 만료·재연결 실패 증상                             |

## 완료 조건

- 이슈 `00_issue.md` **완료 조건** 체크리스트 전항 충족.
- 위 **신규·확장 테스트** 포함 관련 Vitest 스위트 전부 통과(`pnpm test` 또는 프로젝트 표준 명령).
- 실시간(OpenAI·AssemblyAI·Web Speech)·배치 기존 사용자 플로우 회귀: 녹음 시작→전사→중지·저장이 깨지지 않음.
- 문서 3종(DECISIONS / ARCHITECTURE / TROUBLESHOOTING)에 정책·증상이 반영됨.

## 테스트 전략

- **러너**: Vitest(`vitest.config.ts`, `@` → `src` alias). **DOM 필요 훅/UI**: `/** @vitest-environment happy-dom */` 기존 패턴 준수.
- **WebSocket**: `openai-realtime.test.ts`의 `MockWebSocket` 패턴을 `openai-realtime-reconnect.test.ts`·`assemblyai-onclose.test.ts`에서 재사용·복제.
- **시간**: `vi.useFakeTimers()`로 55분·2s·4s 백오프 검증; 타이머 누수 없이 `afterEach` 정리.
- **훅**: `renderHook` + `act` + `waitFor`로 비동기 재연결·재시도 종료 대기.
- **분류**: 재연결 가능 여부는 **단위 테스트에서 `Error.message` 상수**와 훅 분기 테이블로 고정해 회귀 방지.
- **E2E**: 이 플랜 범위 밖이면 생략 가능; 수동 스모크는 이슈 완료 조건의 “기존 전사 기능 정상”으로 충족.
