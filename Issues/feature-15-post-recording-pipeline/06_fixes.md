# 리뷰 반영 수정 기록

## 수정 항목

### 1. `enqueue` 중복 호출 시 작업 유실 (HIGH, 종합 I2 / 구현 리뷰)

- 심각도: HIGH
- 출처: `05_review_synthesis.md`, `02_review_implementation.md`
- 수정 내용: 파이프라인이 이미 돌아가는 동안 들어오는 `enqueue`는 **FIFO 대기열(`pendingRef`)**에 넣고, 현재 작업이 끝나면 `continueOrIdle`에서 다음 항목을 순차 처리하도록 변경. 재귀 호출은 `useLayoutEffect`로 갱신하는 `runPipelineRef`로 우회해 린트 규칙을 만족.
- 변경 파일: `src/lib/post-recording-pipeline/context.tsx`

### 2. `/api/summarize` 본문 상한 없음 (MEDIUM → 머지 전 완화, M1)

- 심각도: MEDIUM (공개 배포·남용 방지)
- 출처: `03_review_security.md`, `05_review_synthesis.md`
- 수정 내용: `SUMMARIZE_MAX_TEXT_LENGTH`(120_000자) 상수를 두고 서버에서 초과 시 413. 클라이언트 파이프라인에서도 동일 상한으로 사전 검사해 불필요한 요청을 줄임.
- 변경 파일: `src/lib/api/summarize-constants.ts`, `src/app/api/summarize/route.ts`, `src/lib/post-recording-pipeline/context.tsx`, `src/app/api/summarize/__tests__/route.test.ts`

### 3. Mock 요약 API 인위 지연 (MEDIUM, M2)

- 심각도: MEDIUM
- 출처: `03_review_security.md`
- 수정 내용: `setTimeout(200)`은 **`NODE_ENV === "production"`에서는 생략**. 개발·테스트에서는 기존과 같이 지연 유지.
- 변경 파일: `src/app/api/summarize/route.ts`

### 4. 아키텍처 문서와 구현 불일치 (MEDIUM, M5)

- 심각도: MEDIUM
- 출처: `04_review_architecture.md`
- 수정 내용: `docs/ARCHITECTURE.md`에 **녹음 후 파이프라인**(마지막 세그먼트 전사, `/api/summarize`, `PostRecordingPipelineProvider`, `status`/`summary`) 단락 추가.
- 변경 파일: `docs/ARCHITECTURE.md`

### 5. TypeScript·린트·포매터 (이전 턴)

- 심각도: (품질 게이트)
- 수정 내용: `use-batch-transcription` 테스트에서 `saved!`로 단언, `transcribe-segment` 미사용 `catch` 바인딩 제거, Prettier 적용.
- 변경 파일: `src/hooks/__tests__/use-batch-transcription.test.tsx`, `src/lib/transcribe-segment.ts` 등

## 미수정 항목 (사유 포함)

- **M3**: `PostRecordingPipelineProvider` 통합 테스트 — 회귀 가치는 크나 이번 라운드에서는 범위를 넘어 후속 이슈로 둠.
- **M4**: 파이프라인 I/O를 순수 모듈로 분리 — 구조 개선만으로 동작 동일, 후속 리팩터 권장.
- **LOW** 다수: 로그 노이즈, `console.error` 정리, mock 팩토리 공통화 등 — 우선순위 낮음.

## 수정 후 테스트 결과

- `npx tsc --noEmit` 통과
- `npx eslint . --max-warnings 0` 통과
- `npx prettier --check .` 통과
- `npm test` — 266 tests 통과
- `npm run build` 통과
