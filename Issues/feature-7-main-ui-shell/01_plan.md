---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  subagent_model: "Composer"
  feature: "feature-7-main-ui-shell"
---

# Feature 7: 메인 UI 셸 — 개발 계획서

## 개발 범위

- **홈 화면(`src/app/page.tsx`) 정보 구조 개편**: 상단 헤더는 중앙 **Whirr** 텍스트만(클릭·링크·라우팅 없음). 기존 부제/설명 문구는 헤더 브랜딩과 분리해 본문 플로우로 이동하거나 유지 위치를 명시적으로 정한다.
- **History 노출 방식**: `768px` 미만은 좌상단 트리거로 **오버레이 drawer**; `768px` 이상(`Tailwind` 기준 `md:`)은 **좌측 고정 사이드바**. 목록 데이터·갱신은 기존 `SessionList`와 동일(`getAllSessions`, `refreshTrigger`, `Link` → `/sessions/[id]`).
- **본문 순서**: **Record(녹음) 컨트롤 블록**이 먼저, 그 **아래**에 **탭 UI**만 둔다. 탭은 **「실시간 전사 텍스트」**·**「요약」** 두 개뿐이며, **전체 너비 상단 내비 형태가 아닌** 메인 컬럼 내부에만 위치한다.
- **전사 표시 위치**: 현재 `Recorder`가 `TranscriptView`를 녹음 카드 **위**에 두고 있으나, 스펙에 맞게 **전사 탭 패널 안**으로 옮긴다. `useTranscription` / `useRecorder` / 저장 로직은 한 클라이언트 경계 안에서 유지한다(예: `Recorder`를 **레이아웃 전용**으로 쪼개거나 `HomeContent`·신규 `RecordingWorkspace`에서 훅을 모은다).
- **요약 탭**: API 부재 시에도 **녹음 전·녹음 중·요약 중·요약 완료**(및 실패/비활성 시 카피) 상태별 UI를 구분해 플레이스홀더로 맞춘다. 이후 API 연동 시 동일 상태 모델에 맞춰 치환한다.
- **라우팅**: `src/app/sessions/[id]/page.tsx`는 세부 화면으로 유지. **홈에서 drawer가 열린 뒤 `SessionList`의 `Link` 등으로 경로가 바뀌면 drawer는 닫힌다**(`usePathname` 등으로 동기화).
- **`src/app/layout.tsx`**: 필수 변경은 없을 수 있으나, 전역 셸이 필요하면 최소한의 래퍼만 추가한다.

## 기술적 접근 방식

- **반응형**: `Tailwind` `md:`(기본 `min-width: 768px`)로 사이드바 vs drawer 전환. 모바일 헤더는 **좌측 트리거 영역을 확보**하고 Whirr는 **가운데 정렬**(예: 그리드 3열, 가운데 열에 제목, 좌측에 아이콘 버튼)해 시각적 겹침을 피한다.
- **Drawer**: `fixed` 오버레이 + 스크림(반투명 배경), `aria-modal`, `role="dialog"`, 포커스 이동·닫기 버튼은 접근성 최소 요건을 맞춘다. 열림 상태는 클라이언트 `useState`.
- **라우트 변경 시 drawer 닫기**: `next/navigation`의 `usePathname()`을 `useEffect` 의존성에 두고, 이전 값과 비교해 변경 시 `setOpen(false)`. 테스트에서는 `vi.mock("next/navigation")`으로 pathname 시나리오를 재현한다.
- **탭**: 네이티브 패턴으로는 `role="tablist"` / `tab` / `tabpanel` 조합 또는 단순 버튼+패널 전환. RTL에서는 `getByRole("tab", { name: ... })`, 선택된 패널에 `aria-selected` / `hidden` 또는 조건부 렌더로 검증한다.
- **상태 연동**: 요약 탭의 **녹음 전/중**은 `useRecorder`의 `status`(`idle` | `recording` | `error`)와 매핑. **요약 중/완료**는 당분간 로컬 상태(또는 `useState` 플래그)로 스텁; 녹음 종료 후 “요약 중”으로 바꾸는 트리거는 이후 API 도입 시 같은 지점에 연결한다.
- **기존 테스트 영향**: `Recorder`·`TranscriptView` DOM 순서를 바꾸므로 `src/components/__tests__/recorder-stt-integration.test.tsx`, `transcript-view.test.tsx` 등 **역할·순서에 의존하는 단언**을 갱신한다.

