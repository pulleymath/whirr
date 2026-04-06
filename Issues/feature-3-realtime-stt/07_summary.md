# Feature 3: AssemblyAI 실시간 STT — 작업 요약

## 구현된 기능

- `POST /api/stt/token`: AssemblyAI 실시간 토큰 프록시(`ASSEMBLYAI_API_KEY` 서버 전용).
- `AssemblyAIRealtimeProvider`: WSS 연결, PCM base64 전송, Partial/Final/SessionTerminated 처리, `terminate_session` 및 종료 타임아웃.
- `useTranscription`: 토큰 획득, 연결, partial/finals 상태, `fetchToken`/`createProvider` 주입(테스트용).
- `TranscriptView`: 부분 전사 라이브 영역(`aria-live`) + 확정 문장 목록 + STT 에러 표시.
- `Recorder`: 녹음 전 STT 준비 → PCM 스트림 연동 → 중지 시 STT 종료(`try/finally`).

## 주요 기술적 결정

- `prepareStreaming()` 성공 여부를 `boolean`으로 반환해 토큰·연결 실패 시 녹음을 시작하지 않음.
- `stop()`이 응답 없을 때 15초 후 강제 종료해 UI·리소스가 멈추지 않도록 함.

## 테스트 커버리지

- API 라우트(fetch mock), AssemblyAI Provider(WebSocket mock), `useTranscription`, `TranscriptView`, `@/lib/stt` export, Recorder STT 호출 순서.

## 코드 리뷰 (subagent 재생성)

- `02_review_implementation.md` ~ `05_review_synthesis.md`는 issue-driven-dev Phase 3에 맞춰 **병렬 subagent**(implementation-reviewer, security-reviewer, architecture-reviewer)와 이어서 **review-synthesizer**로 다시 작성한 버전이다.
- 분석 대상 diff: `git diff 1739ce9..HEAD -- src/ docs/README.md Issues/STATUS.md`, 계획서 `01_plan.md`, 아키텍처 리뷰 시 `docs/ARCHITECTURE.md` 참조.

## 파일 변경 목록

- 신규: `src/app/api/stt/token/route.ts`, `src/app/api/stt/token/__tests__/route.test.ts`, `src/lib/stt/assemblyai.ts`, `src/lib/stt/__tests__/assemblyai.test.ts`, `src/hooks/use-transcription.ts`, `src/hooks/__tests__/use-transcription.test.tsx`, `src/components/transcript-view.tsx`, `src/components/__tests__/transcript-view.test.tsx`, `src/components/__tests__/recorder-stt-integration.test.tsx`, `Issues/feature-3-realtime-stt/*`
- 수정: `src/components/recorder.tsx`, `src/lib/stt/index.ts`, `src/lib/stt/__tests__/types.test.ts`, `Issues/STATUS.md`

## 알려진 제한 사항

- 토큰 API에 인증/레이트 리밋 없음(MVP).
- 녹음 시작 버튼 연타 시 중복 세션 가능(가드 미적용).

## 다음 단계 (해당 시)

- Feature 4(IndexedDB 세션 저장)와 연계해 녹음 종료 시 확정 텍스트 저장.
