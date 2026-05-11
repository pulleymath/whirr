---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  feature: "session-detail-home-note-ui"
  review_kind: security
---

# Security & Performance Review

## Summary

이번 diff는 UI 재구성(노트 워크스페이스·탭·읽기 전용 제목)과 테스트 보강이 중심이며, 새 네트워크나 비밀 노출은 없습니다. 마크다운은 `react-markdown` 기본 경로로 raw HTML 삽입 위험은 낮지만, 링크 `href`에 대한 프로토콜 제한이 없어 악성 `javascript:` 등은 기존과 동일하게 잠재 이슈로 남습니다.

## Security Findings

### [MEDIUM] 마크다운 링크의 임의 `href`(예: `javascript:`)

- Location: `src/components/meeting-minutes-markdown.tsx` (커스텀 `a` 컴포넌트)
- Category: XSS(클릭 시 스크립트 실행)
- Risk: 요약 본문이 사용자·모델 출력이므로 `[표시](javascript:...)` 형태가 렌더되면 클릭 시 스크립트 실행 등으로 이어질 수 있음.
- Remediation: `http:`/`https:` 등 화이트리스트만 허용하거나 rehype sanitize.

### [LOW] 클립보드 API 실패 시 무음 처리

- Location: `session-detail.tsx` (`copyScript`, `copySummaryMarkdown`)
- Risk: 정보 유출은 아님; UX 개선 여지.

### 확인됨

- 비밀/API 키 추가 없음.
- ZIP: `downloadRecordingZip`에 파일명 정규화 기존 유지.

## Performance Findings

### [LOW] 인라인 `ReactNode` 매 렌더

- `summaryPanelContent` 등 — 필요 시 `useMemo`로 안정화 가능. 세션 상세에서는 보통 무시 가능.

### [LOW] 긴 요약 마크다운 전체 파싱

- 기존과 동일; 탭 내 `overflow-y-auto`는 도움.

## Verdict

**PASS_WITH_NOTES** — 치명적 신규 노출 없음. 링크 `href` 화이트리스트는 제품 차원 후속 과제(이번 브랜치 전부터 존재하는 패턴 재확인).