## TDD 구현 순서

### Step 1: 본문 탭(실시간 전사 / 요약) 구조와 패널 전환

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/main-transcript-tabs.test.tsx` (신규, 파일 상단 `/** @vitest-environment happy-dom */`)
- 테스트 시나리오 목록:
  - `role="tablist"`와 탭 두 개(접근 가능한 이름: **실시간 전사 텍스트**, **요약**)가 렌더된다.
  - 기본 선택 탭은 **실시간 전사 텍스트**이고, 해당 패널에 `TranscriptView`가 연결된 자리 표시자(모킹된 props 또는 `data-testid`)가 보인다.
  - **요약** 탭을 클릭하면 요약 패널이 보이고 전사 패널은 보이지 않는다(또는 `tabpanel` 가시성).

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/main-transcript-tabs.tsx`(신규) 또는 `home-content.tsx`에 인라인 후 추출
- 핵심 구현 내용: `useState`로 활성 탭 관리, 두 패널 조건부 렌더, 요약 패널은 Step 6에서 채울 스텁 래퍼만 둔다.

**REFACTOR** — 코드 개선

- 탭·패널을 `SummaryTabPanel` 등으로 분리해 `HomeContent` 가독성 확보, ARIA 속성 정리.

### Step 2: Record 컨트롤이 탭보다 위(DOM·시각 순서)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/home-content-layout.test.tsx`(신규, happy-dom)
- 테스트 시나리오 목록:
  - 모킹된 `Recorder` 또는 실제 `HomeContent` 렌더 시, **녹음 관련 레이블/버튼(예: “녹음 시작”)**이 **탭리스트**보다 앞서 DOM에 나타난다(`compareDocumentPosition` 또는 쿼리 순서).
  - `TranscriptView`(또는 전사 영역 `data-testid`)는 **탭 패널 내부**에만 존재한다(헤더·Recorder 밖 중복 없음).

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder.tsx`, `src/components/home-content.tsx`
- 핵심 구현 내용: `TranscriptView`를 `Recorder` 최상단에서 제거하고, `partial`/`finals`/`errorMessage`를 부모가 탭 패널로 전달하거나, `Recorder`가 “컨트롤만” 렌더하고 전사는 `HomeContent`가 `useTranscription`과 함께 탭에 넣는 구조로 **한 가지로 일관되게** 재배선한다. 저장·STT 흐름은 기존 `recorder-session-storage`·통합 테스트가 통과하도록 유지한다.

**REFACTOR** — 코드 개선

- 훅·저장 로직을 `useRecordingWorkspace` 또는 `RecordingWorkspace` 컴포넌트로 묶어 `Recorder` 이름과 책임을 정리한다.

### Step 3: 헤더 — 중앙 Whirr 텍스트, 비인터랙티브

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/home-header.test.tsx`(신규, happy-dom)
- 테스트 시나리오 목록:
  - 화면에 **Whirr** 텍스트가 보인다.
  - Whirr를 감싼 `a` 태그 또는 `button`이 없다(또는 `cursor-pointer`만 있는 헤딩 없음). `getByText("Whirr").closest("a")`가 `null` 등으로 검증.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/app/page.tsx`, 필요 시 `src/components/home-header.tsx`(신규)
- 핵심 구현 내용: 헤더 영역을 `h1` 또는 `p` 등 시맨틱 텍스트만으로 표시, `onClick`/`href` 제거. 부제는 헤더 밖으로 이동.

**REFACTOR** — 코드 개선

- 홈 전용 헤더 컴포넌트로 분리해 이후 세션 페이지와 시각 일관만 공유할지 결정한다.

### Step 4: 모바일 History drawer(오버레이) 및 라우트 변경 시 닫힘

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/history-drawer.test.tsx`(신규, happy-dom)
- 테스트 시나리오 목록:
  - `matchMedia`를 `(min-width: 768px)`에 대해 `false`로 모킹한 상태에서 트리거 버튼으로 drawer가 열리면 `SessionList` 또는 `aria-label`이 있는 패널이 보인다.
  - `usePathname`이 `"/"`에서 `"/sessions/x"`로 바뀌도록 모킹을 갱신하면 drawer가 닫혀 오버레이 콘텐츠가 사라진다.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/history-drawer.tsx` 또는 `src/components/home-content.tsx` 내 훅
- 핵심 구현 내용: 오버레이 `fixed`, 스크림 클릭 시 닫기, `usePathname` `useEffect`로 경로 변경 시 `open` false.

**REFACTOR** — 코드 개선

- 포커스 트랩은 1차로 선택 사항이면 TODO로 남기되, 닫기·스크림·`aria-modal`은 유지한다.

### Step 5: 데스크톱 좌측 사이드바 History(동일 `SessionList`)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/history-sidebar.test.tsx`(신규, happy-dom)
- 테스트 시나리오 목록:
  - `matchMedia`를 `md` 이상 `true`로 모킹하면 사이드바 영역에 `SessionList`가 보이고, drawer 트리거는 보이지 않거나 `hidden` 처리된다.
  - `SessionList`에 `refreshTrigger`를 넘기는 경우 홈과 동일하게 갱신이 전달되는지(기존 `session-list.test.tsx` 패턴 재사용·스파이).

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/home-content.tsx`
- 핵심 구현 내용: `flex` 레이아웃으로 좌측 고정 폭 + 우측 메인; `SessionList refreshTrigger={sessionRefresh}` 재사용.

**REFACTOR** — 코드 개선

- 사이드바·메인 간 `gap`, `min-w-0`로 탭 영역 줄바꿈 깨짐 방지.

### Step 6: 요약 탭 상태별 UI(플레이스홀더)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/summary-tab-panel.test.tsx`(신규, happy-dom)
- 테스트 시나리오 목록:
  - props 또는 컨텍스트로 `idle` | `recording` | `summarizing` | `complete`(및 `error` 선택)일 때 서로 다른 안내 문구/역할이 노출된다.
  - `complete`일 때 요약 본문 영역이 보인다(임시 고정 문자열 허용).

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/summary-tab-panel.tsx`(신규)
- 핵심 구현 내용: `switch` 또는 매핑 객체로 분기, 제품 카피는 이슈 완료 조건을 만족하는 수준으로 확정.

**REFACTOR** — 코드 개선

- 녹음 상태와 요약 상태를 도출하는 순수 함수 `getSummaryUiState(...)`를 `src/lib/` 또는 컴포넌트 파일 하단으로 분리해 테스트 용이성 확보.

### Step 7: 회귀 — 전사 반영·세션 저장·통합 테스트 정리

**RED** — 기존 테스트가 실패하는지 확인

- 테스트 파일: `src/components/__tests__/recorder-stt-integration.test.tsx`, `recorder-session-storage.test.tsx`, `transcript-view.test.tsx` 등

**GREEN**

- 구현 파일: 위 단계에서 이미 반영; 실패 단언을 **새 레이아웃**에 맞게 수정한다. STT·저장 동작은 변경하지 않는다.

**REFACTOR**

- 중복 모킹을 `test-utils`로 옮기는 것은 필요 시에만 수행한다.

## 파일 변경 계획

| 경로                                                                   | 변경 요약                                                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/page.tsx`                                                     | 헤더(Whirr 중앙·비링크), 모바일용 레이아웃 여백; `HomeContent`를 사이드바·메인 2열 구조를 포함하도록 감싸거나 `HomeContent` 내부에서 전체 폭 처리 |
| `src/components/home-content.tsx`                                      | `지난 세션` 섹션 제거 또는 사이드바/drawer로 이전; `sessionRefresh` 유지; Record+탭+History 배치                                                  |
| `src/components/session-list.tsx`                                      | 가능하면 변경 없음; 스타일만 사이드바 폭에 맞게 조정할 경우 `className` 확장 props 정도                                                           |
| `src/components/recorder.tsx`                                          | 전사 UI 제거 및 컨트롤 우선 배치; props로 전사 데이터를 받지 않는 구조면 훅 상위 이동과 함께 수정                                                 |
| `src/components/transcript-view.tsx`                                   | 탭 제목과 중복되는 내부 `h2` 문구 조정 가능(접근성 유지)                                                                                          |
| `src/components/main-transcript-tabs.tsx`(신규)                        | 탭 + 패널                                                                                                                                         |
| `src/components/summary-tab-panel.tsx`(신규)                           | 요약 상태별 UI                                                                                                                                    |
| `src/components/home-header.tsx` 또는 `history-drawer.tsx`(신규, 선택) | 관심사 분리 시 추가                                                                                                                               |
| `src/app/sessions/[id]/page.tsx`                                       | 필요 시 홈과 동일 헤더 정렬을 맞추기 위한 최소 여백만(스펙 핵심은 홈)                                                                             |
| `src/app/layout.tsx`                                                   | 변경 없음이 기본                                                                                                                                  |
| `src/components/__tests__/*.test.tsx`                                  | Step 1~7에 명시한 신규·수정 테스트                                                                                                                |

