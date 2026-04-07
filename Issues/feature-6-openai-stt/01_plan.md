# Feature 6 — OpenAI STT — 개발 계획서

## 개발 범위

- AssemblyAI 실시간 STT를 OpenAI **Realtime Transcription**으로 교체하되, `TranscriptionProvider` 추상화를 유지하여 **UI(`recorder.tsx`, `transcript-view.tsx` 등)는 변경하지 않는다.**
- **모델 고정**: `gpt-4o-mini-transcribe-2025-12-15` (요청·세션·문서·테스트에서 동일 상수로 관리).
- **신규 Provider**: `OpenAIRealtimeProvider` — `wss://api.openai.com/v1/realtime?intent=transcription`, 브라우저 WebSocket 제약에 맞는 **에피메랄 토큰(서브프로토콜) 인증**, `transcription_session.update` / `input_audio_buffer.append`·`commit`, 이벤트를 `onPartial`·`onFinal`·`onError`로 매핑.
- **토큰 API**: `POST /api/stt/token`이 `POST https://api.openai.com/v1/realtime/transcription_sessions`를 호출해 `client_secret.value`를 `{ token }`으로 반환하고, **기존 레이트 리밋**을 유지한다.
- **오디오 파이프라인**: 앱 AudioWorklet은 **16 kHz mono s16le**을 출력하고, OpenAI `pcm16`은 **24 kHz mono s16le**을 기대하므로 **Provider 또는 파이프라인에서 16 kHz → 24 kHz 리샘플링**을 수행한 뒤 base64로 append한다.
- **팩토리·훅**: `src/lib/stt/index.ts`에 `createOpenAiRealtimeProvider`를 두고 기본 연결을 OpenAI로 전환; AssemblyAI 구현·테스트는 보존. `use-transcription`에서는 OpenAI에 맞게 기본 **PCM 전달 방식(passthrough)**을 쓰고, AssemblyAI 호환 **50–1000ms 프레이밍은 옵션(`useAssemblyAiPcmFraming` 등)**으로만 켠다.
- **문서·환경**: `.env.example`에 `OPENAI_API_KEY`, `docs/DECISIONS.md` D9, `docs/ARCHITECTURE.md`·`docs/PRD.md`·`docs/README.md`·`Issues/STATUS.md` 반영.

## 기술적 접근 방식

- **호출 순서**: `connect` → `sendAudio`(반복) → `stop` → `disconnect` — `types.ts`의 `TranscriptionProvider` 계약을 그대로 만족.
- **연결 후 세션**: `transcription_session.update`로 `input_audio_format: "pcm16"`, `input_audio_transcription`(모델·`language: "ko"`), `turn_detection`(server_vad), `input_audio_noise_reduction` 등 이슈 스펙과 동일하게 맞춘다.
- **전송**: 리샘플된 PCM 청크를 `input_audio_buffer.append`의 base64 `audio`로 전송; 종료 시 `input_audio_buffer.commit` 후 소켓 정리.
- **수신 매핑**: `conversation.item.input_audio_transcription.delta` → `onPartial`, `...completed` → `onFinal`, `error` → `onError`.
- **토큰**: 서버만 `OPENAI_API_KEY`를 보유하고, 클라이언트는 `/api/stt/token`으로 받은 에피메랄 값만으로 WebSocket에 연결한다.
- **검증 관점**: 브랜치에 구현이 있어도 **회귀 방지**를 위해 동일 순서로 테스트를 먼저(또는 유지·보강) 두고 구현과 문서를 맞춘다.

## TDD 구현 순서

