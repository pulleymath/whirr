---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  feature: "recorder-recording-phased-ui"
  review_kind: security
---

# Security & Performance Review

## Summary

이번 diff는 클라이언트 UI 가시성·CSS 전환과 테스트·이슈 문서 추가로, 새로운 인증·비밀 노출·서버 입력 경로는 없습니다. 성능은 자식을 항상 마운트하며, `filter`/blur 전환으로 인한 짧은 구간의 GPU 비용만 고려하면 됩니다.

## Security Findings

### [LOW] `aria-hidden`과 포커스 가능 자손의 불일치 가능성

- Location: `src/components/recorder.tsx` (`RevealSection`)
- Category: data-handling
- Risk: 래퍼에 `aria-hidden={true}`가 있어도 자식 입력 등이 이론상 포커스를 받으면 보조공학과 실제 포커스 순서가 어긋날 수 있습니다.
- Remediation: 숨김 시 `inert` 속성 지원 범위 내 사용 등을 검토합니다.

### [LOW] 전사/오류 문자열의 DOM 잔존

- Location: `src/components/recorder.tsx` (`TranscriptView`에 전달되는 props)
- Category: data-handling
- Risk: 시각적으로 접힌 상태에서도 자식이 마운트된 채로 props가 갱신됩니다. 이전 구조와 유사해 새 유출 경로는 아닙니다.
- Remediation: 민감도가 높은 시나리오라면 조건부 언마운트를 검토합니다.

## Performance Findings

### [LOW] `opacity`·`transform`·`filter`(blur) 동시 전환

- Location: `src/components/recorder.tsx` (`RevealSection` className)
- Category: rendering
- Impact: `filter: blur()`는 전환 구간에 합성 레이어 비용이 있을 수 있습니다.
- Suggestion: 이슈가 보이면 blur를 줄이거나 전환 속성을 `opacity`+`transform`만으로 제한합니다.

### [LOW] 숨김에도 `SessionContextInput`·`TranscriptView` 항상 마운트

- Location: `src/components/recorder.tsx`
- Category: rendering / memory
- Impact: 등장 애니메이션을 위한 의도된 패턴입니다.
- Suggestion: 병목이면 `React.memo` 등은 별도 측정 후 적용합니다.

## Verdict

PASS_WITH_NOTES
