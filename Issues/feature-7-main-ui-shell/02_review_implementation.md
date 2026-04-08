---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  subagent_model: "Composer"
  feature: "feature-7-main-ui-shell"
  review_kind: implementation
---

# Implementation & Test Review

## Summary

기능 요구(헤더, Record→탭, 전사·요약, 사이드바/드로어, 요약 상태 스텁)는 코드에 반영되어 있고 `npm run test`는 전부 통과했습니다. 다만 계획서 Step 4·5에 적힌 **RED 시나리오(특히 `matchMedia`, `usePathname`으로 드로어 닫힘, 사이드바에서 `SessionList`·`refreshTrigger`)** 는 테스트가 충분히 따라가지 못했습니다.

## Plan Compliance

| Plan Item                                               | Status                         | Notes                                                                                                             |
| ------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 홈 헤더: 중앙 Whirr, 비인터랙티브                       | PASS                           | `home-page-shell.tsx`의 `h1`, 테스트로 링크/버튼 미포함 검증                                                      |
| 부제/설명 헤더와 분리                                   | PASS                           | 본문 `p`로 `HomePageShell` 내 하단 배치                                                                           |
| `<768px` 드로어 오버레이 + 스크림·닫기                  | PASS                           | `HomeContent`의 `fixed` + `role="dialog"` + 스크림 버튼                                                           |
| 라우트 변경 시 드로어 닫힘                              | PASS (구현) / PARTIAL (테스트) | `HomePageShell`에서 `pathname` 변경 시 `drawerOpen` false — 계획의 `useEffect`가 아닌 **렌더 중 `setState`** 패턴 |
| `≥768px` 사이드바 + 동일 `SessionList`·`refreshTrigger` | PASS                           | `aside` + `SessionList refreshTrigger={sessionRefresh}`                                                           |
| Record가 탭보다 위(DOM)                                 | PASS                           | `Recorder` 내 섹션 후 `MainTranscriptTabs`                                                                        |
| 탭 2개, 메인 컬럼 내부만                                | PASS                           | `main-transcript-tabs.tsx`                                                                                        |
| 전사는 탭 패널 안만                                     | PASS                           | `TranscriptView`가 탭 패널로만 전달, `showHeading`으로 제목 중복 완화                                             |
| 요약 상태별 플레이스홀더                                | PASS                           | `SummaryTabPanel` + `Recorder`의 `deriveSummaryTabState`·저장 후 타이머 스텁                                      |
| Step 1 TDD 테스트                                       | PASS                           | `main-transcript-tabs.test.tsx`가 tablist/전환/패널 가시성 검증                                                   |
| Step 2 TDD 테스트                                       | PASS                           | `home-content-layout.test.tsx`가 버튼·tablist 순서, partial 위치 검증                                             |
| Step 3 TDD 테스트                                       | PASS                           | `home-header.test.tsx`                                                                                            |
| Step 4 TDD 테스트                                       | FAIL                           | `matchMedia` 모킹·트리거로 열기·`usePathname` 변경 시 닫힘 **미검증**                                             |
| Step 5 TDD 테스트                                       | PARTIAL                        | `aside`의 `hidden`/`md:block` 클래스만 검증; `matchMedia`·드로어 트리거 비표시·`refreshTrigger` 전달 **미검증**   |
| Step 7 회귀 테스트 정리                                 | PASS                           | 변경 파일에 통합 테스트 diff 없음; 현재 전체 스위트 통과                                                          |
| `npm run test` 통과                                     | PASS                           | 27 files, 117 tests                                                                                               |

## Findings

### [HIGH] Step 4 계획 대비 History drawer 테스트 불일치