### Step 1: OpenAI Realtime Provider + 단위 테스트

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/stt/__tests__/openai-realtime.test.ts`
- 테스트 케이스 목록
  - WebSocket URL(`intent=transcription`) 및 인증용 서브프로토콜(에피메랄 토큰) 구성이 기대와 일치하는지
  - `connect` 직후 `transcription_session.update`가 전송되고, `input_audio_transcription.model`이 **`gpt-4o-mini-transcribe-2025-12-15`**인지
  - `sendAudio` 시 **16 kHz 입력이 24 kHz로 리샘플**된 뒤 `input_audio_buffer.append` 형태(base64)로 나가는지(또는 리샘플 모듈 단위로 분리 시 해당 유닛 테스트)
  - 서버에서 `delta` / `completed` JSON을 보낼 때 `onPartial` / `onFinal`이 호출되는지
  - `error` 이벤트 시 `onError` 호출
  - `stop` 시 `input_audio_buffer.commit` 전송 후 연결 종료 흐름

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/stt/openai-realtime.ts`
- 핵심 구현 내용: `OpenAIRealtimeProvider` 클래스, 모델 상수 export, WebSocket 생명주기, 세션 update, append/commit, 이벤트 파싱, **16→24 kHz 리샘플(선형 보간 등 단순·결정적 구현)**

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: JSON 파싱·이벤트 타입 분기, 리샘플 로직을 순수 함수로 분리해 테스트·재사용 용이하게 정리; 매직 스트링은 상수화

