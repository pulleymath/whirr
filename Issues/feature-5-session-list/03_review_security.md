---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  feature: "feature-5-session-list"
  review_kind: security
---

# Security & Performance Review

## Summary

클라이언트 전용 IndexedDB·React 기본 이스케이프로 XSS·시크릿 유출 위험은 낮습니다. 동적 `id`를 DB 조회에 그대로 쓰는 부분은 로컬 앱 맥락에서는 허용 가능하나, URL/키 이스케이프·비정상 문자에 대한 방어는 없습니다. 성능은 세션 수가 적을 때는 무난하고, 홈에서 `refresh` 시 `Recorder`까지 함께 리렌더될 수 있습니다.

## Security Findings

### [LOW] 동적 라우트 `id` 검증·정규화 없음

- Location: `src/components/session-detail.tsx`, `src/components/session-list.tsx`
- Category: input-validation
- Risk: `id`에 특수 문자·매우 긴 문자열 등이 들어가면 라우팅·링크 동작이 어색해질 수 있음.
- Remediation: 허용 패턴(정규식)으로 `id` 검증; 링크는 `encodeURIComponent(s.id)` 검토.

### [LOW] IndexedDB 조회 실패 시 사용자에게 원인 구분 없음

- Location: `src/components/session-detail.tsx` (`catch` → `setSession(null)`)
- Category: data-handling
- Risk: “없음”과 “읽기 오류”가 동일 UI.

### [정보] 전사 본문·미리보기 렌더링

- Location: `session-detail.tsx`, `session-list.tsx`
- Category: XSS
- Risk: `dangerouslySetInnerHTML` 미사용으로 XSS 표면 낮음.

## Performance Findings

### [MEDIUM] 저장 후 목록 갱신 시 홈 클라이언트 전체 리렌더

- Location: `src/components/home-content.tsx`
- Category: rendering
- Impact: `sessionRefresh` 증가 시 `HomeContent` 전체가 리렌더되어 `Recorder`도 함께 다시 렌더됩니다.
- Suggestion: `Recorder`를 `React.memo`로 감싸거나 목록만 별도 래퍼로 분리.

### [LOW] 목록이 전량 로드·그룹 렌더 (가상화·페이지네이션 없음)

- Location: `src/components/session-list.tsx`
- Category: storage / rendering

### [정보] 비동기 effect 취소 플래그

- Location: `session-detail.tsx`, `session-list.tsx`
- Category: memory

## Verdict

**PASS_WITH_NOTES**
