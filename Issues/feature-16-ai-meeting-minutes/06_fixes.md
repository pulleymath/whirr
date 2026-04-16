# 리뷰 반영 수정 기록

`05_review_synthesis.md`의 **FIX_THEN_SHIP**에 맞춰, CRITICAL/HIGH 및 일부 MEDIUM 항목을 반영했다.

## 수정 항목

### 1. `docs/ARCHITECTURE.md` 녹음 후 파이프라인 엔드포인트 불일치

- 심각도: HIGH (architecture)
- 출처: 04_review_architecture.md, 05_review_synthesis.md
- 수정 내용: `/api/summarize`·mock 요약 서술을 `/api/meeting-minutes`·회의록·`{ summary }` 저장 흐름으로 갱신.
- 변경 파일: `docs/ARCHITECTURE.md`

### 2. 회의록 API — 입력 상한·모델 화이트리스트·IP 기반 레이트 리밋

- 심각도: HIGH (security)
- 출처: 03_review_security.md, 05_review_synthesis.md
- 수정 내용: `MEETING_MINUTES_MAX_TEXT_LENGTH`(500_000자) 초과 시 429; `MEETING_MINUTES_MODEL_IDS`에 없는 `model`은 400; `getClientKeyFromRequest` + `isMeetingMinutesRateLimited`로 429(환경 변수로 한도 조정). 인증 없는 공개 엔드포인트 특성은 `.env.example` 주석으로 운영자가 한도를 조정할 수 있게 함.
- 변경 파일: `src/lib/api/meeting-minutes-api-constants.ts`, `src/lib/api/meeting-minutes-rate-limit.ts`, `src/app/api/meeting-minutes/route.ts`, `.env.example`

### 3. map 단계 병렬 폭주 완화

- 심각도: HIGH (security / performance)
- 출처: 03_review_security.md
- 수정 내용: `MEETING_MINUTES_MAP_CONCURRENCY`(4)씩 배치로 `Promise.all` — 전체 무제한 병렬 호출 제거.
- 변경 파일: `src/lib/meeting-minutes/constants.ts`, `src/lib/meeting-minutes/map-reduce.ts`

### 4. Step 5 — 파이프라인이 `/api/meeting-minutes`를 호출하는지 테스트

- 심각도: HIGH (implementation)
- 출처: 02_review_implementation.md
- 수정 내용: `PostRecordingPipelineProvider` + `enqueue`로 `fetch` URL·JSON body(`text`, `model`) 단언.
- 변경 파일: `src/lib/post-recording-pipeline/__tests__/meeting-minutes-fetch.test.tsx`

### 5. 설정 저장소의 잘못된 회의록 모델 문자열 폴백

- 심각도: MEDIUM (security / implementation)
- 출처: 03(화이트리스트), 구현 일관성
- 수정 내용: `parseTranscriptionSettings`에서 `meetingMinutesModel`이 허용 목록에 없으면 기본값으로 복구.
- 변경 파일: `src/lib/settings/types.ts`, `src/lib/settings/__tests__/types.test.ts`

### 6. 설정 UI와 서버 허용 모델 단일 목록

- 심각도: MEDIUM (architecture)
- 출처: 04_review_architecture.md
- 수정 내용: `MEETING_MINUTES_MODEL_IDS`를 `settings-panel` 옵션 생성에 재사용.
- 변경 파일: `src/lib/settings/types.ts`, `src/components/settings-panel.tsx`

## 미수정 항목 (사유)

- **공개 API에 대한 “인증”(로그인·서명 토큰)**: 제품이 로컬·비로그인 MVP라 STT 토큰 경로와 동일하게 **레이트 리밋 + 서버 상한**으로 1차 완화만 적용. 전용 인증은 별 이슈로 둠.
- **chunk-text 문장 경계 단언 강화·map-reduce 호출 횟수 엄격 검증**: 시간 대비 우선순위를 낮춤. 필요 시 후속 PR.
- **OpenAI 공식 SDK 도입**: `fetch` 유지. DECISIONS 문서화는 후속 가능.

## 수정 후 테스트 결과

- `npm test` 전체 통과(리뷰 반영 후 재실행).
