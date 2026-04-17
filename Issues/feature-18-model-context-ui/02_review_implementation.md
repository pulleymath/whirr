---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "feature-18-model-context-ui"
  review_kind: implementation
---

# Implementation & Test Review

## Summary

`scriptMeta` 저장·파이프라인 반영, `ModelQuickPanel`, 홈 2열 레이아웃, 세션 상세의 컨텍스트·glossary·회의록 모델 편집 및 `fetchMeetingMinutesSummary` 4번째 인자 전달은 계획과 대체로 일치하며, 변경된 테스트 일부를 포함해 포커스 Vitest 실행은 통과했다. 다만 계획서에 명시된 여러 **전용 테스트 파일이 아예 없고**, DB·재생성 관련 테스트는 계획 대비 **단언이 약하거나 항목이 누락**되어 TDD·완료 조건 검증 측면에서 미완에 가깝다.

## Plan Compliance

| Plan Item                                                                                 | Status                        | Notes                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 1: `SessionScriptMeta`, `DB_VERSION` 3, `saveSession`/`updateSession`에 `scriptMeta` | PASS                          | `session-script-meta.ts`, `db.ts` 반영. `db.test.ts`에 저장·갱신 케이스 있음. 계획 RED의 **레거시 `undefined` 조회**, **`DB_VERSION === 3` 단언**은 테스트에 없음.                                                                                                                                         |
| Step 2: 파이프라인 완료 시 `scriptMeta` persistence                                       | PASS                          | `context.tsx`에서 `buildScriptMeta` 후 최종 `updateSession`에 포함. `script-meta-persistence.test.tsx`로 검증.                                                                                                                                                                                             |
| Step 3: `ModelQuickPanel` + 옵션 공유                                                     | PASS (impl) / FAIL (tests)    | `model-quick-panel.tsx`, `settings/options.ts`, `settings-panel.tsx` 연동 적절. 계획의 **`model-quick-panel.test.tsx` 없음**.                                                                                                                                                                              |
| Step 4: 홈 4영역 2열, `SessionContextInput` 위치                                          | PARTIAL                       | 2열·`home-model-panel`은 `Recorder` 내부 그리드 + `modelPanel` 슬롯으로 달성. 계획은 `HomePageShell`이 직접 배치하는 안이었으나 **동등 UX**로 수용 가능. `home-page-shell.test.tsx`는 **`session-context-input` / `recorder-root` 존재 테스트 미추가**(계획 Step 4 RED).                                   |
| Step 5: `SessionScriptMetaDisplay` + 레거시 숨김                                          | PASS (impl) / FAIL (tests)    | `undefined` → `null`, `labels.formatScriptMetaLine` 사용. 계획의 **`session-script-meta-display.test.tsx` 없음**. 표시 문자열은 계획 예시(「실시간 · …」)와 **모드 라벨 문구·세그먼트 순서**가 다름(완료 조건 4번 문구와도 약간 불일치 가능).                                                              |
| Step 6: 세션 상세 편집 UI + 로컬 상태                                                     | PASS (impl) / FAIL (tests)    | `session-glossary-editor.tsx`, `session-minutes-model-select.tsx`, `session-detail.tsx`에 반영. **`session-detail-context-editor.test.tsx` 없음**. `useSessionDetailEditor` 추출은 미적용(계획 REFACTOR만).                                                                                                |
| Step 7: 재생성 시 `glossary`·`sessionContext` options                                     | PASS (impl) / PARTIAL (tests) | `handleMeetingMinutes`에서 선행 `updateSession` 후 `fetchMeetingMinutesSummary(..., { glossary, sessionContext })` 호출. `session-detail.test.tsx`는 **`objectContaining({ glossary: [] })`만**으로 4번째 인자 검증이 빈약하고, **`updateSession`에 context/scriptMeta 포함** 단언은 해당 시나리오에 없음. |
| Step 8: `enqueuePipeline`에 `mode`·`engine`                                               | PASS                          | `recorder.tsx`, `recorder-batch.test.tsx` 등 반영. `recorder-session-storage.test.tsx`는 **`mode`를 `expect.any(String)`**으로 완화해 계획의 **명시적 realtime/batch 값** 검증보다 약함.                                                                                                                   |
| Step 9: 통합 테스트 `session-detail-regenerate-flow.test.tsx`                             | FAIL                          | **파일 없음**.                                                                                                                                                                                                                                                                                             |
| 완료 조건 1–5, 6–8 (기능)                                                                 | PARTIAL                       | 레거시 세션(`scriptMeta` 없음)에서 **회의록 모델 변경이 `scriptMeta`에 영구 반영되지 않음**(`scriptMetaUpdate`가 `session.scriptMeta == null`이면 생략). API 호출 모델은 `minutesModelDraft`로 반영되나, 조건 7·8의 “세션에 저장” 관점에서 **틈**이 있음.                                                  |
| 완료 조건 9 (전체 품질 게이트)                                                            | NOT VERIFIED                  | 본 리뷰에서 전체 Vitest·`tsc`·lint·`next build`는 실행하지 않음. 샘플 테스트만 통과 확인.                                                                                                                                                                                                                  |

## Findings

### [HIGH] 계획된 신규 단위·통합 테스트 파일 다수 미작성

