# AI 회의록 — 작업 요약

## 구현된 기능

- 녹음 종료 후 전사가 준비되면 `/api/meeting-minutes`로 회의록 생성(기본 모델 `gpt-5.4-nano`).
- 설정에 **회의록 작성 모델** 선택(일괄 전사 모델과 동일한 저장 패턴).
- 장문 전사는 청크 분할 → 구간별 정리(map) → 최종 합성(reduce)으로 중간 누락을 줄임.

## 주요 파일

- `src/lib/meeting-minutes/*` — 청크, map-reduce, 프롬프트
- `src/app/api/meeting-minutes/route.ts` — 서버에서 OpenAI Chat Completions 호출; 키 없으면 비프로덕션 Mock
- `src/lib/post-recording-pipeline/context.tsx` — `/api/summarize` 대신 회의록 API 호출, 길이 상한 제거

## 테스트

- 청크·map-reduce·API 라우트·설정·UI 문자열·Recorder enqueue 연동

## 알려진 제한

- 실제 배포 시 `gpt-5.4-nano`가 OpenAI에 없으면 설정에서 다른 모델로 바꿔야 함.

## 리뷰 산출물

- `02_review_implementation.md` ~ `05_review_synthesis.md`, 반영 기록 `06_fixes.md` 참고.
