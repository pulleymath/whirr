---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  subagent_model: "fast"
  feature: "feature-8-ui-refinement"
  review_kind: security
---

# Security & Performance Review

## Summary

UI 전용 변경으로 인증·신규 API·시크릿 노출 경로는 없으며, `dangerouslySetInnerHTML` 등 원시 HTML 삽입도 없다. `decodeURIComponent`는 활성 링크 판별에만 쓰이고 DOM에 그대로 주입되지 않는다. 다만 모바일에서 History drawer를 열면 `SessionList`가 두 인스턴스로 동시에 IndexedDB를 읽을 수 있어 I/O·리렌더 비용이 중복될 수 있다.

## Security Findings

### [LOW] 경로 디코드 값은 비교 전용

- Location: `src/components/session-list.tsx:55-65`, `105`
- Category: input-validation / XSS 인접
- Risk: `pathname`에서 잘라낸 값을 `decodeURIComponent`한 결과는 `s.id`와의 동등 비교와 `Link`의 `encodeURIComponent` 기반 `href`에만 사용된다. React 텍스트 노드·속성 이스케이프가 유지되므로 본 변경만으로 DOM XSS로 이어지지는 않는다. 비정상 인코딩 시 `catch`로 원시 세그먼트를 쓰므로 URIError로의 노출도 제한된다.
- Remediation: 현 상태 유지 가능. 향후 동일 문자열을 `innerHTML`이나 `eval` 계열에 넣지 않도록만 유지하면 된다.

### [LOW] `aria-label`에 미리보기 텍스트 포함

- Location: `src/components/session-list.tsx:119`
- Category: data-handling (노출 범위)
- Risk: XSS는 아니나, 전사 미리보기가 접근성 트리에 포함되어 스크린 리더 사용자에게 그대로 읽힌다. 의도된 UX일 수 있으나, 민감한 녹음 내용이 짧게라도 노출되는 범위를 제품 정책과 맞출 필요는 있다.
- Remediation: 민감도가 높으면 `aria-label`을 시간·고정 문구로 줄이거나, 미리보기 길이·마스킹 정책을 문서화한다.

## Performance Findings

### [MEDIUM] 모바일에서 History 열림 시 세션 목록 이중 로드

- Location: `src/components/home-content.tsx:54-63`, `120-123`
- Category: network / storage (클라이언트 DB)
- Impact: 데스크톱 사이드바용 `SessionList`는 `md` 미만에서도 DOM에 마운트된 채 `hidden`이므로, 모바일에서 drawer를 열면 drawer 안의 두 번째 `SessionList`와 함께 `getAllSessions()`가 각각 실행될 수 있다. 세션 수가 커지면 초기·열림 시점에 IndexedDB 읽기와 그룹핑이 두 배로 든다.
- Remediation: 사이드바 쪽 목록을 뷰포트/레이아웃에 따라 조건부 마운트하거나, 상위에서 한 번 로드한 데이터를 React context·캐시로 두 인스턴스에 공유한다.

### [LOW] Drawer 열림 애니메이션의 중첩 `requestAnimationFrame` 정리

- Location: `src/components/home-content.tsx:32-37`
- Category: memory / rendering
- Impact: `useEffect` 정리 함수는 바깥 `requestAnimationFrame` id만 `cancelAnimationFrame`한다. 아주 짧은 구간에서 언마운트·닫힘과 겹치면 안쪽 프레임 콜백이 스케줄된 뒤 실행될 수 있어, 이론상 언마운트 후 `setState` 경고나 불필요한 한 번의 업데이트가 남을 수 있다.
- Remediation: 플래그(`let alive = true`)로 안쪽 콜백에서 가드하거나, 안쪽 rAF id도 저장해 cleanup에서 함께 취소한다.

### [LOW] 탭 전환 시 패널 언마운트·리마운트

- Location: `src/components/main-transcript-tabs.tsx` (활성 탭에만 자식 렌더)
- Category: rendering
- Impact: 탭을 바꿀 때마다 해당 패널 서브트리가 통째로 내려갔다 올라와, 무거운 자식이 있으면 비용이 커질 수 있다. 현재 전사/요약 UI 규모에서는 보통 허용 범위다.
- Remediation: 필요 시 `display`/`hidden`으로 유지 마운트하고 애니메이션만 토글하는 방식을 검토한다.

### [LOW] 세션 목록 가상화 없음

- Location: `src/components/session-list.tsx:86-135`
- Category: rendering
- Impact: 세션이 매우 많으면 긴 리스트 DOM·스타일 계산이 커진다. 이번 diff의 본질은 스타일·활성 상태이며 구조적 한계는 기존과 유사하다.
- Remediation: 장기적으로 수백 건 이상이 일반적이면 윈도잉·페이지네이션을 고려한다.

## Verdict

PASS_WITH_NOTES