- Location: 누락 — `src/components/__tests__/model-quick-panel.test.tsx`, `session-script-meta-display.test.tsx`, `session-detail-context-editor.test.tsx`, `session-detail-regenerate-flow.test.tsx`
- Description: `01_plan.md` TDD Step 3·5·6·9에서 **RED 단계용 테스트 파일명이 명시**되어 있으나 저장소에 해당 파일이 없다. 신규 UI(`ModelQuickPanel`, `SessionScriptMetaDisplay`, 세션 편집·재생성 플로우)의 회귀 방지력이 계획 대비 크게 부족하다.
- Suggestion: 계획서 순서대로 최소 1~2개 IT + 컴포넌트별 렌더/인터랙션 테스트 추가. `ModelQuickPanel`은 녹음 중 `useRecordingActivity`와 연동해 `disabled` 동작을 검증한다.

### [MEDIUM] Step 1 RED 범위 대비 `db.test.ts` 불완전

- Location: `src/lib/__tests__/db.test.ts` (끝부분 근처)
- Description: `scriptMeta` 저장·갱신은 있으나, 계획에 있는 **레거시 레코드(`scriptMeta` 없음) 조회 시 `undefined`**, **`DB_VERSION` 3**에 대한 명시적 검증이 없다.
- Suggestion: `getSessionById`로 옛 스키마 시뮬레이션 또는 최소 한 건 `saveSession` 무옵션 후 `scriptMeta` 부재 단언, `db.ts`의 `DB_VERSION` 상수를 테스트에서 import해 기대값 고정.

### [MEDIUM] `recorder-session-storage.test.tsx`의 `scriptMeta`/`mode` 단언이 과도하게 느슨함

- Location: `src/components/__tests__/recorder-session-storage.test.tsx` (diff 기준 `saveSession` 기대 구간)
- Description: `scriptMeta.mode`에 **`expect.any(String)`**을 사용해 **잘못된 모드**가 들어가도 통과할 수 있다. 계획 Step 8은 realtime/batch별 **구체 값** 검증을 요구한다.
- Suggestion: 테스트 픽스처의 `settings.mode`(또는 mock)를 고정하고 `expect.objectContaining({ mode: "realtime", ... })` / batch 케이스 분리.

### [MEDIUM] `session-detail.test.tsx`가 `fetchMeetingMinutesSummary` options를 부분만 검증

- Location: `src/components/__tests__/session-detail.test.tsx` (편집본 → 생성 호출 단언)
- Description: 4번째 인자가 **`{ glossary: [] }`만** `objectContaining`되어 **`sessionContext` 존재·값**이 검증되지 않는다. 계획 Step 7·6은 glossary·context 전달을 명시한다.
- Suggestion: `expect.objectContaining({ glossary: [...], sessionContext: ... })`로 확장하거나, context 필드를 채운 뒤 동일 스모크로 전달 검증.

### [LOW] 완료 조건 문구와 읽기 전용 한 줄 포맷 차이

- Location: `src/lib/settings/labels.ts` — `formatScriptMetaLine`
- Description: 완료 조건 4는 「모드 · 모델/엔진 · 언어」 형태를 예시했으나, 구현은 **`${modelPart} · ${mode} · ${lang}`**이며 모드 라벨도 「실시간 스크립트」 등 **긴 문구**다. 기능 오류는 아니나 제품 카피·계획 예시와 불일치할 수 있다.
- Suggestion: 기획과 합의해 순서·라벨을 맞추거나, 완료 조건 문구를 실제 포맷에 맞게 갱신.

### [LOW] 레거시 세션에서 `scriptMeta` 없이 회의록 모델만 바꾼 경우 영구 저장 누락

- Location: `src/components/session-detail.tsx` — `handleMeetingMinutes` 내 `scriptMetaUpdate`
- Description: `session.scriptMeta == null`이면 `updateSession`에 **`scriptMeta`를 넣지 않아** 세션 레코드에 minutes 모델이 남지 않을 수 있다(당회 호출의 API 모델은 반영).
- Suggestion: 레거시에서도 첫 재생성 시 `buildScriptMeta` 유사 객체를 생성해 저장할지, 또는 UI에서 minutes 편집을 숨길지 제품 정책 결정 후 코드·테스트 정리.

## Test Coverage Assessment

- **잘 된 점**: `script-meta-persistence.test.tsx`는 파이프라인 완료 시점 `updateSession` payload에 `scriptMeta` 필드를 **구체적으로** 검증한다. `recorder-batch.test.tsx`는 `enqueuePipeline`/`saveSession`에 `mode: "batch"` 등을 연결한다. `db.test.ts`에 `scriptMeta` round-trip이 추가되었다.
- **갭**: 위 HIGH/MEDIUM 항목 — **계획서에 나열된 다수 테스트 파일 부재**, 홈 4영역 중 **일부 testid 검증 미이행**, 세션 상세 **options·`updateSession` 순서**에 대한 테스트가 계획 대비 얕음. 통합 파일(`session-detail-regenerate-flow`) 부재로 **엔드투엔드 재생성**은 자동화되지 않았다.

## Verdict

**PASS_WITH_NOTES** — 핵심 기능(`scriptMeta`, 파이프라인, `ModelQuickPanel`, 세션 상세 편집·`fetchMeetingMinutesSummary` options, 홈 2열)은 구현되어 있고 샘플 Vitest는 통과했으나, **계획된 TDD 테스트 세트가 상당 부분 누락**되었고 **일부 단언이 약하며** 레거시 세션의 minutes 모델 영속·표시 카피는 정리 여지가 있다. 머지 전에 위 HIGH·MEDIUM 테스트 보강을 권장한다.
