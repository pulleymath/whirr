---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "feature-11-web-speech-api"
---

# Feature 11: Web Speech API — 개발 계획서

## 개발 범위

- **신규**: `src/lib/stt/web-speech.ts` — `WebSpeechProvider`(`TranscriptionProvider` 구현), `isWebSpeechApiSupported()`, `createWebSpeechProvider(language?)`, `sendAudio` no-op, `continuous` + `interimResults`, `onend` 자동 재시작(사용자 `stop`/`disconnect` 전까지), `recognition.lang`은 설정 기반 BCP-47(예: `ko` → `ko-KR`, `en` → `en-US`).
- **확장**: `src/lib/stt/index.ts` — 위 심볼 export 및 `createWebSpeechProvider` 공개.
- **확장**: `src/lib/stt/user-facing-error.ts` — Web Speech `error` 코드 → 한국어 문구 매핑; `no-speech`는 **3초 디바운스**로 UI 스팸 방지(`aborted`는 `onError`로 올리지 않거나 무시).
- **확장**: `src/hooks/use-transcription.ts` — 토큰 없이 Provider만 붙이는 경로(아래 기술 접근). 기존 realtime/batch 동작 회귀 없음.
- **확장**: `src/components/recorder.tsx` — `mode === "webSpeechApi"`일 때 스텁 제거: 지원 브라우저면 `prepareStreaming` → `useRecorder(sendPcm)`(PCM은 no-op) → `stop` 시 `finalizeStreaming` + 세션 텍스트 저장 흐름은 realtime과 동일; 미지원이면 인라인 안내.
- **확장**: `src/components/settings-panel.tsx` — 미지원 시 `webSpeechApi` 라디오 `disabled` + 짧은 안내 문구(`data-testid`로 검증 가능하게).
- **테스트**: `src/lib/stt/__tests__/web-speech.test.ts`, `src/components/__tests__/settings-panel-web-speech.test.tsx`, `src/hooks/__tests__/use-transcription.test.tsx` 보강, 필요 시 `src/components/__tests__/recorder-settings.test.tsx`에 webSpeech 시나리오 추가.
- **문서**(이슈 명시): `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/PRD.md`, `Issues/STATUS.md`.

**범위 밖**: Web Speech 전용 별도 마이크 레벨 파이프라인(방안 B), `auto` 언어(설정 UI상 batch 전용이므로 Web Speech 경로에서는 `ko`/`en`만 명시 매핑).

## 기술적 접근 방식

- **인터페이스 정합**: 기존 `TranscriptionProvider`(`src/lib/stt/types.ts`)를 그대로 구현해 `useTranscription`의 `partial`/`finals`/`errorMessage` 갱신 패턴을 재사용한다.
- **토큰 없는 연결**: `useTranscription`의 `prepareStreaming`은 현재 `fetchToken` → `createProvider(token)` 고정이다. **옵션 추가** 예: `tokenlessProvider?: () => TranscriptionProvider`가 있으면 `fetchToken`/`createProvider`를 건너뛰고 해당 팩토리로만 연결한다. `Recorder`는 `settings.mode === "webSpeechApi"`일 때 `tokenlessProvider: () => createWebSpeechProvider(mapLanguageToBcp47(settings.language))`를 넘긴다.
- **Recorder 플로우(방안 A)**: `useRecorder`는 그대로 두고 `sendPcm`은 Provider에서 무시한다. 타이머·레벨 미터는 기존 `startPcmRecording` 경로 유지; Web Speech는 브라우저 내장 마이크 캡처를 병행(이슈에서 권장).
- **테스트 가능성**: `OpenAIRealtimeProvider`가 생성자에 `WebSocket` 구현체를 주입하듯, `WebSpeechProvider`는 `SpeechRecognition` 생성자(또는 팩토리)를 **선택 인자**로 받아 `src/lib/stt/__tests__/openai-realtime.test.ts`의 `MockWebSocket` 패턴과 맞춘다.
- **에러 파이프라인**: Provider는 `SpeechRecognitionErrorEvent.error`를 안정적인 `Error.message` 키(예: `WEB_SPEECH_NOT_ALLOWED`)로 올리고, 훅에서는 기존처럼 `userFacingSttError`를 쓰되 해당 키를 `user-facing-error.ts`의 `switch`에 추가하거나, `userFacingWebSpeechError(code)`를 두고 훅에서 Web Speech 전용으로 호출한다(한 파일에 모이도록 `user-facing-error.ts` 확장 권장).
- **설정 UI**: `isWebSpeechApiSupported()`는 **클라이언트에서만** 의미 있으므로 `settings-panel.tsx`에서 `useEffect`/`useState` 또는 `useSyncExternalStore`로 hydration 후 라디오 `disabled`를 갱신하는 패턴을 쓰면 SSR/하이드레이션 경고를 피하기 쉽다.

