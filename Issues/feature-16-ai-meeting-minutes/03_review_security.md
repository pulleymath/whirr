---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  feature: "feature-16-ai-meeting-minutes"
  review_kind: security
---

# Security & Performance Review

## Summary

`OPENAI_API_KEY`는 서버 전용으로 유지되고 클라이언트로 노출되지 않으며, API 오류 시 사용자에게는 일반화된 메시지를 반환합니다. 다만 `/api/meeting-minutes`는 **인증·레이트 리밋·요청 본문/텍스트 상한이 없고**, map 단계의 **무제한 병렬 `Promise.all`**로 긴 전사에 대해 비용·레이트리밋·서버 부하가 동시에 터질 수 있어 **운영 비용·남용(Abuse) 관점에서 HIGH에 가까운 리스크**가 있습니다.

## Security Findings

### [HIGH] 인증 없는 OpenAI 프록시 — 크레딧 소진·남용

- Location: `src/app/api/meeting-minutes/route.ts` (POST 핸들러 전반)
- Category: auth
- Risk: 배포 URL에 접근 가능한 누구나 `POST /api/meeting-minutes`로 전사 본문을 보내 프로젝트의 `OPENAI_API_KEY`로 Chat Completions를 소비할 수 있습니다. 세션·API 키·IP 기반 제한이 없으면 **크레딧 고갈, 악의적 트래픽**에 취약합니다.
- Remediation: 최소한 **동일 출처·세션 기반 검증**(예: 로그인 사용자만, 또는 서명된 일회용 토큰), **레이트 리밋**(IP/사용자/전역), 필요 시 **Vercel/엣지 방화벽** 또는 별도 게이트웨이를 도입합니다. 앱이 로컬 전용이라면 문서화된 제약이라도 명시합니다.

### [HIGH] 입력 크기·청크 수 제한 없음 — DoS·비용 폭증

- Location: `src/app/api/meeting-minutes/route.ts` (trim 후 길이 상한 없음), `src/lib/post-recording-pipeline/context.tsx` (이전 `SUMMARIZE_MAX_TEXT_LENGTH` 제거)
- Category: input-validation
- Risk: 매우 큰 `text`는 메모리·JSON 파싱·청크 개수를 키워 **서버 리소스 고갈**과 **다수의 병렬 외부 API 호출**로 이어질 수 있습니다. 파이프라인에서 클라이언트 측 길이 제한을 제거했으므로 서버 측 상한이 더 중요해졌습니다.
- Remediation: **최대 문자 수(또는 바이트)** 상한을 두고 413/400으로 거절하고, map 단계 **동시 요청 수 상한(배치/큐)** 또는 **순차·소규모 병렬**로 제한합니다.

### [MEDIUM] `model` 파라미터 무검증 — 비용·정책 우회

- Location: `src/app/api/meeting-minutes/route.ts`
- Category: input-validation / auth
- Risk: 클라이언트가 임의의 `model` 문자열을 보낼 수 있으면(개발자 도구 등) **허용 목록 밖의 고가 모델**이나 오타로 인한 반복 실패·비정상 비용이 발생할 수 있습니다.
- Remediation: 서버에서 **허용 모델 ID 화이트리스트**만 통과시키고, 그 외는 기본 모델로 대체하거나 400을 반환합니다(설정 UI 옵션과 일치).

### [LOW] 서버 로그에 상세 오류 노출 가능성

- Location: `src/app/api/meeting-minutes/route.ts`, `src/lib/meeting-minutes/map-reduce.ts`
- Category: data-handling
- Risk: `console.error` 및 OpenAI `errText` 포함 예외는 **로그 수집기**에 스택·업스트림 본문 일부가 남을 수 있습니다. 사용자 응답은 일반화되어 있어 괜찮으나, 운영 환경에서는 민감도에 따라 로그 레벨/마스킹을 검토합니다.
- Remediation: 프로덕션에서는 에러 코드만 로깅하거나 메시지 길이를 제한합니다.

### [LOW] 비프로덕션 mock 분기의 동작(지연·스니펫)

- Location: `src/app/api/meeting-minutes/route.ts`
- Category: data-handling
- Risk: `OPENAI_API_KEY`가 없을 때 200ms 지연과 입력 앞 100자를 mock 응답에 포함합니다. 프로덕션에서는 503/mock이 아니라 분기되므로 **의도된 환경 분리**만 확인하면 됩니다. 로컬/스테이징에서만 노출되는 전사 일부는 여전히 **데모 데이터 취급**이 필요합니다.
- Remediation: 스테이징에 키를 두거나 mock을 테스트 전용으로 제한합니다.

## Performance Findings

### [HIGH] map 단계 무제한 병렬 — 외부 API·메모리·동시성 폭주

- Location: `src/lib/meeting-minutes/map-reduce.ts` (`Promise.all` + `chunks.map`)
- Category: network / memory
- Impact: 청크 수가 K이면 **동시에 K번** Chat Completions를 호출합니다. 긴 녹음 전사는 K가 수십 이상이 될 수 있어 **OpenAI 레이트 리밋**, **서버 동시 fetch 수**, **함수 타임아웃**에 걸리기 쉽고 비용도 선형 이상으로 늘 수 있습니다.
- Suggestion: **`p-limit` 등으로 동시성 상한(예: 2~5)**을 두거나 청크를 순차 처리하고, 필요하면 배치 크기를 조절합니다. 재시도·백오프는 별도 정책과 함께 고려합니다.

### [MEDIUM] 요청 본문 전체를 메모리에 적재

- Location: `src/app/api/meeting-minutes/route.ts` (`await request.json()`)
- Category: memory
- Risk: Next.js/런타임의 기본 body 크기 제한에 의존합니다. 명시적 상한이 없으면 **큰 JSON 한 번**으로 피크 메모리 사용이 커질 수 있습니다.
- Suggestion: **Content-Length 검사** 또는 스트리밍/상한과 함께 **최대 문자 수**를 검증합니다.

### [LOW] mock 경로의 고정 200ms 지연

- Location: `src/app/api/meeting-minutes/route.ts`
- Category: network
- Impact: 키 없는 비프로덕션에서 모든 요청이 200ms 추가됩니다. 개발 UX에는 미미할 수 있으나 불필요하면 제거하거나 플래그로 감쌉니다.
- Suggestion: 테스트 안정화용이 아니라면 지연 제거 또는 환경 변수로만 활성화합니다.

## Verdict

**NEEDS_FIXES** — 키는 서버에만 두는 점과 사용자-facing 오류 일반화는 양호하나, **공개 엔드포인트에서의 인증/레이트 리밋 부재**, **입력·병렬 호출 상한 부재**, **모델 화이트리스트 부재**는 프로덕션 배포 전에 완화하는 것이 좋습니다.
