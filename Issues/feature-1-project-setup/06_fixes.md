# 리뷰 반영 수정 기록

## 수정 항목

### 1. Vitest 설정 테스트의 자명한 단언 제거

- 심각도: MEDIUM
- 출처: 02 (implementation)
- 수정 내용: `expect(true).toBe(true)`를 `describe`/`it` 함수 존재 검증으로 교체하여 테스트가 실제 런타임 동작을 검증하도록 함.
- 변경 파일: `src/__tests__/setup.test.ts`

## 미수정 항목 (사유 포함)

| 항목 | 사유 |
| --- | --- |
| `tsconfig`에 `vitest/globals` 추가 | 테스트 파일에서 `vitest` 명시 import를 사용 중이며 Next와의 `types` 배열 충돌을 피하기 위해 생략. |
| ARCHITECTURE §7 전체 파일 트리 | Feature 1 범위는 프로젝트 셋업 및 STT 타입 정의까지이며, API·AssemblyAI 구현 등은 이후 이슈에서 진행. |
| `@/lib/stt` import 통일 | LOW; 후속 스타일 PR에서 정리 가능. |

## 수정 후 테스트 결과

`npm test` 전부 통과 (14 tests).
