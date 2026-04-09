# 리뷰 반영 수정 기록

## 수정 항목

### 1. 전사 API `model` 화이트리스트 (보안 HIGH)

- 심각도: HIGH
- 출처: `03_review_security.md`, `05_review_synthesis.md`
- 수정 내용: `stt-transcribe-constants.ts`에 허용 모델 집합·길이 상한을 두고, `transcribe/route.ts`에서 비허용 시 400 반환. 단위 테스트 추가.
- 변경 파일: `src/lib/api/stt-transcribe-constants.ts`, `src/app/api/stt/transcribe/route.ts`, `src/app/api/stt/transcribe/__tests__/route.test.ts`, `src/lib/stt/user-facing-error.ts`

### 2. 55분/60분 타이머 자동화 테스트 (구현·아키텍처 HIGH)

- 심각도: HIGH
- 출처: `02_review_implementation.md`, `04_review_architecture.md`
- 수정 내용: `use-batch-transcription.test.tsx`에 `vi.useFakeTimers()` 기반 소프트 안내·60분 자동 전사(fetch 호출) 검증 추가.
- 변경 파일: `src/hooks/__tests__/use-batch-transcription.test.tsx`

### 3. 업스트림 비 JSON 본문 502 테스트 (MEDIUM)

- 심각도: MEDIUM
- 출처: `02_review_implementation.md`
- 수정 내용: OpenAI 응답이 JSON이 아닐 때 502·`Invalid transcription response` 단언.
- 변경 파일: `src/app/api/stt/transcribe/__tests__/route.test.ts`

### 4. 문서·STATUS (계획 Step 5 / HIGH)

- 심각도: HIGH
- 출처: 리뷰 종합
- 수정 내용: `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/PRD.md`, `docs/CODEMAP.md`에 배치 전사·1시간 제한·데이터 흐름 반영. `Issues/STATUS.md` Feature 10 완료 표기.
- 변경 파일: 위 문서 및 `Issues/STATUS.md`

## 미수정 항목 (사유 포함)

- MIME 매직 바이트 검증, `formData` 스트리밍 조기 거절, 100ms 타이머 리렌더 최적화, Recorder 모드별 훅 분리: **MEDIUM/LOW·백로그**로 남김(합성 문서 권장 순서 4~5).
- 업스트림 오류 본문 로그 축소: 운영 정책과 연계되어 별도 이슈로 두는 편이 낫다고 판단.

## 수정 후 테스트 결과

- `npm test` 전체 통과
- `npx tsc --noEmit`, `npx eslint .`, `npx prettier --check .`, `npm run build` 통과(로컬 실행 시점 기준)
