# Feature 3: AssemblyAI 실시간 STT — 작업 요약

## 구현된 기능

- `POST /api/stt/token`: AssemblyAI 실시간 토큰 프록시(`ASSEMBLYAI_API_KEY` 서버 전용), **클라이언트 키(IP/프록시 헤더)별 레이트 리밋** 및 `429` 응답.
- `AssemblyAIRealtimeProvider`: WSS, PCM base64(청크 인코딩), Partial/Final/SessionTerminated, `terminate_session`, 종료 타임아웃, CONNECTING 시 **오디오 큐 상한(128)** , 업스트림 `error` 필드는 내부 코드로만 전달.
- `useTranscription`: 토큰 획득, 연결, partial/finals, **UI용 한국어 오류 매핑**(`userFacingSttError`), `createAssemblyAiRealtimeProvider` 기본 팩토리.
- `TranscriptView`: 부분 전사 라이브 영역(`aria-live`) + 확정 문장 목록 + STT 에러 표시.
- `Recorder`: 녹음 전 STT 준비 → PCM 스트림 연동 → 중지 시 STT 종료(`try/finally`).

## 주요 기술적 결정

- `prepareStreaming()` 성공 여부를 `boolean`으로 반환해 토큰·연결 실패 시 녹음을 시작하지 않음.
- `stop()`이 응답 없을 때 15초 후 강제 종료.
- 토큰 API 인메모리 레이트 리밋의 서버리스 한계는 `DECISIONS.md` D7에 기록.

## 테스트 커버리지

- 토큰 라우트: fetch mock, **429 레이트 리밋**, `Request` + `x-forwarded-for`.
- `stt-token-rate-limit` 단위 테스트.
- AssemblyAI Provider: WebSocket mock, **SessionTerminated 단독**, **업스트림 error → STT_PROVIDER_ERROR**.
- `useTranscription`, `TranscriptView`, `@/lib/stt` export·팩토리.
- Recorder: 시작 순서, PCM 전달, **중지 시 `stopRecording` → `finalizeStreaming` 순서**.

## 파일 변경 목록 (Phase 5 이후 주요 추가)

- `src/lib/api/stt-token-rate-limit.ts`, `src/lib/api/__tests__/stt-token-rate-limit.test.ts`
- `src/lib/stt/user-facing-error.ts`
- `src/app/api/stt/token/route.ts`, `src/app/api/stt/token/__tests__/route.test.ts`
- `src/lib/stt/assemblyai.ts`, `src/lib/stt/index.ts`, `src/hooks/use-transcription.ts`
- `src/components/__tests__/recorder-stt-integration.test.tsx`, `src/lib/stt/__tests__/assemblyai.test.ts`, `src/hooks/__tests__/use-transcription.test.tsx`, `src/lib/stt/__tests__/types.test.ts`
- `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/README.md`, `.env.example`
- `Issues/feature-3-realtime-stt/06_fixes.md`, `07_summary.md`

## 알려진 제한 사항

- 레이트 리밋은 **인스턴스별 메모리**라 전역 단일 한도는 아님(D7).
- 사용자 계정 기반 인증·전역 쿼터는 미구현.
- 녹음 시작 버튼 연타 시 중복 STT 세션 가능(가드 미적용).

## 다음 단계 (해당 시)

- Feature 4(IndexedDB 세션 저장)와 연계.
- 트래픽 증가 시 Redis/Edge 기반 레이트 리밋 또는 WAF 검토.

## 코드 리뷰 (subagent 재생성)

- `02_review_implementation.md` ~ `05_review_synthesis.md`는 issue-driven-dev Phase 3에 맞춰 병렬 subagent로 작성한 버전이다. Phase 5에서 그 중 HIGH·MEDIUM 항목을 코드에 반영했다.
