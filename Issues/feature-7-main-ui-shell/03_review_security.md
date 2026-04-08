---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  subagent_model: "Composer"
  feature: "feature-7-main-ui-shell"
  review_kind: security
---

# Security & Performance Review

## Summary

UI 셸·drawer·탭 변경은 새로운 서버 경로·클라이언트 비밀 노출·XSS 직접 유발 패턴이 없고, 위험도는 낮습니다. 다만 렌더 중 `setState`로 pathname을 동기화하는 방식과 숨겨진 탭 패널이 전사 DOM을 유지하는 점은 성능·안정성 측면에서 개선 여지가 있습니다.

## Security Findings

### [LOW] 세션 저장 실패 시 `console.error`에 원본 예외 객체 로깅

- Location: `src/components/recorder.tsx` (저장 `catch` 블록, `console.error("[session-storage] save failed:", e)`)
- Category: data-handling
- Risk: 브라우저 개발자 도구에 스택·내부 메시지가 노출될 수 있어, 디버깅 정보 과다 노출(로컬·단일 사용자 앱이면 영향은 제한적).
- Remediation: 사용자에게는 이미 일반화된 `setSummaryError` 문자열만 쓰고, 로깅 시 `String(e)` 또는 `e instanceof Error ? e.message : "unknown"`처럼 최소 필드만 남기거나, 프로덕션에서는 구조화 로깅 정책에 맞게 축약.

## Performance Findings

### [MEDIUM] 비활성 탭에서도 전사 패널이 마운트·갱신됨

- Location: `src/components/main-transcript-tabs.tsx` (두 `role="tabpanel"` 모두 자식 유지), `src/components/recorder.tsx`에서 `TranscriptView`가 항상 `MainTranscriptTabs`의 transcript 슬롯에 전달됨
- Category: rendering
- Impact: 「요약」 탭 선택 시에도 `finals`/`partial` 갱신이 숨겨진 패널까지 내려가 DOM·diff 비용이 계속 듦. 전사 문장이 길어질수록 비용 증가.
- Remediation: 비활성 탭일 때 transcript 슬롯을 `null`로 두거나 조건부 마운트(탭 전환 시에만 `TranscriptView` 마운트). 스크롤 위치·포커스 요구사항과 트레이드오프 확인 후 선택.

### [LOW] pathname 변경 시 렌더 본문에서 `setState` 연쇄

- Location: `src/components/home-page-shell.tsx` (`pathname !== pathnameSeen` 분기에서 `setPathnameSeen` / `setDrawerOpen`)
- Category: rendering
- Impact: 경로가 바뀔 때마다 동기 렌더에서 추가 상태 갱신으로 한 번 더 그리기가 이어질 수 있음. React에서 허용되는 패턴이지만, Strict Mode·향후 리액트 버전에서 경고·동작 변화에 취약할 수 있음.
- Remediation: `useEffect(() => { setPathnameSeen(pathname); setDrawerOpen(false); }, [pathname])`로 분리하거나, drawer 열림을 URL/searchParams와 동기화하지 않는 한 `useRef`로 이전 pathname만 추적해 effect에서만 닫기.

## Verdict

PASS_WITH_NOTES
