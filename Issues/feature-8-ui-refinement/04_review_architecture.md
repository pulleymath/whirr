---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  subagent_model: "fast"
  feature: "feature-8-ui-refinement"
  review_kind: architecture
---

# Architecture & Code Style Review

## Summary

계획서의 **Route Group + 공통 크롬 + 탭 본문 스캐폴드 + reduced-motion 훅** 방향과 잘 맞고, 의존성 방향도 앱 라우터·클라이언트 경계에 무리가 없다. 다만 `HomeContent` 명칭과 홈/세션 진입 경로의 비대칭은 유지보수 시 혼동 여지가 있어 **PASS_WITH_NOTES**로 본다.

## Architecture Findings

### [MEDIUM] `HomeContent` 명칭이 책임 범위와 어긋남

- Location: `src/components/home-content.tsx` (모듈 전반)
- Category: structure / coupling
- Description: 컴포넌트는 이제 홈 전용이 아니라 **메인 라우트 공통**의 2열 레이아웃·모바일 History drawer·`SessionList` 연동을 담당한다. `MainShell`이 이를 자식 슬롯과 함께 사용하므로 이름은 “홈 콘텐츠”보다 **메인 레이아웃 바디**에 가깝다.
- Suggestion: 후속 리팩터에서 `MainLayoutBody`, `HistoryShellContent` 등 도메인에 맞는 이름으로 바꾸거나, 최소한 JSDoc으로 “`/`·`/sessions/[id]` 공통”임을 명시한다.

### [LOW] 홈과 세션 페이지의 셸 진입 패턴 비대칭

- Location: `src/components/home-page-shell.tsx` vs `src/app/(main)/sessions/[id]/page.tsx`
- Category: structure / Next.js app structure
- Description: 홈은 `HomePageShell` → `MainShell` → `HomeContent`이고, 세션 상세는 페이지에서 직접 `MainShell`을 쓴다. 기능상 문제는 없으나 **공통 크롬 진입점이 두 갈래**라 신규 메인 라우트 추가 시 어느 쪽을 따를지 규칙이 코드만으로는 드러나지 않는다.
- Suggestion: (선택) `(main)/layout.tsx`에서 `MainShell`을 한 번만 감싸고 페이지는 `children`만 채우도록 옮기거나, `docs/CODEMAP.md` 등에 “메인 크롬은 항상 `MainShell` + …” 한 줄 규칙을 남긴다.

### [LOW] `MainShell` → `HomeContent` 직접 결합

- Location: `src/components/main-shell.tsx` (import 및 JSX)
- Category: coupling
- Description: 헤더·drawer 상태는 `MainShell`에 있고, 사이드바·drawer 마크업은 `HomeContent`에 있다. **크롬을 한 트리로 쓰기엔 응집도가 높지만**, `MainShell`이 특정 자식 컴포넌트 타입에 고정되어 교체·테스트 시 결합이 생긴다.
- Suggestion: 현재 규모에서는 수용 가능. 분리가 필요해지면 `MainShell`이 `sidebar`/`drawerPanel` 슬롯 props를 받거나, `HomeContent`를 `main-shell-inner.tsx` 등으로 rename·병합해 이름과 책임을 맞춘다.

### [LOW] 탭 애니메이션이 전역 CSS 키프레임에 의존

- Location: `src/app/globals.css` (`@keyframes tab-panel-in`), `src/components/main-transcript-tabs.tsx` (inline `animation` 참조)
- Category: dependency / structure
- Description: 키프레임 이름이 전역 네임스페이스를 쓴다. 지금은 단일 애니메이션이라 충돌 위험은 낮다.
- Suggestion: 애니메이션이 늘면 CSS 모듈·Tailwind 플러그인·공유 상수로 키프레임 이름을 한곳에서 관리한다.

## Code Style Findings

### [LOW] `HomeContent`가 drawer 전이 상태까지 담당 (SRP 경계)

- Location: `src/components/home-content.tsx` (`drawerVisible` / `drawerEntered`, `useEffect`, `requestAnimationFrame` / `setTimeout`)
- Category: readability / solid
- Description: 레이아웃 마크업과 **열림/닫힘 전이 오케스트레이션**이 한 파일에 있다. 응집은 있으나 파일이 길어지고 단위 테스트·재사용 시 관심사가 섞여 보일 수 있다.
- Suggestion: `useDrawerEnterExit(drawerOpen, reducedMotion)` 같은 훅으로 전이 로직만 추출하면 SRP와 가독성이 좋아진다.

### [LOW] `usePrefersReducedMotion` 초기값과 주석 계약

- Location: `src/hooks/use-prefers-reduced-motion.ts` (주석, `useState(false)`)
- Category: typescript / readability
- Description: SSR 첫 렌더에서 `false`로 두는 정책이 주석으로 잘 설명되어 있다. 팀 전체가 “하이드레이션 전에는 모션 허용”을 받아들이는지 정책 문서에 한 줄 있으면 더 안전하다.
- Suggestion: 변경 없이도 무방. 필요 시 `docs/CONVENTIONS.md`에 한 줄 추가.

### [LOW] `TabPanelBody`의 `variantClass` 매핑

- Location: `src/components/tab-panel-body.tsx`
- Category: typescript / readability
- Description: `Record<TabPanelBodyVariant, string>`로 변형별 클래스를 한곳에 모아 **일관성과 확장**에 유리하다. 네이밍·props(`scrollClassName`)가 역할을 잘 드러낸다.

## Verdict

**PASS_WITH_NOTES**

`docs/ARCHITECTURE.md`의 브라우저 UI·로컬 세션 경계를 침범하지 않고, 계획서의 Route Group·공통 레이아웃·탭 본문 통일·reduced-motion 공유 훅이 구조적으로 타당하다. 남는 이슈는 **`HomeContent` 명칭**, **홈/세션의 셸 진입 패턴 정리**, **drawer 전이 로직의 선택적 추출** 정도의 정리 항목 수준이다.
