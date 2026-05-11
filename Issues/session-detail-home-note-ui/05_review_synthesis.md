---
issue_driven_dev:
  source: subagent
  phase: synthesis
  subagent_type: generalPurpose
  feature: "session-detail-home-note-ui"
---

# Review Synthesis

## Overall Quality Score

**B** — 계획 대비 구현·테스트 정합성이 높고 병합 차단 이슈는 없음. 타입 스멜(`titleReadOnly`+noop)과 기존 마크다운 링크 정책은 후속 정리 권장.

## Executive Summary

구현·보안·아키텍처 리뷰 모두 **PASS_WITH_NOTES**이다. 세션 상세 UI 정렬 목표는 달성되었고 회귀 테스트가 보강되었다. 즉시 수정이 필요한 CRITICAL/HIGH는 없다. 다중 리뷰에서 공통으로 드러난 개선은 **`titleReadOnly`일 때 `onNoteTitleChange`를 타입으로 불필요하게 만드는 판별 유니온**과, 보안 측면의 **`MeetingMinutesMarkdown` 링크 `href` 화이트리스트**(이번 diff 이전부터 존재하는 패턴) 정리이다.

## Consolidated Findings

### Immediate Fixes Required (CRITICAL/HIGH)

없음.

### Recommended Improvements (MEDIUM)

| #   | Finding                                            | Source                       | Category                |
| --- | -------------------------------------------------- | ---------------------------- | ----------------------- |
| 1   | `titleReadOnly`일 때 필수 `onNoteTitleChange` noop | implementation, architecture | API·타입 설계           |
| 2   | 마크다운 링크 임의 `href`(javascript: 등)          | security                     | XSS 완화(기존 컴포넌트) |

#### 1. titleReadOnly + noop 핸들러

- Adjusted severity: **MEDIUM** (유지보수·타입 정확성)
- Action: 후속 PR에서 props를 판별 유니온으로 분리하거나 `titleReadOnly` 시 `onNoteTitleChange` optional 처리.

#### 2. MeetingMinutesMarkdown 링크

- Adjusted severity: **MEDIUM** (범위는 본 이슈 비목표; 제품 전반 후속)
- Action: `http`/`https` 등 화이트리스트 또는 sanitize 플러그인.

### Optional Enhancements (LOW)

- `pipelineBusy`가 홈(파이프라인) vs 상세(요약 생성)에서 의미가 다름 → 주석 한 줄.
- `summaryPanelContent` 인라인 JSX → 필요 시 `useMemo`.
- `session-context-input` testid와 워크스페이스 래퍼 혼동 가능성 → 네이밍 정리.
- 클립보드 실패 시 사용자 피드백.

## Cross-Domain Observations

- 구현·아키텍처가 동일하게 `onNoteTitleChange` noop을 지적 → 후속 타입 개선 우선순위 상향.
- 보안 MEDIUM은 본 브랜치 신규 취약점이라기보다 요약 마크다운 노출 경로에서의 **기존 위험 재확인**에 가깝다.

## Deduplicated Items

- `titleReadOnly`/noop: implementation + architecture → 단일 MEDIUM 항목으로 통합.

## Final Action Plan

1. **이 브랜치**: 병합 가능(CRITICAL/HIGH 없음).
2. **다음 스프린트(선택)**: (M1) 판별 유니온, (M2) 마크다운 링크 정책.
3. **LOW**: 여유 시 순차 적용.

## Merge Readiness

**APPROVE** — 본 이슈 범위 내 즉시 수정 없이 main 병합 가능.
