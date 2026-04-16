---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  feature: "glossary-and-toast"
  review_kind: security
---

# Security & Performance Review

## Summary

입력 검증·비밀 노출·XSS 측면에서는 큰 문제가 없으나, `glossary` 항목별 길이 상한이 없어 요청 페이로드·LLM 비용·지연에 대한 남용 여지가 있고, 설정 패널의 용어 사전은 입력마다 `localStorage`에 동기 쓰기가 발생합니다. 전반적으로 **수정 권고 수준의 메모와 함께 통과**로 볼 수 있습니다.

## Security Findings

### [MEDIUM] glossary 항목별 길이·총량 상한 없음

- Location: `src/app/api/meeting-minutes/route.ts` (`parseGlossary`, 약 23–41행)
- Category: input-validation
- Risk: 항목 수는 200으로 제한되지만, 각 문자열 길이는 검사하지 않습니다. 악의적 클라이언트는 200개 항목에 매우 긴 문자열을 넣어 본문(`text`) 한도와 별도로 메모리·직렬화 비용을 키우고, 이후 LLM 호출 비용·지연을 유발할 수 있습니다(기존 레이트 리밋이 있어도 “합법적” 범위 내 남용 가능).
- Remediation: 항목당 최대 길이(예: 수백~수천 자)와 필요 시 `glossary` 전체 합계 상한을 두고 400/413으로 거절합니다.

### [MEDIUM] 사용자 입력이 시스템 프롬프트에 그대로 합성됨(간접 프롬프트 주입)

- Location: `src/lib/meeting-minutes/prompts.ts` (`buildSystemPromptWithContext`, 약 12–56행), API는 `src/app/api/meeting-minutes/route.ts`에서 해당 컨텍스트를 전달
- Category: data-handling
- Risk: 용어·세션 컨텍스트가 시스템 메시지에 삽입되므로, 의도적으로 “지시를 무시하라”는 식의 텍스트가 포함되면 모델 동작에 영향을 줄 수 있습니다. 이는 기능 요구와 맞닿은 위험이며, 공개·무인증 API라면 악용 여지가 더 큽니다.
- Remediation: 구분자/구조화(예: XML 블록), 금지 패턴 필터, 서버 측 길이·행 수 제한 강화, 모델 호출 전 로깅 정책 검토(요청 본문 전체 로깅 금지) 등을 고려합니다.

### [LOW] 오류 처리 시 서버 로그에 예외 전체 출력

- Location: `src/app/api/meeting-minutes/route.ts` (약 157–158행), `src/lib/post-recording-pipeline/context.tsx` (약 210행)
- Category: data-handling
- Risk: `console.error`에 예외 객체가 그대로 들어가 운영 로그에 스택·내부 정보가 남을 수 있습니다. 요청 본문은 직접 로깅하지 않는 한 치명적이지 않으나, 운영 환경에서는 민감도에 따라 최소화하는 편이 좋습니다.
- Remediation: 사용자에게는 일반 메시지만 반환(현재 유지), 서버 로그는 메시지 코드·상관 ID 위주로 줄이거나, PII 규칙에 맞게 마스킹합니다.

## Performance Findings

### [MEDIUM] 전역 용어 사전 textarea — 입력마다 localStorage + 상태 갱신

- Location: `src/components/settings-panel.tsx` (약 302–309행), `src/lib/glossary/context.tsx` (`updateGlossary`, 약 55–63행)
- Category: storage / rendering
- Impact: 긴 목록을 편집할 때 키 입력마다 `setState`와 `localStorage.setItem`이 실행되어 메인 스레드와 디스크 I/O가 잦아질 수 있습니다.
- Suggestion: 로컬 state로 편집 후 `onBlur`/`debounce`로 `updateGlossary` 호출하거나, 저장 버튼으로 배치 저장합니다.

### [LOW] glossary 항목 길이 무제한에 따른 프롬프트·토큰 부담

- Location: API `parseGlossary` + `buildSystemPromptWithContext`
- Category: network / memory
- Impact: 서버·모델이 처리하는 시스템 프롬프트 길이가 불필요하게 커질 수 있습니다.
- Suggestion: 위 보안 항목과 동일하게 항목별·전체 길이 상한을 두면 성능과 비용도 함께 한정됩니다.

## Verdict

PASS_WITH_NOTES
