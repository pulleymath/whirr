---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  subagent_model: "code-reviewer"
  feature: "feature-7-main-ui-shell"
  review_kind: architecture
---

## 아키텍처·코드 스타일 리뷰 — feature-7-main-ui-shell

### 변경 파일 요약 (`git diff --name-only main`)

- 이슈/상태: `Issues/STATUS.md`, `Issues/feature-7-main-ui-shell/00_issue.md`, `01_plan.md`
- 문서(다수): `docs/ARCHITECTURE.md`, `DEPLOY.md`, `GLOSSARY.md`, `PRD.md`, `README.md`, `SETUP.md`, `TESTING.md`, `TROUBLESHOOTING.md`
- 앱/컴포넌트: `src/app/page.tsx`, `home-page-shell.tsx`, `home-content.tsx`, `recorder.tsx`, `main-transcript-tabs.tsx`, `summary-tab-panel.tsx`, `transcript-view.tsx`
- 테스트: `history-drawer.test.tsx`, `history-sidebar.test.tsx`, `home-content-layout.test.tsx`, `home-header.test.tsx`, `main-transcript-tabs.test.tsx`, `summary-tab-panel.test.tsx`, `route.test.ts`, `openai-realtime.test.ts`

### Summary

계획서(`01_plan.md`)의 핵심 UX·레이아웃(헤더 Whirr 비인터랙티브, Record 위·탭 아래, 전사는 탭 패널, History는 `md` 사이드바/모바일 drawer, `SessionList`·`refreshTrigger` 재사용, 요약 탭 상태별 UI)은 대체로 반영되었습니다. `docs/ARCHITECTURE.md`의 **브라우저 중심 신뢰 경계**(STT·로컬 저장·전사 UI)와도 충돌하는 서버 비밀 노출이나 경계 위반은 없습니다.

다만 **라우트 변경 시 drawer 닫기** 구현이 React 권장 패턴에서 벗어나 있고, 같은 동작에 대한 **계획된 `usePathname` 테스트가 빠져** 회귀 방지가 약합니다. 또 기능과 무관한 **문서·테스트 포맷 전반 diff**가 커서 리뷰 부담이 큽니다.

### Findings by severity

#### Critical (즉시 수정 권장)

- **없음** (아키텍처 붕괴·보안 경계 위반 수준의 항목은 diff 상 확인되지 않음)

#### Important (수정 권장)

1. **`HomePageShell`에서 렌더 도중 `setState` (pathname 동기화)**
   - `pathname !== pathnameSeen`일 때 본문에서 `setPathnameSeen` / `setDrawerOpen(false)`를 호출하는 패턴은 React에서 **렌더 중 같은 컴포넌트 상태 갱신**으로 분류되며, 문서·린트(예: `react-hooks` 계열) 관점에서 권장되지 않습니다. 계획서는 `usePathname`을 **`useEffect` 의존성**에 두는 방식을 명시합니다.
   - **권장**: `useEffect(() => { setDrawerOpen(false); setPathnameSeen(pathname); }, [pathname])` 등으로 이전, 또는 drawer 열림을 pathname과 함께 초기화하는 다른 단일 진실 소스로 정리.

2. **계획 Step 4와 불일치하는 drawer 테스트 범위**
   - `history-drawer.test.tsx`는 `drawerOpen` / `onCloseDrawer` **props 주입**으로 dialog·스크림만 검증하고, 계획에 있는 **`usePathname`이 `/` → `/sessions/x`로 바뀔 때 drawer가 닫히는 시나리오**는 다루지 않습니다. 실제 닫힘 로직은 `HomePageShell`에 있으므로, 해당 컴포넌트를 모킹과 함께 테스트하거나 통합 테스트로 pathname 변화를 검증하는 편이 계획·아키텍처 검증에 맞습니다.

3. **`main-transcript-tabs.tsx`의 `React.ReactNode`**
   - `React` 네임스페이스를 import하지 않고 `React.ReactNode`만 사용합니다. 설정에 따라 동작할 수 있으나, 프로젝트 컨벤션과 안정성을 위해 `import type { ReactNode } from "react"` 후 `ReactNode` 사용이 일반적입니다.

4. **`Recorder` 단일 컴포넌트 집중도**
   - 계획 REFACTOR에서 언급한 `RecordingWorkspace` / 레이아웃 전용 분리는 **선택**이지만, 현재 `Recorder`가 녹음 UI·STT 훅·세션 저장·요약 스텁 타이머·탭 조합까지 담당해 **단일 책임**이 무거워졌습니다. 이후 API 연동 시 분리 비용이 커질 수 있어, 경계만 정해 두는 정도의 얇은 추출을 고려할 만합니다.

#### Suggestions (있으면 좋음)

1. **범위 밖 diff 최소화**: `docs/*` 마크다운 표 정렬, `route.test.ts`·`openai-realtime.test.ts` trailing comma 등은 기능과 무관합니다. PR 단위로 포매터/문서 정리를 분리하면 아키텍처 리뷰와 블레임 추적이 쉬워집니다.

2. **`deriveSummaryTabState` 위치**: 계획의 `src/lib/` 분리는 테스트 재사용 측면에서 선택 사항; 현재 파일 내부 헬퍼도 응집도 면에서는 수용 가능합니다.

3. **탭 패널 가시성**: `hidden` 속성과 `className`의 `hidden`이 중복입니다. 동작에는 문제 없을 수 있으나 한 가지 방식으로 통일하면 유지보수가 단순해집니다.

### 아키텍처 체크리스트 (요약)

| 항목                 | 평가                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 설계 패턴            | 탭·패널 분리(`MainTranscriptTabs`, `SummaryTabPanel`)는 적절; 셸(`HomePageShell`) vs 본문(`HomeContent`) 분리도 방향이 맞음. |
| 의존성 방향          | `page` → `HomePageShell` → `HomeContent` → `Recorder` → 탭/전사/요약; 순환 없음.                                             |
| SOLID                | `Recorder`가 여러 이유로 바뀔 여지가 커 **S** 측면에서 개선 여지.                                                            |
| 결합·응집            | History UI가 `HomeContent`에 모여 응집은 있으나 drawer+sidebar 중복 마크업은 추후 공통화 여지.                               |
| ARCHITECTURE.md 정합 | 클라이언트 STT·전사·로컬 저장 구조 유지; 새 서버 경계 추가 없음.                                                             |
| TypeScript           | `SummaryTabPanel`의 `switch` + `never` 기본 분기는 **판별 유니온** 활용에 좋음; `any` 남용 없음.                             |

### Verdict

**PASS_WITH_NOTES**

- 기능·경계는 PRD/아키텍처와 대체로 일치하고, 컴포넌트 분리 방향도 무난합니다.
- 다만 **`HomePageShell`의 pathname 처리 방식**과 **계획 대비 부족한 pathname 기반 테스트**는 머지 전·직후에 손보는 것을 권장합니다. 이 둘을 “블로킹”으로 보려면 **NEEDS_FIXES**로 격상할 수 있습니다.
