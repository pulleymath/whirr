# Feature 10: 녹음 후 일괄 전사 — 작업 요약

## 구현된 기능

- `startBlobRecording` / `pickWebmRecordingMimeType`: MediaRecorder webm(opus 우선)·Analyser 제공.
- `POST /api/stt/transcribe`: multipart 프록시, 레이트 리밋·25MB·MIME·**모델 화이트리스트**, `maxDuration` 300초.
- `useBatchTranscription`: 녹음→전사 상태 머신, 55분 안내·60분 자동 전사, `stopAndTranscribe`가 성공 시 텍스트 반환.
- `Recorder` + `TranscriptView`: batch 모드 UI(안내·전사 중·결과), 세션 저장·요약 탭 공통화(`persistAfterTranscript`).

## 주요 기술적 결정

- 실시간 경로는 유지하고 `settings.mode === "batch"`에서만 배치 훅 사용.
- STT 토큰과 동일 메모리 레이트 리밋 버킷 재사용.
- 공개 API 비용 방지를 위해 서버 측 **허용 전사 모델 집합** 고정.

## 테스트 커버리지

- 오디오 Blob 녹음, transcribe 라우트(허용/거절·429·502·비 JSON 등), 배치 훅(성공·HTTP 오류·권한·**가짜 타이머**), Recorder 배치 통합·설정 테스트.

## 파일 변경 목록

- `src/lib/audio.ts`, `src/lib/__tests__/audio-blob-recording.test.ts`
- `src/lib/api/stt-transcribe-constants.ts`
- `src/app/api/stt/transcribe/route.ts`, `__tests__/route.test.ts`
- `src/hooks/use-batch-transcription.ts`, `__tests__/use-batch-transcription.test.tsx`
- `src/components/recorder.tsx`, `transcript-view.tsx`, `__tests__/recorder-batch.test.tsx`, `recorder-settings.test.tsx`
- `src/lib/stt/user-facing-error.ts`
- `docs/DECISIONS.md`, `ARCHITECTURE.md`, `PRD.md`, `CODEMAP.md`
- `Issues/feature-10-batch-transcription/*`, `Issues/STATUS.md`

## 알려진 제한 사항

- 오디오 포맷 검증은 선언 MIME 위주(매직 바이트 미적용).
- 장시간 녹음 시 100ms 타이머로 인한 리렌더 빈도는 최적화 여지 있음.
- `useRecorder`는 batch 모드에서도 마운트(후속 리팩터 후보).

## 다음 단계 (해당 시)

- Feature 11(Web Speech API) 및 리뷰 백로그(MIME·로깅·429 문구 정리 등).
