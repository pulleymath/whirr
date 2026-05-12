---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: session-detail-edit-modal
  review_kind: implementation
---

# Implementation & Test Review

## Summary

기능 면에서는 계획의 읽기 전용 상세·헤더 액션·편집 모달·요약 생성(암묵적 저장·즉시 닫기·페이지 진행 표시)·`useBeforeUnload(mmLoading)` 연결이 대체로 구현되어 있고, 지정한 관련 테스트 5개 파일(33케이스)은 통과했습니다. 반면 `01_plan.md`에 적힌 TDD용 RED 케이스 목록과 비교하면 모달 단위 테스트와 일부 통합 단언이 크게 덜 작성되어 있습니다.

## Plan Compliance

| Plan Item                                      | Status          | Notes                                                                                                                                                                                                                              |
| ---------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 1: `session-property-rows` + 단위 테스트  | PARTIAL         | 구현·테스트 존재. 계획의 “4개 인풋 렌더”는 간접 검증 위주.                                                                                                                                                                         |
| Step 2: `RecorderNoteWorkspace` 리팩터         | PASS            | `SessionPropertyRowsEditable` 사용·탭 상수 export 반영(코드 기준). 별도 신규 RED는 diff에 없음.                                                                                                                                    |
| Step 3: 세션 상세 읽기 전용 셸 + 테스트        | PARTIAL         | 구현은 부합. 테스트: 스크립트 `textarea` 부재·모달 저장/생성·빈 요약 카피 등은 있으나, 헤더 `[다운로드][편집]` 순서·페이지에 `요약 생성` 없음·속성 인풋 부재·`SessionScriptMetaDisplay` 등 계획 열거 항목 전부에 대한 단언은 부족. |
| Step 4–5: `SessionEditDialog` + 광범위 RED     | FAIL            | `session-edit-dialog.test.tsx`는 5개 케이스만 존재. 계획의 dialog a11y·초기값·용어집/모델·배경/ESC·저장 실패·dirty 분기 다수 미작성.                                                                                               |
| Step 6: 모달 닫힘 + 페이지 진행 + beforeunload | PARTIAL         | 통합 테스트로 생성·닫힘·요약 반영·재조회 실패 메시지·beforeunload 스파이는 있음. `"요약 생성 중…"`(`data-testid="session-detail-mm-progress"`)·생성 중 `편집` 비활성 등은 단언 없음.                                               |
| Step 7: audio/badid 등 회귀 테스트 갱신        | PARTIAL         | diff에 `session-detail-audio`/`badid` 없음(기존이 여전히 맞을 수는 있음).                                                                                                                                                          |
| 완료조건 1–2: 읽기 전용 + 헤더 액션            | PASS            | 코드상 `SessionPropertyRowsReadOnly`·`<pre>`·헤더 `IconButton` 배치로 충족.                                                                                                                                                        |
| 완료조건 3–4: 모달·dirty·저장                  | PASS_WITH_NOTES | dirty·저장 흐름 구현됨. “저장 후 갱신 실패” 시나리오는 구현 보완 대상.                                                                                                                                                             |
| 완료조건 5: 요약 생성 흐름                     | PASS            | `onGenerate` → `setEditOpen(false)` 후 `persistSessionEditSnapshot` + fetch + summary 저장.                                                                                                                                        |
| 완료조건 6: beforeunload                       | PASS            | `useBeforeUnload(mmLoading)` 유지·해당 테스트 통과. 모달 닫힘 순서는 테스트에서 명시하지 않음.                                                                                                                                     |
| 계획 대비 구현 세부                            | PASS_WITH_NOTES | 다이얼로그 `z-[70]`, `max-w-3xl` 등은 계획(`z-60`, `max-w-2xl`)과 소폭 상이(동작 영향 위주). 요약 생성 시 `updateSession`은 모달이 아닌 부모에서 수행 — 계획 문구와 다르지만 동등한 “암묵적 저장”으로 볼 수 있음.                  |

## Findings

### [MEDIUM] 저장 후 세션 재조회 실패여도 모달이 닫힘