## 완료 조건

이슈 `00_issue.md`의 Done Criteria와 동일하게 충족할 것:

- 상단 중앙 Whirr 텍스트, 클릭/네비게이션 없음.
- `<768px`에서 좌상단 트리거로 History drawer 오버레이, **라우트 변경 시 닫힘**.
- `≥768px`에서 좌측 사이드바 History가 **기존과 동일 데이터**로 동작(`SessionList` + `refreshTrigger`).
- Record 컨트롤이 전사·요약 탭 영역 **위**.
- 탭은 **실시간 전사 텍스트** / **요약** 두 개만, **Record 아래 본문**에만.
- 실시간 전사 탭에 전사 내용 반영(기존 STT 파이프라인 유지).
- 요약 탭에서 녹음 전·녹음 중·요약 중·요약 완료(및 실패 등) 구분 표시.

추가로 **`npm run test` 전체 통과**, `npm run lint` 무관 변경 시 통과 유지.

## 테스트 전략

- **환경**: DOM이 필요한 컴포넌트 테스트는 파일별 `/** @vitest-environment happy-dom */`(프로젝트 `docs/TESTING.md` 준수).
- **도구**: Vitest + `@testing-library/react`(`render`, `screen`, `userEvent` 또는 `fireEvent`, `waitFor`).
- **`next/navigation`**: `usePathname`을 `vi.fn()`으로 주입하고, 래퍼 컴포넌트에서 시나리오별로 반환값을 바꿔 drawer 닫힘을 검증한다.
- **`matchMedia`**: `window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: ..., media: q, ... }))` 패턴으로 뷰포트 분기 테스트.
- **`SessionList`**: 기존처럼 `getAllSessions` 모킹; drawer/사이드바는 목록이 비어 있을 때도 “저장된 세션이 없습니다.” 문자열로 안정적으로 assert 가능.
- **통합**: 녹음·저장·STT 순서는 기존 `recorder-stt-integration.test.tsx` 등을 **레이아웃 변경 후** 반드시 재실행한다.
- **수동 스모크**: `npm run dev`에서 768px 전후 리사이즈, drawer 열고 세션 링크 클릭 시 닫힘, 탭 전환 시 전사 연속 표시를 확인한다.
