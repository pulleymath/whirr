# Post-recording pipeline — 작업 요약

## 구현된 기능

- 녹음 중지 후 **마지막 세그먼트 전사 + Mock 요약**을 레이아웃 `PostRecordingPipelineProvider`에서 수행해 SPA 이동 후에도 완료까지 유지.
- 세션 **선저장** 후 `updateSession`으로 전사·요약·`status` 점진 갱신.
- `useBeforeUnload`: 녹음·전사·요약 중 이탈 경고.
- **녹음 중에만** 히스토리 링크 비활성; 파이프라인 busy 시 새 녹음 시작 차단.
- 세션 상세 **클립보드 아이콘**, `summary` 표시; 홈 Recorder **오디오 다운로드 제거**.
- 전사 UI: 세그먼트 in-flight 시 로딩·말줄임.
- `/api/summarize`: 본문 길이 상한(413), 프로덕션에서는 mock 지연 없음.

## 주요 기술적 결정

- 전사 fetch·재시도는 `transcribe-segment.ts`로 공유; 배치 훅은 `stopAndTranscribe`에서 마지막 블롭만 넘기고 Context가 마지막 전사·요약 담당.
- 파이프라인 **대기 큐**로 연속 `enqueue` 유실 방지.
- `runPipelineRef` + `useLayoutEffect`로 재귀 스케줄링과 React Compiler/ESLint 규칙을 동시에 만족.

## 테스트 커버리지

- DB `saveSession`/`updateSession`, 전사 유틸, summarize 라우트(상한 포함), 배치 훅, Recorder·세션 목록·상세·전사 뷰, `useBeforeUnload` 등 기존·신규 단위 테스트.

## 파일 변경 목록 (요지)

- `src/lib/post-recording-pipeline/context.tsx`, `src/lib/api/summarize-constants.ts`, `src/app/api/summarize/route.ts`
- `src/hooks/use-batch-transcription.ts`, `src/lib/transcribe-segment.ts`, Recorder/세션/프로바이더 관련 컴포넌트
- `docs/ARCHITECTURE.md`, `Issues/feature-15-post-recording-pipeline/*` 산출물

## 알려진 제한 사항

- 파이프라인 Provider **통합 테스트**는 아직 없음(M3).
- `/api/summarize`에 **레이트 리밋**은 미구현(향후 공개 배포 시 검토).
- 장시간 배치 녹음 시 Blob 메모리 부담은 기존과 동일.

## 다음 단계 (해당 시)

- Provider 통합 테스트 및 선택적 I/O 모듈 분리(M4).
- 요약 API 실연동 시 인증·레이트 리밋·비용 상한.
