# 기능 구현 및 테스트 리뷰 (요약)

- `TranscriptionProvider` 계약을 준수하고, OpenAI 이벤트를 `onPartial`/`onFinal`로 매핑함.
- 모델 ID는 `OPENAI_REALTIME_TRANSCRIBE_MODEL` 단일 상수로 토큰 라우트·WebSocket 세션 설정에 공유됨.
- Vitest: `openai-realtime.test.ts`, `token/route.test.ts`, `use-transcription.test.tsx`로 회귀·신규 동작 검증.

**개선 여지**: 장시간 녹음 시 에피메랄 만료에 대한 재연결·재토큰은 미구현(이슈 한계로 문서화).
