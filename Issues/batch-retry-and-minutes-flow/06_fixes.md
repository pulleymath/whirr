# 리뷰 반영 수정 기록

## 수정 항목

### 1. 워커 예외 시 미처리 Promise rejection (F-1)

- 심각도: CRITICAL (종합 리뷰)
- 출처: 04_review_architecture.md
- 수정 내용: `runWorker`의 `catch`에서 예외를 다시 던지지 않고 `resolveWorkerIdleIfIdle()`까지 수행한 뒤 종료. 비프로덕션에서만 `console.error`로 남김.
- 변경 파일: `src/hooks/use-batch-transcription.ts`

### 2. 배치 실패 → 수동 재시도 → 저장·enqueue 통합 테스트 (F-2)

- 심각도: HIGH
- 출처: 02_review_implementation.md, 04_review_architecture.md, 05_review_synthesis.md
- 수정 내용: `recorder-batch.test.tsx`에 STT 503으로 중지 실패 후 `다시 시도` 클릭 시 `saveSession`·`mockEnqueue`가 호출되는 시나리오 추가.
- 변경 파일: `src/components/__tests__/recorder-batch.test.tsx`

### 3. 훅 테스트 보강 (F-3 일부)

- 심각도: HIGH (계획 대비 잔여 갭은 MEDIUM으로 남김)
- 출처: 02_review_implementation.md, 05_review_synthesis.md
- 수정 내용: `retryTranscription` 성공 시 반환 `BatchStopResult`의 `finalBlob === null`·`segments` 검증 추가. `online` 이벤트로 실패 세그먼트 재시도 검증 추가.
- 변경 파일: `src/hooks/__tests__/use-batch-transcription.test.tsx`

### 4. `enqueueIndices` 루프 정리

- 심각도: LOW (아키텍처 제안)
- 출처: 04_review_architecture.md
- 수정 내용: 불필요한 `raw`→`index` 대입 제거, `for (const index of indices)`로 단순화.
- 변경 파일: `src/hooks/use-batch-transcription.ts`

## 미수정 항목 (사유 포함)

- **계획 Step 1·2 전용 describe 전부**: 두 번 연속 회전 시 fetch 순서·회전 시 `[실패, 신규]` 순서 전용 케이스는 구현과 맞지만 테스트 작성 비용 대비 이번 라운드에서는 `online`/재시도/통합 테스트로 우선순위를 두고 생략. 회귀 시 추가 권장.
- **M-2·M-3 문서 정합(01_plan/00_issue 문구)**: 코드 동작은 의도적이나 문서 수정은 사용자 요청 없이 `Issues/` 외 마크다운을 넓게 고치지 않음(워크스페이스 규칙). 필요 시 후속 PR에서 `01_plan.md` Step 4·online 문구만 정리.
- **M-1·M-4 성능·쿼터**: 제품 요구(무제한 재시도)와 충돌할 수 있어 서버/관측 측면 권고만 유지, 클라이언트 코드 변경 없음.
- **LOW 일괄**: `data-testid`, `BatchRetryControl` union 타입, transcript 증분 등은 스코프 밖으로 유지.

## 수정 후 테스트 결과

- `npm test -- src/components/__tests__/recorder-batch.test.tsx src/hooks/__tests__/use-batch-transcription.test.tsx` 통과 (Phase 6 전체 게이트는 아래 명령으로 재실행).
