---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "glossary-and-toast"
  review_kind: implementation
---

# Implementation & Test Review

## Summary

`glossary-and-toast` 브랜치는 계획서의 핵심 데이터 흐름(용어·세션 컨텍스트 → API → `buildSystemPromptWithContext` → SINGLE/MAP만 적용, REDUCE는 상수 유지, 파이프라인 fetch·`completedSessionId`·DB `context` 저장)이 코드상 일관되게 구현되어 있습니다. `npm run test` 전체가 통과하여 회귀 위험은 낮습니다. 다만 계획서 Step 4·11·12·13에 적힌 **일부 테스트 항목이 구현되지 않았거나 다른 방식으로 대체**되어, “계획 대비 테스트 완결성” 측면에서 보완 여지가 있습니다.

## Plan Compliance

| Plan Item                                     | Status  | Notes                                                                                                                                                                                                                                                                                  |
| --------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. 타입 (`types.ts`)                          | Met     | `types.test.ts` 존재                                                                                                                                                                                                                                                                   |
| 2. GlossaryProvider + `useGlossary`           | Met     | `context.tsx`, `context.test.tsx`                                                                                                                                                                                                                                                      |
| 3. `buildSystemPromptWithContext`             | Met     | 빈 glossary + null/공백-only 세션 시 base 유지, `prompts.test.ts` 충실                                                                                                                                                                                                                 |
| 4. `generateMeetingMinutes` + context         | Met     | `map-reduce.ts`, reduce는 `MEETING_MINUTES_REDUCE_SYSTEM` 고정 검증 포함                                                                                                                                                                                                               |
| 5. API glossary/sessionContext 검증           | Partial | 구현은 `parseGlossary` / `parseSessionContext`로 topic·keywords 길이도 검증하나, route 테스트는 `participants` 초과만 포함                                                                                                                                                             |
| 6. 파이프라인 입력·fetch·`completedSessionId` | Met     | `context.tsx`에 persist용 `MeetingContext` 빌드 및 `updateSession(..., { context })`                                                                                                                                                                                                   |
| 7. fetch-meeting-minutes-client               | Met     | options 및 테스트 추가                                                                                                                                                                                                                                                                 |
| 8. Session `context?`                         | Met     | `db.ts`, `db.test.ts`                                                                                                                                                                                                                                                                  |
| 9. SessionContextInput                        | Met     | 컴포넌트 + 단위 테스트; **Recorder 통합 테스트는 계획 위치에 없음**                                                                                                                                                                                                                    |
| 10. 설정 패널 용어 사전                       | Met     | `settings-panel` 테스트 확장                                                                                                                                                                                                                                                           |
| 11. sonner + Toaster                          | Partial | `AppToaster` 래퍼 + `layout.tsx` 마운트는 충족; 계획의 `src/app/__tests__/layout-toaster.test.tsx`는 **미생성**                                                                                                                                                                        |
| 12. PipelineToastNotifier                     | Partial | 동작 구현됨; 계획의 `useRouter`/`router.push` 대신 **`window.location.assign`**; 테스트도 그에 맞춤. “마운트 시 이미 done” 케이스 테스트 **미포함**                                                                                                                                    |
| 13. Recorder + Provider 배선                  | Partial | `recorder.tsx`·`main-app-providers.tsx` 구현됨; `recorder-batch`는 enqueue에 `glossary`/`sessionContext` 검증하나 **SessionContextInput 렌더/disabled 통합 테스트는 계획과 다르게 누락**. `main-app-providers.test.tsx`는 **`PipelineToastNotifier` 마운트 여부를 직접 단언하지 않음** |

## Findings

### [MEDIUM] 계획 Step 4의 API route 테스트가 일부 누락됨

- Location: `src/app/api/meeting-minutes/__tests__/route.test.ts` (전체 대비 누락 항목)
- Description: 계획에는 `sessionContext.topic`·`sessionContext.keywords` 각각 2000자 초과 시 400, 그리고 glossary/sessionContext 미전달 시 `generateMeetingMinutes`에 **context 없이** 호출되는지 검증이 있으나, 현재 파일에는 `participants` 초과·유효 body 전달 테스트만 추가되어 있습니다. 구현(`route.ts`)은 topic/keywords도 동일 상수로 검증합니다.
- Suggestion: topic/keywords 초과 각각 400 응답 테스트 추가. 하위 호환 시나리오는 스파이가 `context` 인자를 `expect.objectContaining({ context: { glossary: [], sessionContext: null } })`로 볼지, `undefined`를 요구할지 팀 규약에 맞춰 단언을 추가하면 계획과 일치합니다.

