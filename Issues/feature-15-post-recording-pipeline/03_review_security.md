---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  feature: "feature-15-post-recording-pipeline"
  review_kind: security
---

# Security & Performance Review

## Summary

클라이언트 측 IndexedDB·동일 출처 API 호출 위주로 설계가 단순하고, 민감 비밀은 새 엔드포인트에 노출되지 않습니다. 다만 **`POST /api/summarize`에 본문 길이·요청 빈도 제한이 없어**, 공개 배포 시 DoS·비용 남용 여지가 있으며(현재는 목 구현이라 영향은 제한적), 이후 실제 LLM 연동 시 **필수 완화**로 보입니다.

## Security Findings

### [MEDIUM] `/api/summarize` 입력 길이·페이로드 크기 미검증

- Location: `src/app/api/summarize/route.ts` (전체), 클라이언트: `src/lib/post-recording-pipeline/context.tsx` (예: `fetch` 본문)
- Category: input-validation
- Risk: `text`에 대한 최대 길이·바이트 상한이 없어, 악의적 또는 실수로 매우 큰 JSON 본문을 내면 서버 메모리·CPU(향후 실제 요약 모델 연결 시 비용) 부담이 커질 수 있습니다. 인증/세션 없이 호출 가능한 공개 엔드포인트라면 남용에 취약합니다.
- Remediation: 서버에서 `text.length` 또는 UTF-8 바이트 수 상한(예: 수만~수십만 자 수준으로 제품 정책 반영)을 두고 초과 시 413/400; 가능하면 **레이트 리밋**(IP·세션·토큰 기준)과 **요약 전용 비용 상한**을 함께 두는 것이 좋습니다.

### [LOW] 파이프라인 예외 시 `console.error`로 원시 에러 로깅

- Location: `src/lib/post-recording-pipeline/context.tsx` (대략 `catch` 블록)
- Category: data-handling
- Risk: 프로덕션에서 스택·내부 메시지가 콘솔/수집기로 넘어갈 수 있어, 디버깅에는 유리하나 민감한 사용자 텍스트와 함께 묶일 수 있습니다.
- Remediation: 사용자에게는 이미 일반 문구만 노출하므로, 로깅은 짧은 코드/상태만 남기거나 PII 최소화 정책에 맞게 조정합니다.

### [LOW] `updateSession` 실패 시 에러 메시지에 세션 ID 포함

- Location: `src/lib/db.ts` (`Session not found: ${id}`)
- Category: data-handling
- Risk: 클라이언트 전용이며 ID는 이미 클라이언트가 알고 있는 값이라 침해는 제한적이나, 오류가 UI까지 노출되면 불필요한 식별자 노출이 될 수 있습니다.
- Remediation: 사용자 노출 문구와 개발자용 메시지를 분리하거나, ID 없이 일반화합니다.

## Performance Findings

### [MEDIUM] 요약 API의 인위적 지연

- Location: `src/app/api/summarize/route.ts` (`setTimeout(..., 200)`)
- Category: network
- Impact: 매 요약마다 최소 200ms가 추가되어, 파이프라인 완료 체감 시간이 불필요하게 늘어납니다. 목(mock)용이라도 프로덕션 플래그에서는 제거하는 편이 낫습니다.
- Suggestion: 지연 제거 또는 개발 전용으로 가드.

### [LOW] 파이프라인에서 전체 전사 문자열을 한 번에 JSON으로 전송

- Location: `src/lib/post-recording-pipeline/context.tsx` (`JSON.stringify({ text: fullText })`)
- Category: network / memory
- Impact: 매우 긴 녹음·전사에서 요청 본문이 커지고, 직렬화·전송 비용이 커집니다. 로컬 앱 한계 내에서는 허용 가능하나, 상한과 청크/스트리밍 전략은 장기적으로 검토 대상입니다.
- Suggestion: 서버 `text` 상한과 맞추고, 필요 시 세그먼트 요약 또는 스트리밍 API로 전환합니다.

### [LOW] IndexedDB `updateSession` 호출이 단계마다 반복

- Location: `src/lib/post-recording-pipeline/context.tsx` (전사 후, 요약 전/후 등)
- Category: storage
- Impact: 동일 세션에 대한 쓰기가 여러 번 발생합니다. 로컬 DB라 치명적이지 않으나, 고빈도 시 디스크/메인 스레드 부담이 늘 수 있습니다.
- Suggestion: 상태 전이를 묶을 수 있으면 배치하거나, 쓰기 횟수를 줄이는 쪽으로 최적화합니다(기능 요구와 트레이드오프 확인).

### [LOW] 배치 모드 메모리(기존 이슈와 정합)

- Location: `use-batch-transcription` + 오디오 Blob 유지
- Category: memory
- Impact: 장시간 녹음 시 세그먼트 Blob이 메모리에 남습니다. 이번 diff는 흐름만 바꾼 수준이며, 문서에 적힌 한계와 동일합니다.
- Suggestion: 중간 플러시·해제는 별도 개선 이슈로 유지합니다.

## Verdict

**PASS_WITH_NOTES** — 클라이언트·서버 경계와 비밀 노출 측면에서는 양호합니다. 공개 환경·실제 요약 연동을 전제로 하면 **`/api/summarize`의 본문 상한·(가능하면) 레이트 리밋**을 반드시 보강하고, 목 지연 제거로 응답 시간을 정리하는 것을 권장합니다.
