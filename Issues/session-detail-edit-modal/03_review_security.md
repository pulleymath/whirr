---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  feature: session-detail-edit-modal
  review_kind: security
---

# Security & Performance Review

## Summary

세션 상세·편집 모달 변경은 기존과 동일하게 클라이언트 측 IndexedDB와 회의록 요약 API를 쓰며, 라우트 ID 디코딩·요약 모델 allowlist·빈 컨텍스트 정규화 등 방어적 처리가 유지됩니다. 다만 오류 시 `console.error`로 전체 예외를 남기고, dirty 판별에서 `JSON.stringify`를 매 렌더마다 돌리는 점은 각각 정보 노출·비용 측면에서 개선 여지가 있습니다.

## Security Findings

### [LOW] 브라우저 콘솔에 원문 예외 로깅

- Location: `src/components/session-edit-dialog.tsx:221-223`, `src/components/session-detail.tsx:287-289`
- Category: data-handling
- Risk: 네트워크/IDB 예외 객체에 메시지·스택·응답 조각이 포함되면 개발자 도구에 노출될 수 있으며, 스크립트·회의 맥락 관련 오류면 민감 내용이 섞일 가능성이 있습니다. 사용자 화면에는 일반 문구만 노출됩니다.
- Remediation: `console.error` 대신 짧은 코드/상태만 로깅하거나, 프로덕션 빌드에서는 로깅을 끄거나 Sentry 등으로 필터링된 페이로드만 전송합니다.

### [LOW] 동기 `window.confirm` 기반 이탈 확인

- Location: `src/components/session-edit-dialog.tsx:193-198`
- Category: input-validation (UX/남용 완화)
- Risk: 악성 코드와 무관하나, 확인창은 피싱형 복제와 혼동될 수 있는 패턴입니다. 보안 영향은 제한적입니다.
- Remediation: 장기적으로 인앱 확인 모달로 교체(계획서에도 후속으로 언급됨).

해당 없음: 새로운 서버 입력 검증 우회, SQL/NoSQL 주입, `dangerouslySetInnerHTML` 추가, 클라이언트 번들 시크릿 노출, 의존성 취약점 변경은 diff에서 확인되지 않았습니다.

## Performance Findings

### [MEDIUM] dirty 비교 시 매 렌더 `JSON.stringify`

- Location: `src/components/session-edit-dialog.tsx:50-62`, `348` (`disabled={saving || !isDirty()}`)
- Category: rendering
- Impact: 용어집 배열·템플릿 객체가 클 때 렌더마다 직렬화 비용이 누적됩니다.
- Suggestion: 깊은 비교를 `useMemo`로 스냅샷 해시/참조 안정화하거나, glossary·template 변경 시에만 재계산하는 `useMemo` 기반 `dirty` 플래그로 바꿉니다.

### [LOW] 복사 피드백용 `setTimeout` 언마운트 미정리

- Location: `src/components/session-detail.tsx:227-236`, `239-248`
- Category: memory
- Impact: 빠르게 페이지를 벗어나면 언마운트 후 `setState` 경고 가능성이 있습니다.
- Suggestion: `useRef`로 타이머 ID를 보관하고 effect cleanup 또는 `copyScript`/`copySummaryMarkdown`에서 클리어합니다.

### [LOW] 매우 긴 스크립트 전체 DOM 렌더

- Location: `src/components/session-detail.tsx:475-481`
- Category: rendering
- Impact: 초대형 전사본은 `<pre>` 한 번에 모두 그려져 초기 페인트·스크롤 비용이 커질 수 있습니다(기존 textarea와 유사한 한계).
- Suggestion: 필요 시 가상 스크롤·접기·청크 로딩은 별도 성능 이슈로 검토합니다.

해당 없음: 불필요한 추가 네트워크 폴링, WebSocket 누수, 요약 생성 경로의 이중 `updateSession` 호출은 확인되지 않았습니다(생성 시 부모에서 `persistSessionEditSnapshot` 한 번 후 API 호출).

## Verdict

PASS_WITH_NOTES