- Location: `src/components/session-edit-dialog.tsx` (`handleSave` 내 `await onAfterPersist()` 이후 무조건 `onClose()`)
- Description: `onAfterPersist`가 `session-detail.tsx`의 `refreshSession`으로 연결될 때 실패는 `false` 반환만 하고 예외를 던지지 않습니다. IDB에는 반영됐으나 화면 세션이 갱신되지 않은 상태에서 모달이 닫혀, 완료 조건 “페이지 갱신 → 모달 닫힘”과 어긋날 수 있습니다(요약 생성 경로는 `false`일 때 `mmError`를 세팅하는 패턴이 있음).
- Suggestion: `onAfterPersist`의 반환값이 `false`이면 모달을 유지하고 사용자에게 갱신 실패 메시지를 표시하거나, 부모에서 재조회 실패 시 reject하도록 계약을 맞춥니다.

### [MEDIUM] 계획서 RED 목록 대비 `SessionEditDialog` 테스트 부족

- Location: `src/components/__tests__/session-edit-dialog.test.tsx` (전반)
- Description: 계획 Step 4–5에 나열된 `role="dialog"`/`aria-modal`/`"노트 편집"`·4필드 초기값·`SessionGlossaryEditor`/`SessionMinutesModelSelect`·배경 클릭·ESC·저장 실패·dirty 취소·저장 후 dirty 리셋·스크립트 변경 후 ESC/배경 등 대부분 미구현입니다. 회귀 방어력이 계획 대비 약합니다.
- Suggestion: 계획 표에 있는 항목을 그대로 체크리스트로 옮겨 테스트를 보강합니다. 저장 실패는 `updateSession` mock reject로 검증합니다.

### [LOW] 세션 상세 통합 테스트의 계획 Step 3/6 공백

- Location: `src/components/__tests__/session-detail.test.tsx`
- Description: 계획에 명시된 “페이지에 요약 생성 버튼 없음”, “헤더 액션 순서”, “`SessionScriptMetaDisplay`”, “요약 생성 중 진행 문구/스피너”, “생성 중 편집 비활성” 등에 대한 테스트가 없거나 약합니다.
- Suggestion: `getByTestId("session-detail-mm-progress")`, 헤더 버튼 `closest`/`compareDocumentPosition`, `scriptMeta` fixture, `mmLoading` 동안 `편집` disabled 단언을 추가합니다.

### [LOW] `session-detail-mm-before-unload`가 ‘모달 닫힘’을 검증하지 않음

- Location: `src/components/__tests__/session-detail-mm-before-unload.test.tsx` (약 62–93행 근처)
- Description: 계획 Step 6 서술(모달 즉시 닫힘 후 페이지 보호) 대비, `beforeUnloadSpy(true)`만 확인하고 `session-edit-dialog` 제거 여부는 단언하지 않습니다.
- Suggestion: 생성 클릭 직후 `expect(queryByTestId("session-edit-dialog")).not.toBeInTheDocument()`를 추가합니다.

## Test Coverage Assessment

- **잘 된 점**: `session-property-rows`, `session-detail`의 읽기 전용 스크립트·모달 저장/요약·재생성 라벨·IDB 실패·beforeunload 스파이 등 핵심 사용자 경로가 통합 테스트로 잡혀 있고, 실행도 통과했습니다.
- **부족한 점**: 계획서가 요구한 모달 단위 테스트 범위의 상당 부분이 생략되었고, 상세 페이지의 헤더/메타/진행 UI는 구현되어 있으나 테스트가 따라오지 못했습니다. Mock은 대체로 필요한 수준이나, 모달 쪽은 “의도된 동작 검증”보다 최소 시나리오에 가깝습니다.

## Verdict

**PASS_WITH_NOTES** — 구현은 계획 의도에 대체로 부합하고 관련 테스트는 통과하지만, 계획된 RED 범위·완료 조건(저장 후 갱신) 관점에서 테스트와 한 가지 완료 시나리오를 보완하는 것이 좋습니다.
