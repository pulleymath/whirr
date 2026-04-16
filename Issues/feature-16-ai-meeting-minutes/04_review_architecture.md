---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "feature-16-ai-meeting-minutes"
  review_kind: architecture
---

# Architecture & Code Style Review

## Summary

서버에서만 키를 쓰고, 도메인 로직은 `src/lib/meeting-minutes`에 두고 API 라우트는 검증·오케스트레이션에 집중하는 구조는 `docs/ARCHITECTURE.md`의 신뢰 경계와 잘 맞습니다. 다만 상위 아키텍처 문서가 여전히 `/api/summarize`를 서술하고 있어 문서와 구현이 어긋나 있으며, 계획서의 `openai` SDK 사용과 달리 `fetch` 기반 구현으로 바뀐 점은 의도적 트레이드오프인지 팀 합의가 필요합니다.

## Architecture Findings

### [HIGH] `docs/ARCHITECTURE.md` 녹음 후 파이프라인이 구 API(`/api/summarize`)로 고정됨

- Location: `docs/ARCHITECTURE.md` (“녹음 후 파이프라인” 절)
- Category: structure / coupling (문서–구현 정합성)
- Description: 문서는 마지막 단계가 `POST /api/summarize`로 **목(mock) 요약**을 받는다고 적혀 있는데, diff와 계획서는 `/api/meeting-minutes`로 전환·회의록 생성·map-reduce를 전제로 합니다. `docs/SETUP.md`는 이미 `OPENAI_API_KEY` 용도를 확장해 반영되어 있어, 아키텍처 개요만 뒤처진 상태입니다.
- Suggestion: 해당 절을 “`POST /api/meeting-minutes`가 전사 본문을 받아 서버에서 map-reduce로 회의록을 생성하고, 응답은 기존과 같이 `{ summary }` 형태로 세션에 붙인다” 수준으로 고쳐, 엔드포인트·역할(회의록)·클라이언트 필드명(`summary`)을 한 번에 맞춥니다.

### [MEDIUM] 계획서와 다른 구현 선택: `openai` 패키지 대신 `fetch`로 Chat Completions 호출

- Location: `src/lib/meeting-minutes/map-reduce.ts` (`openAiChatCompletion`), `src/app/api/meeting-minutes/route.ts`
- Category: dependency / pattern
- Description: 계획서 Step 3은 `openai` npm과 Chat Completions 사용을 명시했으나, 구현은 `https://api.openai.com/v1/chat/completions`에 대한 직접 `fetch`입니다. 의존성은 줄지만, 재시도·타임아웃·에러 타입 등은 수동으로 관리해야 하고, 향후 다른 OpenAI 엔드포인트와 통일할 때 중복이 생길 수 있습니다.
- Suggestion: 팀 기준으로 “경량 유지(fetch)” vs “공식 SDK 일관성” 중 하나를 택해 DECISIONS 또는 계획서에 반영하고, `fetch`를 유지한다면 최소한 공통 HTTP 헬퍼(한 파일)로 묶어 재사용 지점을 명확히 하는 편이 좋습니다.

### [MEDIUM] `DEFAULT_MEETING_MINUTES_MODEL`이 `settings/types`와 API 라우트에 동시에 노출

- Location: `src/lib/settings/types.ts`, `src/app/api/meeting-minutes/route.ts`, `src/components/settings-panel.tsx`
- Category: coupling / structure
- Description: 기본 모델 상수가 설정 도메인(`TranscriptionSettings`)과 서버 라우트 모두에서 import됩니다. 기능적으로 문제는 없으나, “회의록 기본 모델”이 설정 스키마의 일부인지 vs “API 기본값”인지 경계가 한 파일에 섞여 보입니다.
- Suggestion: 현재 규모에서는 수용 가능합니다. 확장 시 `lib/meeting-minutes/constants.ts`(또는 `defaults.ts`)에 기본 모델만 두고, `types.ts`는 그 상수를 re-export하는 식으로 단일 출처를 만들면 응집도가 좋아집니다.

### [LOW] 프로덕션에서 키 없음 → 503 분기 (계획서의 “dev mock”보다 넓은 정책)

- Location: `src/app/api/meeting-minutes/route.ts`
- Category: structure
- Description: 계획서는 주로 dev에서 mock을 가정했으나, 구현은 `NODE_ENV === "production"`이고 키가 없으면 503을 반환합니다. 아키텍처상 “비밀은 서버에만”과 잘 맞는 방어적 동작입니다.
- Suggestion: 의도된 운영 정책이면 `ARCHITECTURE.md` 또는 `DECISIONS.md`에 한 줄로 적어 두면 이후 리뷰에서 혼선이 줄어듭니다.

### [LOW] mock 경로의 인위적 지연(`setTimeout(200)`)

- Location: `src/app/api/meeting-minutes/route.ts`
- Category: pattern
- Description: 키 없을 때 mock 응답 전 200ms 대기는 동작에 필수는 아니며, 테스트·관측에 노이즈가 될 수 있습니다.
- Suggestion: “이전 summarize mock과 동일한 체감 지연”이 목적이면 주석으로 근거를 남기고, 아니면 제거를 검토합니다.

## Code Style Findings

### [MEDIUM] `Promise.all` vs 계획서 표기 `Promise.allSettled`

- Location: `src/lib/meeting-minutes/map-reduce.ts` (다중 청크 map 구간)
- Category: readability / consistency with spec
- Description: 계획 문서에는 `allSettled`가 언급되어 있으나, 구현은 `Promise.all`로 맵 단계 실패 시 즉시 전체 실패입니다. 계획의 “하나라도 실패하면 전체 에러” 요구와는 일치합니다.
- Suggestion: 계획서 표현만 `Promise.all`로 고치거나, 코드 주석 한 줄로 “부분 실패 시 전체 실패”를 명시해 문서·코드 불일치를 없앱니다.

### [LOW] 라우트의 요청 본문 검증이 반복 캐스팅 중심

- Location: `src/app/api/meeting-minutes/route.ts`
- Category: typescript
- Description: `body`를 `unknown`으로 받은 뒤 `in` 검사와 `as`로 좁히는 패턴은 흔하지만, 필드가 늘면 분기가 길어집니다.
- Suggestion: 동일 프로젝트에 요청 검증 헬퍼나 zod 등이 있다면 공유하고, 없다면 현재 수준은 유지해도 됩니다.

### [LOW] 내부 이름 `TAB_SUMMARY` / `summary` 필드 vs UI “회의록”

- Location: `src/components/main-transcript-tabs.tsx`, 세션·DB 타입 등
- Category: naming / readability
- Description: 계획서대로 사용자 문자열만 “회의록”으로 바꾸고 저장 필드명은 `summary`로 둔 상태입니다. diff 일관성에는 유리합니다.
- Suggestion: 신규 기여자 혼동을 줄이려면 `TAB_SUMMARY`에 짧은 주석(“UI 라벨은 회의록”)을 달거나, 점진적으로 `meetingMinutes` 같은 이름을 도입할 로드맵을 남길 수 있습니다(필수는 아님).

### [LOW] import 순서·그룹핑

- Location: `src/app/api/meeting-minutes/route.ts` 등
- Category: formatting
- Description: `NextResponse`와 `@/lib/...` 순서는 프로젝트 ESLint 규칙과 맞는지 한 번 확인할 가치가 있습니다(대부분 자동 정렬로 해결).
- Suggestion: 저장 시 포맷터/린트로 통일되면 충분합니다.

## Verdict

**PASS_WITH_NOTES**
