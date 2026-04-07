# Feature 6 — 작업 요약

## 구현된 기능

- OpenAI Realtime Transcription 기본 Provider (`OpenAIRealtimeProvider`, 모델 **`gpt-4o-mini-transcribe-2025-12-15`**).
- `POST /api/stt/token` → `POST /v1/realtime/transcription_sessions`, `client_secret.value` 반환.
- `use-transcription` 기본 `createOpenAiRealtimeProvider` + PCM passthrough; AssemblyAI 프레이밍은 `useAssemblyAiPcmFraming: true`로 선택.

## 주요 기술적 결정

- OpenAI `pcm16` = 24kHz mono s16le → Provider에서 16kHz Worklet 출력을 선형 리샘플.
- WebSocket: `wss://api.openai.com/v1/realtime?intent=transcription` + 서브프로토콜 인증.

## 테스트 커버리지

- `src/lib/stt/__tests__/openai-realtime.test.ts` (Mock WebSocket)
- `src/app/api/stt/token/__tests__/route.test.ts`
- `src/hooks/__tests__/use-transcription.test.tsx` (passthrough + AssemblyAI 프레이밍)

## 파일 변경 목록

- 신규: `src/lib/stt/openai-realtime.ts`, `Issues/feature-6-openai-stt/*`
- 수정: `src/lib/stt/index.ts`, `src/app/api/stt/token/route.ts`, `src/hooks/use-transcription.ts`, `.env.example`, `docs/*`, `Issues/STATUS.md`, `Issues/feature-6-openai-stt.md`

## 알려진 제한 사항

- 에피메랄 토큰 TTL이 짧음; 초장시간 녹음 시 재발급 로직 없음.

## 다음 단계 (해당 시)

- 필요 시 녹음 세션 중 토큰 갱신·WebSocket 재연결 설계