### Step 2: `POST /api/stt/token` 라우트 테스트 및 구현

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/app/api/stt/token/__tests__/route.test.ts`
- 테스트 케이스 목록
  - `OPENAI_API_KEY` 없음 → 503 및 사용자에게 안전한 에러 본문
  - `fetch` 모킹으로 `https://api.openai.com/v1/realtime/transcription_sessions`에 **POST**, `Authorization: Bearer …`, `Content-Type: application/json`
  - 요청 바디에 `input_audio_transcription.model`이 **`gpt-4o-mini-transcribe-2025-12-15`**, `language`가 `ko` 등 기대 필드 포함
  - 정상 응답에서 `client_secret.value` → `{ token: "..." }` JSON, 상태 200
  - `client_secret` 누락·업스트림 오류 시 502/적절한 에러 코드
  - 레이트 리밋 동작(기존 `stt-token-rate-limit`와 연동)이 깨지지 않았는지

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/app/api/stt/token/route.ts`
- 핵심 구현 내용: 서버에서만 키 사용, upstream POST, 응답 파싱, 기존 rate limit 미들웨어/헬퍼 유지

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: upstream URL·바디 구성을 `openai-realtime` 상수와 공유해 모델/언어 불일치 방지; 에러 매핑 일원화

### Step 3: STT 팩토리(`index.ts`) + `use-transcription` 및 훅 테스트

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/hooks/__tests__/use-transcription.test.tsx` (필요 시 `src/lib/stt/__tests__`에 팩토리 스모크 추가)
- 테스트 케이스 목록
  - 기본 경로에서 `createOpenAiRealtimeProvider`(또는 동일 시그니처 mock)가 선택되고, 녹음 파이프라인이 `connect` → PCM 전달 → `stop` 순서를 지키는지
  - **기본(OpenAI)**: 짧은 PCM도 **과도한 버퍼링 없이** Provider로 전달되는지(passthrough)
  - **`useAssemblyAiPcmFraming`(또는 동등 옵션) 켜짐**: 50–1000ms 프레이밍이 AssemblyAI 경로에서만 적용되는지
  - 토큰 fetch 실패·Provider `onError` 시 UI 바인딩되는 상태(에러 메시지 등)가 기대대로인지

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/stt/index.ts`, `src/hooks/use-transcription.ts`
- 핵심 구현 내용: `createOpenAiRealtimeProvider` export, 기본 Provider 생성 함수 전환, PCM 프레이밍 플래그 분기, 기존 훅 API 유지

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: Provider 생성 주입 가능성(테스트 용이), 중복 타이머/클린업 로직 정리

### Step 4: 문서·환경·상태(이슈 Done Criteria 정합)

**RED** — 실패하는 테스트 작성

- 테스트 파일: 해당 없음(문서/예시는 수동·리뷰 체크리스트) 또는 `types`/상수 스냅샷 테스트로 “모델 문자열 단일 출처”만 유지
- 테스트 케이스 목록
  - (선택) `OPENAI_REALTIME_TRANSCRIBE_MODEL`이 테스트에서 token route·provider 테스트와 동일하게 참조되는지

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `.env.example`, `docs/DECISIONS.md`(D9), `docs/ARCHITECTURE.md`, `docs/PRD.md`, `docs/README.md`, `Issues/STATUS.md`
- 핵심 구현 내용: OpenAI STT 전환 사유·흐름·환경 변수(`OPENAI_API_KEY`, `/api/stt/token` rate limit) 명시; AssemblyAI는 레거시/선택으로 기술

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: 문서 간 용어·다이어그램·엔드포인트 URL 중복 제거, Feature 6 완료 시 `STATUS` 체크박스와 본문 일치

## 파일 변경 계획

| 구분            | 경로                                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 신규            | `src/lib/stt/openai-realtime.ts`, `src/lib/stt/__tests__/openai-realtime.test.ts`                                                      |
| 수정            | `src/app/api/stt/token/route.ts`, `src/app/api/stt/token/__tests__/route.test.ts`                                                      |
| 수정            | `src/lib/stt/index.ts`, `src/hooks/use-transcription.ts`, `src/hooks/__tests__/use-transcription.test.tsx`                             |
| 수정(선택·유지) | `src/lib/stt/assemblyai.ts`, `src/lib/stt/__tests__/assemblyai.test.ts`                                                                |
| 환경·문서       | `.env.example`, `.env.local`(로컬만), `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/PRD.md`, `docs/README.md`, `Issues/STATUS.md` |

## 완료 조건

- [ ] `OpenAIRealtimeProvider`가 `TranscriptionProvider`를 정확히 구현한다.
- [ ] 녹음 시작 시 `POST /api/stt/token`이 OpenAI 에피메랄 토큰을 정상 발급한다.
- [ ] 브라우저에서 `wss://api.openai.com/v1/realtime?intent=transcription`에 정상 연결된다.
- [ ] 녹음 중 음성이 실시간 전사되어 화면에 표시된다(부분 → 확정).
- [ ] 한국어 음성이 정상 전사된다.
- [ ] 녹음 중지 시 잔여 오디오 처리 후 최종 텍스트가 확정된다.
- [ ] 기존 UI 컴포넌트는 변경 없이 동작한다.
- [ ] Provider 단위 테스트 및 `use-transcription` 훅 테스트가 통과한다.
- [ ] `npm test`, `npm run build`(및 프로젝트 표준 타입·린트) 통과.

## 테스트 전략

- **단위**: Vitest + **Mock WebSocket**(기존 `assemblyai.test.ts`와 동일한 패턴)으로 네트워크 없이 프로토콜·콜백·commit 순서 검증.
- **리샘플**: 고정 샘플 버퍼를 넣었을 때 출력 길이·샘플레이트 관계(16k→24k)가 기대 범위인지 검증하는 테스트를 Provider 또는 분리 유틸에 둔다.
- **API 라우트**: `globalThis.fetch` 모킹으로 upstream URL·헤더·바디·모델 상수 일치와 에러 분기 검증.
- **훅**: React Testing Library + mock `TranscriptionProvider`로 토큰 요청, PCM 전달 경로(passthrough vs AssemblyAI 프레이밍 옵션), 언마운트 시 클린업 검증.
- **회귀**: AssemblyAI 테스트 스위트를 유지해 향후 Provider 스위치 시에도 계약이 깨지지 않도록 한다.
- **수동 스모크**: `.env.local`에 `OPENAI_API_KEY` 설정 후 실제 녹음·한국어·중지 시나리오로 E2E 확인(자동 E2E가 없을 경우 체크리스트로 문서화).
