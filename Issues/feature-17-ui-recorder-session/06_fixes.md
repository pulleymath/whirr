# 리뷰 반영 수정 기록

## 수정 항목

### 1. 홈에서 저장·파이프라인 오류 메시지 누락 및 `persistError` 미사용 (린트)

- 심각도: MEDIUM (구현 리뷰 Important → 합성 MEDIUM)
- 출처: `02_review_implementation.md`, `05_review_synthesis.md`
- 수정 내용: `recorder.tsx`에 `persistError ?? pipeline.errorMessage`를 `data-testid="recorder-pipeline-user-error"`로 표시해 이전 `SummaryTabPanel` 경로와 동등한 피드백을 복구하고 ESLint 미사용 변수 경고를 제거했다.
- 변경 파일: `src/components/recorder.tsx`

### 2. 파이프라인 busy / 오류 UX 테스트 부재

- 심각도: MEDIUM
- 출처: `02`, `04`, `05`
- 수정 내용: `PostRecordingPipelineContext`·`PostRecordingPipelineContextValue`를 export해 테스트에서 Provider 값을 주입할 수 있게 했고, `recorder-ui.test.tsx`에 busy 안내 문구·파이프라인 오류 표시 테스트를 추가했다.
- 변경 파일: `src/lib/post-recording-pipeline/context.tsx`, `src/components/__tests__/recorder-ui.test.tsx`

## 미수정 항목 (사유 포함)

- 세션 상세 Step 6·8의 SVG·`cursor-pointer` 전용 단언: `IconButton`/`Button` 기본 클래스와 기존 행위 테스트로 간접 검증 가능하며, 동작 변경 없이 테스트만 늘리는 것은 우선순위에서 제외했다.
- `IconButton`의 `ariaLabel` vs `Button`의 `aria-label` 네이밍 통일: 공개 API 변경이므로 후속 작업으로 남긴다.
- `RecordButton` 크기·duration를 `01_plan.md`와 완전 일치: 제품 디자인으로 현재 구현을 유지한다.

## 수정 후 테스트 결과

- `npx tsc --noEmit` 통과
- `npx eslint .` 통과
- `npx prettier --check .` 통과
- `npm test` 통과
- `npm run build` 통과
