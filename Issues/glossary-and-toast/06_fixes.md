# 리뷰 반영 수정 기록

## 수정 항목

### 1. glossary 항목별 최대 길이 검증 (보안·성능 M3/M5)

- 심각도: MEDIUM
- 출처: `03_review_security.md`, `05_review_synthesis.md`
- 수정 내용: `MEETING_MINUTES_MAX_GLOSSARY_TERM_LENGTH`(500자) 상수 추가, `parseGlossary`에서 항목 길이 초과 시 `400` 및 `glossary item too long` 응답.
- 변경 파일: `src/lib/api/meeting-minutes-api-constants.ts`, `src/app/api/meeting-minutes/route.ts`

### 2. API route 테스트 보강 (구현 M1)

- 심각도: MEDIUM
- 출처: `02_review_implementation.md`, `05_review_synthesis.md`
- 수정 내용: `sessionContext.topic` / `sessionContext.keywords` 필드 2000자 초과 시 400 테스트, glossary 항목 길이 초과 테스트 추가.
- 변경 파일: `src/app/api/meeting-minutes/__tests__/route.test.ts`

### 3. PipelineToastNotifier 마운트 시 done 엣지 테스트 (구현 LOW)

- 심각도: LOW
- 출처: `02_review_implementation.md`
- 수정 내용: 최초 렌더부터 `phase="done"`이면 `toast.success`가 호출되지 않음을 단언.
- 변경 파일: `src/components/__tests__/pipeline-toast-notifier.test.tsx`

## 미수정 항목 (사유 포함)

| 항목                                        | 사유                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| M2 Recorder UI 통합 테스트                  | 범위·시간상 후속 PR로 분리 (enqueue 필드·단위 테스트로 핵심 동작은 검증됨).                                               |
| M4 프롬프트 주입 완화(구조화·필터)          | 제품 기능과 직결된 설계 판단으로 별도 이슈에서 다룸.                                                                      |
| M6 설정 패널 용어 debounce                  | UX 개선으로 MEDIUM이나 필수 게이트는 아님.                                                                                |
| M7/M8 문서·`useRouter` vs `location.assign` | Vitest 환경에서 `useRouter` 없이도 안정 동작하도록 `location.assign`을 채택한 트레이드오프; 문서 동기화는 사용자 요청 시. |
| Session 타입 분리·로깅 축소 등 LOW          | 후속.                                                                                                                     |

## 수정 후 테스트 결과

`npm test` 전체 통과(실행 시점 기준).
