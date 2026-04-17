---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  feature: "feature-18-model-context-ui"
  review_kind: security
---

# Security & Performance Review

## Summary

클라이언트 측 IndexedDB·설정 UI 확장과 회의록 요청 페이로드(`glossary`, `sessionContext`, `model`) 전달이 중심이며, 사용자 노출 오류 메시지는 대체로 일반화되어 있다. 다만 용어/컨텍스트 입력에 대한 크기 제한 부재와, 세션에 저장된 비표준 `minutesModel` 값이 API까지 전달될 수 있는 점은 방어 심층 차원에서 보완 여지가 있다.

## Security Findings

### [LOW] API 오류 본문이 콘솔에 기록될 수 있음

- Location: `src/components/session-detail.tsx` (예: `handleMeetingMinutes`의 `catch` 블록, `handleSaveScript`와 유사 패턴)
- Category: data-handling
- Risk: `fetchMeetingMinutesSummary`가 서버의 `error` 문자열을 `Error` 메시지로 던질 수 있고, `catch`에서 `console.error(e)`로 전체가 개발자 콘솔에 남는다. UI에는 일반 문구만 보이므로 사용자 직접 유출은 낮지만, 공유 기기·스크린 녹화·확장 프로그램 등 환경에서는 내부 메시지가 노출될 수 있다.
- Remediation: 프로덕션에서는 `console.error`를 제거하거나, 로깅 시 메시지를 허용 목록/길이 제한으로 정제한다.

### [MEDIUM] 회의록 모델 ID의 클라이언트만 신뢰

- Location: `src/components/session-minutes-model-select.tsx` (controlled `value`); `src/components/session-detail.tsx` (`minutesModelDraft` → `fetchMeetingMinutesSummary` 두 번째 인자)
- Category: input-validation
- Risk: `SessionMinutesModelSelect`는 옵션 목록이 고정되어 있으나, 초기값이 `session.scriptMeta?.minutesModel` 등 외부(IndexedDB 조작·레거시 데이터)에서 오면 `<select>`의 `value`가 옵션에 없을 수 있다. 브라우저/상태 조합에 따라 표시가 어긋나거나, 다른 경로로 상태가 오염되면 허용되지 않은 `model` 문자열이 `/api/meeting-minutes`로 전달될 수 있다(서버에서 거부하지 않으면 비용·남용 리스크).
- Remediation: 호출 직전에 `MEETING_MINUTES_MODEL_IDS`(또는 동일 allowlist)로 클램프·검증하고, 불일치 시 기본 모델로 되돌린 뒤 세션 `scriptMeta`도 정규화해 저장한다.

### [LOW] 회의 컨텍스트·용어 사전 페이로드 크기 미제한

- Location: `src/components/session-glossary-editor.tsx`; `src/components/session-detail.tsx` (`contextPayload`, `glossaryDraft`)
- Category: input-validation / data-handling
- Risk: 악의적 또는 실수로 매우 큰 문자열/배열을 붙여넣으면 JSON 본문·IndexedDB 레코드가 비대해지고, API/브라우저 메모리에 부담을 줄 수 있다(가용성).
- Remediation: 항목 수·줄 길이·전체 바이트 상한을 두고 UI에서 차단하거나 잘라서 저장·전송한다.

## Performance Findings

### [MEDIUM] 용어 사전 textarea의 매 키입력마다 전 배열 재구성

- Location: `src/components/session-glossary-editor.tsx:31-37`
- Category: rendering / storage
- Impact: `onChange`에서 전체 문자열을 `split`·`map(trim)`·`filter`하여 매 입력마다 부모 상태를 갱신하면, 긴 용어 목록 입력 시 메인 스레드 작업과 리렌더가 잦아진다.
- Suggestion: 로컬 문자열 상태로 두고 `onBlur` 또는 디바운스된 동기화로 `string[]`을 갱신하거나, 최소한 줄 수가 일정 이상일 때만 무거운 변환을 수행한다.

### [LOW] 회의록 생성 시 IndexedDB 연속 쓰기

- Location: `src/components/session-detail.tsx` (`handleMeetingMinutes` 내 `updateSession` → API → `updateSession`)
- Category: storage / network
- Impact: 한 번의 생성 플로우에서 세션 레코드를 두 번 갱신하여 IndexedDB 쓰기가 이중으로 발생한다.
- Suggestion: 실패 시 롤백 요구사항이 없다면, 첫 `updateSession`을 배치 API 성공 후 한 번으로 합치거나(컨텍스트만 먼저 저장해야 하는 제품 요구가 없다면), `summary`와 `context`/`scriptMeta`를 단일 `updateSession`으로 묶는 방식을 검토한다.

### [LOW] `Recorder`의 `persistBatchResult` 등 콜백 의존성 확장

- Location: `src/components/recorder.tsx` (`useCallback` 의존성에 `glossary.terms`, `sessionContext` 등 추가)
- Category: rendering / memory
- Risk: 글로서리 배열 참조가 자주 바뀌면 하위 훅/이펙트가 불필요하게 재구성될 수 있다.
- Suggestion: 안정적인 참조(메모이즈된 스냅샷, 깊은 비교 훅, 또는 enqueue 시점에만 최신값 읽기)로 의존성 폭발을 줄인다.

## Verdict

PASS_WITH_NOTES
