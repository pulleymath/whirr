---
issue_driven_dev:
  source: subagent
  phase: synthesis
  subagent_type: generalPurpose
  feature: "feature-18-model-context-ui"
---

# Review Synthesis

## Overall Quality Score

**B** — 기능·데이터 모델·파이프라인 연동은 완결되었고 품질 게이트(tsc/eslint/prettier/test/build)를 통과했으나, 계획 대비 테스트·검증 단언이 부족하고 레거시 세션의 `minutesModel` 영속 등 소수 제품/방어 이슈가 남는다.

## Executive Summary

구현·보안·아키텍처 리뷰가 공통으로 지적한 핵심은 **계획서에 명시된 TDD 산출물(여러 전용 테스트 파일)이 누락**되었다는 점이다. 런타임 위험은 대부분 LOW~MEDIUM이며 서버 측 화이트리스트가 있으면 완화되는 클라이언트 신뢰 이슈가 상대적으로 크다. 구조적으로는 `session-detail` 응집도와 `sessionContext` 정규화 중복이 후속 리팩터링 후보다.

## Consolidated Findings

### Immediate Fixes Required (CRITICAL/HIGH)

| #   | Finding                                                                                                                                                             | Source         | Severity | Category    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------- | ----------- |
| 1   | 계획된 신규·통합 테스트 파일 다수 미작성 (`model-quick-panel`, `session-script-meta-display`, `session-detail-context-editor`, `session-detail-regenerate-flow` 등) | implementation | HIGH     | 테스트/회귀 |

#### 1. 테스트 세트 미달

- Original severity: HIGH (implementation)
- Adjusted severity: HIGH
- Location: `src/components/__tests__/` (누락 파일들), `home-page-shell.test.tsx` (계획 Step 4 일부 미이행)
- Action: 계획서 Step 3·5·6·9에 맞춰 최소 스모크·통합 테스트 추가. 기존 `session-detail.test.tsx`는 `fetchMeetingMinutesSummary` 4번째 인자와 `updateSession` 선행 저장을 더 엄격히 단언한다.

### Recommended Improvements (MEDIUM)

| #   | Finding                                                                  | Source         | Category  |
| --- | ------------------------------------------------------------------------ | -------------- | --------- |
| 2   | `db.test.ts`에 레거시 `scriptMeta` 부재·DB 버전 단언 보강                | implementation | 테스트    |
| 3   | `recorder-session-storage`에서 `scriptMeta.mode` 등 구체 값 고정         | implementation | 테스트    |
| 4   | 회의록 모델 ID 클라이언트 검증/클램프 (`isAllowedMeetingMinutesModelId`) | security       | 입력 검증 |
| 5   | 용어 사전 `onChange` 비용(디바운스·blur 동기화)                          | security       | 성능      |
| 6   | `session-detail` 편집·API 오케스트레이션 훅 분리                         | architecture   | 구조      |
| 7   | `sessionContextForEnqueue` / `sessionContextForApi` 공용 유틸 통합       | architecture   | 중복 제거 |

### Optional Enhancements (LOW)

- `console.error` 정제(프로덕션), 페이로드 크기 상한, IndexedDB 이중 `updateSession` 병합 검토
- `formatScriptMetaLine` 카피를 완료 조건 문구와 정렬
- 레거시 세션에서 `minutesModel`을 `scriptMeta`에 영구 반영할지 제품 정책 결정
- `Recorder`/`HomePageShell` `max-w` 책임 단일화, `ModelQuickPanel` import 정렬

## Cross-Domain Observations

- **테스트 부채**가 구현 리뷰의 HIGH와 계획 준수의 중심 이슈다.
- **클라이언트 입력 신뢰**(minutes 모델)는 보안 MEDIUM과 제품 데이터 정합성(레거시 `scriptMeta` 없음)이 맞닿아 있다.

## Deduplicated Items

- “세션 상세 복잡도”는 구현(테스트 어려움)·아키텍처(응집도) 양쪽에서 관련 언급 → 훅 분리·테스트로 한 번에 완화.

## Action Plan

1. **(HIGH)** 누락된 테스트 파일 최소 세트 추가 및 기존 단언 강화.
2. **(MEDIUM)** `fetchMeetingMinutesSummary` 호출 전 `minutesModel` allowlist 클램프.
3. **(MEDIUM·후속)** `session-detail` 훅 추출 + glossary 에디터 디바운스.
4. **(LOW)** 문서/카피·레거시 `scriptMeta` 정책 정리.

## Final Verdict

**조건부 승인 (PASS_WITH_NOTES)** — 머지 가능하나 HIGH 테스트 보강을 최우선 후속으로 권장한다.