- Location: `src/components/__tests__/history-drawer.test.tsx` (전체), 계획 `01_plan.md` Step 4
- Description: 계획은 `(min-width: 768px)`에 대해 `matchMedia`를 `false`로 두고, 트리거로 열림·`usePathname`이 `/`→`/sessions/x`로 바뀔 때 드로어가 닫히는지 `vi.mock("next/navigation")`으로 검증하도록 명시했습니다. 실제 테스트는 `drawerOpen` prop을 직접 켜고, 경로 변경 시 닫힘과 `matchMedia`를 다루지 않습니다.
- Suggestion: `HomePageShell`을 렌더하고 `usePathname` 모의 값을 바꾼 뒤 드로어가 사라지는지 검증하고, 모바일 분기는 `matchMedia` 스텁으로 고정합니다. 트리거 클릭으로 열리는 흐름도 포함합니다.

### [MEDIUM] Step 5 사이드바 테스트가 동작·데이터 경로를 거의 검증하지 않음

- Location: `src/components/__tests__/history-sidebar.test.tsx` (예: L46–L54 근처)
- Description: 계획은 `md` 이상에서 `SessionList` 표시, 드로어 트리거 숨김, `refreshTrigger` 전달을 `session-list.test.tsx` 패턴으로 검증하라고 했습니다. 현재는 `aside` 클래스 문자열만 확인합니다.
- Suggestion: `HomePageShell`+`HomeContent` 또는 최소 `HomeContent`에 대해 `matchMedia`를 `true`로 모킹한 뒤 `getAllSessions` 스파이와 `refreshTrigger` 증가(또는 목록 갱신)를 검증하고, `History 열기` 버튼이 `md:hidden`으로 사라지는지 확인합니다.

### [MEDIUM] 경로 동기화가 계획의 `useEffect`와 다르게 구현됨

- Location: `src/components/home-page-shell.tsx` (약 L11–L15)
- Description: 계획은 `usePathname`을 `useEffect` 의존성에 두고 이전 값과 비교해 `setOpen(false)` 하라고 했습니다. 구현은 렌더 도중 `pathname !== pathnameSeen`일 때 `setPathnameSeen`·`setDrawerOpen(false)`를 호출합니다. 동작은 맞을 수 있으나, 문서화된 패턴과 어긋나고 엄격/동시성 모드에서 디버깅 난이도가 달라질 수 있습니다.
- Suggestion: 계획대로 `useEffect(() => { ... }, [pathname])`로 옮기거나, 팀이 렌더 중 동기화를 의도했다면 계획서/주석으로 근거를 남깁니다.

### [LOW] Step 1 테스트가 실제 `TranscriptView`가 아닌 슬롯으로 검증

- Location: `src/components/__tests__/main-transcript-tabs.test.tsx`
- Description: 계획은 `TranscriptView` 자리 표시자를 허용하므로 **허용 범위**이나, 통합 관점에서는 탭+`TranscriptView` 연결 한 건이 있으면 회귀에 유리합니다.
- Suggestion: 선택적으로 `Recorder` 또는 `MainTranscriptTabs`에 모킹 `TranscriptView`를 끼워 `data-testid`를 단언합니다.

## Test Coverage Assessment

- **잘 된 점**: Step 1–3·6은 시나리오가 구체적이고, `MainTranscriptTabs`의 `aria-selected`/`hidden`으로 의도한 패널 전환을 검증합니다. `SummaryTabPanel`은 상태별 카피·`complete` 본문·`error`를 나눠 검증합니다. 레이아웃 테스트는 `compareDocumentPosition`으로 Record→탭 순서를 명확히 봅니다.
- **격차**: Step 4·5는 계획에 적힌 **뷰포트 모킹·내비게이션 모킹·refresh 트리거**가 빠져 있어, “계획서 TDD 체크리스트 충족” 관점에서는 미완입니다. Step 7은 코드 diff 없이도 전체 통과로 충분히 커버된 것으로 보입니다.

## Verdict

**PASS_WITH_NOTES** — 런타임 동작과 완료 조건 대부분은 구현·전체 테스트로 뒷받침되나, **Step 4·5의 테스트 스펙 대비 누락**과 **경로 동기화 구현 방식의 계획 이탈**이 있어 메모가 필요합니다.