### [MEDIUM] 계획 Step 13의 Recorder 통합 테스트가 계획서 위치/범위와 불일치

- Location: `src/components/__tests__/recorder-batch.test.tsx` (누락); `src/components/recorder.tsx` (구현은 존재, 예: `SessionContextInput`, `disabled={pipeline.isBusy}`)
- Description: 계획은 `recorder-batch.test.tsx`에 `SessionContextInput` 렌더 및 `pipeline.isBusy` 시 disabled를 명시했으나, 해당 파일에는 enqueue 필드 검증 위주만 있고 Recorder 트리에서의 UI 통합 검증은 없습니다.
- Suggestion: `Recorder` 렌더 후 `data-testid="session-context-input"`(또는 역할) 존재 및 `isBusy` 모킹 시 입력 비활성화를 `recorder-batch` 또는 `recorder-ui` 등 한 곳에 추가합니다.

### [LOW] Step 11 Toaster 전용 레이아웃 테스트 미작성

- Location: 계획 `src/app/__tests__/layout-toaster.test.tsx` 없음; 대신 `src/components/app-toaster.tsx`, `src/app/layout.tsx`
- Description: 기능 요구(전역 Toaster)는 `AppToaster`로 충족하나, 계획한 RED 파일/케이스는 반영되지 않았습니다.
- Suggestion: 최소 스냅샷 또는 `layout` 모듈에서 `AppToaster` import 여부 검사 테스트를 추가하면 계획 Step 11과 정합됩니다.

### [LOW] PipelineToastNotifier “초기 마운트가 done” 회귀 테스트 없음

- Location: `src/components/__tests__/pipeline-toast-notifier.test.tsx`
- Description: 계획 Step 12에 명시된 “마운트 시점부터 phase가 done이면 토스트 없음” 케이스가 테스트 파일에 없습니다. `useRef(phase)` 초기화 덕분에 구현은 합리적으로 보이나, 회귀 방지용 테스트가 빠져 있습니다.
- Suggestion: `<Harness phase="done" completedSessionId="x" />`로 최초 `render` 후 `toast.success` 미호출 단언 추가.

### [LOW] 계획문서와 다른 네비게이션 구현

- Location: `src/components/pipeline-toast-notifier.tsx` (대략 21–23행 부근)
- Description: 계획/이슈 초안은 `next/navigation`의 `router.push`를 가정했으나, 구현은 `window.location.assign(\`/sessions/${id}\`)`입니다. 테스트는 이에 맞춰져 있습니다.
- Suggestion: 제품 요구가 클라이언트 전환만이면 계획/문서를 실제 구현에 맞게 갱신하거나, 코드를 계획과 동일하게 맞추는 것 중 하나로 정리합니다(본 리뷰 범위에서는 동작·테스트 일관성만 확인).

## Test Coverage Assessment

- **강점**: `prompts`, `map-reduce`(reduce 고정 포함), `glossary` types/context, 파이프라인 fetch·`completedSessionId` 전이, `fetch-meeting-minutes-client`, DB `context`, `SessionContextInput` 단위, `settings-panel` glossary, `pipeline-toast-notifier` 핵심 시나리오가 Vitest로 뒷받침됩니다. 전체 스위트가 green입니다.
- **약점**: 위 Findings처럼 **계획서에 열거된 일부 API·레이아웃·Recorder·토스트 엣지 테스트가 빠져** “계획 대비 체크리스트 완결”은 아닙니다. 누락 항목은 대부분 구현은 이미 커버하는 형태라, **테스트 계획 정합성** 문제에 가깝습니다.

## Verdict

**PASS_WITH_NOTES** — 구현과 대부분의 테스트는 계획 의도를 충족하고 전체 테스트가 통과하지만, API route·Recorder·레이아웃·토스트 관련 **계획서에 명시된 테스트 항목 일부가 미이행**이며, 토스트 네비게이션은 계획 문서와 **구현 디테일이 다릅니다**(테스트는 현 구현과 일치).