## TDD 구현 순서

### Step 1: Web Speech 사용자 메시지·디바운스 규칙

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/stt/__tests__/user-facing-web-speech.test.ts`(신규, 또는 기존 `user-facing` 단일 테스트 파일이 있으면 그쪽; 현재는 전용 파일이 없으므로 신규 권장)
- 테스트 케이스 목록
  - `not-allowed` / `no-speech` / `audio-capture` / `network` / 기타 / `aborted` 처리方針(무시 시 별도 export가 아닌 Provider 동작으로 검증해도 됨)
  - `no-speech` 디바운스 헬퍼: 3초 이내 반복 시 한 번만 `true`(또는 콜백 1회)인지

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/stt/user-facing-error.ts`(및 필요 시 `src/lib/stt/web-speech-debounce.ts` 등 동일 디렉터리 소규모 모듈)
- 핵심 구현 내용: 이슈 표의 한국어 문구 매핑, 3초 윈도우 디바운스(타임스탬프 `Date.now()` 또는 `performance.now()`)

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: 매핑 테이블을 객체 리터럴 + fallback으로 정리해 `switch` 중복 감소; 디바운스는 Provider 내부가 아닌 순수 함수로 두어 단독 테스트 유지

### Step 2: `WebSpeechProvider` + `isWebSpeechApiSupported`

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/stt/__tests__/web-speech.test.ts`
- 테스트 케이스 목록
  - `connect` 후 모의 `start()` 호출
  - `onresult` interim → `onPartial`, final → `onFinal`(루프 `resultIndex`~`length` 반영)
  - `onerror` → `onError` + `aborted` 미통지(또는 정책에 맞게)
  - `onend` + `stopped === false` → `start` 재호출; `stop()` 이후에는 재시작 없음
  - `sendAudio` 호출 시 부작용 없음
  - `disconnect` 시 재시작 중단·리소스 정리
  - `isWebSpeechApiSupported`: `globalThis`에 `SpeechRecognition` / `webkitSpeechRecognition` 유무 시나리오

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/stt/web-speech.ts`
- 핵심 구현 내용: 이슈 2.1~2.2 의사코드 준수, 생성자 주입으로 모의 인식기 사용

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: 언어 문자열 정규화 `mapSettingsLanguageToWebSpeechLang`를 같은 파일 또는 `src/lib/stt/web-speech-lang.ts`로 분리

### Step 3: STT 진입점 export

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/stt/__tests__/web-speech.test.ts`에 `import { createWebSpeechProvider, isWebSpeechApiSupported } from "@/lib/stt"` 공개 export 검증 1건 추가(또는 별도 얕은 통합 테스트)

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/stt/index.ts`
- 핵심 구현 내용: `web-speech` re-export, `createWebSpeechProvider(language?)`

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: export 순서·이름을 기존 `createOpenAiRealtimeProvider`와 나란히 정리

### Step 4: `useTranscription` 토큰 없는 준비 경로

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/hooks/__tests__/use-transcription.test.tsx`
- 테스트 케이스 목록
  - `tokenlessProvider`(가칭)가 주어지면 `fetchToken`·`createProvider` **미호출**로 `prepareStreaming === true`
  - 토큰 경로 기존 테스트 3건 이상 회귀 통과
  - `finalizeStreaming`이 tokenless Provider에도 `stop`→`disconnect` 호출

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/hooks/use-transcription.ts`
- 핵심 구현 내용: `prepareStreaming` 분기; `sendPcm`/`finalizeStreaming`은 기존과 동일하게 `providerRef` 사용(Web Speech는 `sendAudio` no-op)

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: 옵션 타입을 JSDoc으로 “realtime AssemblyAI/OpenAI vs webSpeech” 용도 구분

### Step 5: 설정 패널 — 미지원 시 비활성화

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/settings-panel-web-speech.test.tsx`
- 테스트 케이스 목록
  - `isWebSpeechApiSupported === false` 모킹 시 `mode-webSpeechApi` 비활성화 + 안내 문구 존재
  - 지원 true 시 기존과 같이 선택 가능
  - (선택) 이미 저장된 `webSpeechApi` + 미지원: 패널에 경고 또는 `Recorder`와 중복 안내만 할지 정책에 맞춰 한 곳에 집중

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/settings-panel.tsx`(필요 시 `src/lib/stt/web-speech.ts`의 `isWebSpeechApiSupported` import)
- 핵심 구현 내용: 클라이언트에서 지원 여부 상태 반영, 라디오 `disabled` + `aria-disabled`

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: `MODE_OPTIONS`와 지원 여부를 합쳐 렌더만 분기하는 작은 헬퍼

