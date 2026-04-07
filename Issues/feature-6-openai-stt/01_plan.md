# Feature 6 — OpenAI Realtime STT — 개발 계획서

## 개발 범위

- `POST /api/stt/token` → OpenAI `POST https://api.openai.com/v1/realtime/transcription_sessions`로 에피메랄 토큰(`client_secret.value`) 발급.
- `OpenAIRealtimeProvider`: `wss://api.openai.com/v1/realtime?intent=transcription` + 서브프로토콜 `realtime`, `openai-insecure-api-key.{token}`.
- 전사 모델: **`gpt-4o-mini-transcribe-2025-12-15`** (이슈의 `gpt-4o-transcribe` 대체).
- 클라이언트 PCM은 기존 16kHz mono s16le 유지; API `pcm16`은 **24kHz**이므로 Provider에서 **16k→24k 리샘플** 후 `input_audio_buffer.append`로 base64 전송.
- `use-transcription` 기본 Provider를 OpenAI로 전환; OpenAI는 프레이밍 제약이 덜하므로 기본 **passthrough** PCM 전달(AssemblyAI용 50–1000ms 프레이밍은 옵션).

## 기술적 접근 방식

- `TranscriptionProvider` 인터페이스 준수: `connect` → `sendAudio` → `stop` → `disconnect`.
- 연결 직후 `transcription_session.update`로 세션 파라미터 정렬(이슈 스펙).
- 이벤트: `conversation.item.input_audio_transcription.delta` → `onPartial`, `...completed` → `onFinal`, `error` → `onError`.
- 종료 시 `input_audio_buffer.commit` 후 소켓 정리.

## TDD 구현 순서

### Step 1: OpenAI Provider 단위 테스트 (RED)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/stt/__tests__/openai-realtime.test.ts`
- 케이스: WebSocket URL·서브프로토콜, `transcription_session.update`에 모델 `gpt-4o-mini-transcribe-2025-12-15`, append/commit 메시지, delta/completed 콜백

**GREEN** — `src/lib/stt/openai-realtime.ts` 최소 구현

**REFACTOR** — 파싱·리샘플 유틸 정리

### Step 2: 토큰 라우트

**RED** — `route` 단위 테스트(선택) 또는 수동 검증; Provider 통합으로 우선 검증

**GREEN** — `src/app/api/stt/token/route.ts`에서 `OPENAI_API_KEY`로 transcription_sessions 호출

### Step 3: 팩토리·훅

**GREEN** — `src/lib/stt/index.ts`에 `createOpenAiRealtimeProvider` 추가

**RED/GREEN** — `use-transcription.test.tsx`: 기본 passthrough `sendPcm`, `useAssemblyAiPcmFraming` 시 기존 AssemblyAI 프레이밍 검증

## 파일 변경 계획

- 신규: `src/lib/stt/openai-realtime.ts`, `src/lib/stt/__tests__/openai-realtime.test.ts`
- 수정: `src/lib/stt/index.ts`, `src/app/api/stt/token/route.ts`, `src/hooks/use-transcription.ts`, `src/hooks/__tests__/use-transcription.test.tsx`
- 수정: `.env.example`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/PRD.md`, `docs/README.md`

## 완료 조건

- 이슈 Done Criteria 충족, `npm test`·타입·린트·빌드 통과.

## 테스트 전략

- Vitest + Mock WebSocket(AssemblyAI 테스트와 동일 패턴).
- 훅 테스트는 mock provider로 상태·passthrough 프레이밍 검증.