### Step 6: `Recorder` Web Speech 통합

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-settings.test.tsx`(확장) 또는 `recorder-web-speech.test.tsx`(신규)
- 테스트 케이스 목록
  - `mode: webSpeechApi` + 지원: `prepareStreaming` 호출, 스텁 문구 “아직 지원되지 않는 모드” **미표시**
  - `mode: webSpeechApi` + 미지원: 녹음 시작 시 안내(기존 스텁과 동일 UX 또는 설정과 통일된 문구)
  - realtime/batch 기존 케이스 회귀

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder.tsx`
- 핵심 구현 내용: `transcriptionOptions`를 `settings.mode`에 따라 분기; webSpeech일 때 `tokenlessProvider` + `createWebSpeechProvider`; `start`/`stop`에서 batch/realtime과 동일한 저장·요약 타이밍 유지

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: `useMemo` 의존성 배열에 `settings.language` 포함; 중복 `setUnsupportedModeMessage` 조건 단순화

## 파일 변경 계획

| 경로                                                          | 변경                                         |
| ------------------------------------------------------------- | -------------------------------------------- |
| `src/lib/stt/types.ts`                                        | 변경 없음(인터페이스 유지)                   |
| `src/lib/stt/web-speech.ts`                                   | 신규                                         |
| `src/lib/stt/index.ts`                                        | export·`createWebSpeechProvider` 추가        |
| `src/lib/stt/user-facing-error.ts`                            | Web Speech 에러 키 추가 또는 보조 함수       |
| `src/lib/stt/__tests__/web-speech.test.ts`                    | 신규                                         |
| `src/lib/stt/__tests__/user-facing-web-speech.test.ts`        | 신규(또는 통합)                              |
| `src/hooks/use-transcription.ts`                              | 토큰 없는 `prepareStreaming` 분기            |
| `src/hooks/__tests__/use-transcription.test.tsx`              | 신규 케이스                                  |
| `src/components/settings-panel.tsx`                           | 미지원 UI                                    |
| `src/components/__tests__/settings-panel-web-speech.test.tsx` | 신규                                         |
| `src/components/recorder.tsx`                                 | webSpeech 실구현                             |
| `src/components/__tests__/recorder-settings.test.tsx`         | webSpeech 케이스 확장(또는 신규 테스트 파일) |
| `docs/DECISIONS.md`                                           | Web Speech 채택·트레이드오프                 |
| `docs/ARCHITECTURE.md`                                        | STT 어댑터에 Web Speech 계층 설명            |
| `docs/PRD.md`                                                 | 전사 옵션 문구 추가                          |
| `Issues/STATUS.md`                                            | Feature 11 상태                              |

## 완료 조건

- 이슈 `Issues/feature-11-web-speech-api/00_issue.md` **§3 완료 조건** 체크리스트 전항 충족.
- `npm run test`(또는 프로젝트 표준) 전체 통과, 기존 `src/lib/stt/__tests__/openai-realtime.test.ts` 등 STT·Recorder 관련 테스트 회귀 없음.
- `docs/DECISIONS.md`의 기존 “`webSpeechApi` 미연결” 서술이 실제 제품 동작과 일치하도록 갱신.

## 테스트 전략

- **단위**: `MockSpeechRecognition` 클래스로 `continuous`/`interimResults`/`lang` 설정과 이벤트 시뮬레이션; `globalThis.SpeechRecognition` 교체 후 `afterEach` 복원(`openai-realtime.test.ts`의 `WebSocket` 패턴과 동일).
- **훅**: `renderHook` + mock Provider로 토큰 경로·tokenless 경로 분리 검증(`src/hooks/__tests__/use-transcription.test.tsx` 스타일 유지).
- **컴포넌트**: `happy-dom` + `SettingsProvider` + `isWebSpeechApiSupported` vi.mock으로 설정 패널 분기 검증.
- **Recorder**: `use-transcription`/`use-recorder` mock을 유지하되, webSpeech에서 `prepareStreaming`·옵션 shape 검증(기존 `recorder-settings.test.tsx`의 `lastTranscriptionOptions` 패턴 재사용).
- **수동 스모크**(선택): Chrome에서 `webSpeechApi` 모드, 마이크 권한, 한국어 인식, 장시간 녹음 시 `onend` 재시작 체감 확인.
