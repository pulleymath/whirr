---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  subagent_model: "fast"
  feature: "feature-8-ui-refinement"
  review_kind: implementation
---

# Implementation & Test Review

## Summary

계획서의 다섯 영역(세션 목록 활성 하이라이트, drawer·딤 모션·reduced-motion, 탭 전환 모션, `TabPanelBody`로 본문 통일, `(main)` 라우트 그룹 + `MainShell`)이 코드상 모두 반영되어 있으며, Vitest 계약 테스트는 핵심 동작을 잘 짚는다. 다만 Step 4·5에서 계획이 기대한 **레이아웃/활성 상태 통합 단언**은 일부 생략되어 있어, 완료 조건 전부를 테스트로 고정하지는 못한 상태다.

## Plan Compliance

| Plan Item                                                               | Status  | Notes                                                                                                                                                                                       |
| ----------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 1: `SessionList` + `usePathname` 활성(`aria-current`, 시각 클래스) | PASS    | `pathname` 디코딩으로 인코딩된 id와 매칭, 그룹 `nav`/`section`/`h2`/`ul` 구조 유지                                                                                                          |
| Step 1 RED: 경로별 `aria-current`, 포커스 가능 구분                     | PASS    | `/sessions/abc`·`/`·`focus-visible` 클래스 검증                                                                                                                                             |
| Step 2: drawer 슬라이드·딤·닫힘 이징·reduced-motion                     | PASS    | `transition-transform`/`transition-opacity`, `usePrefersReducedMotion`로 클래스 제거                                                                                                        |
| Step 2 RED: 전환 클래스·reduced-motion                                  | PARTIAL | 열림 상태·패널 전환·reduced 시 패널 전환 제거 검증; 백드롭은 reduced 시 동일하게 전환 문자열 제거되나 단언 없음; `data-state` 등은 미사용(계획은 예시 수준)                                 |
| Step 3: 탭 전환 짧은 opacity 모션                                       | PASS    | `globals.css` `@keyframes tab-panel-in` + 인라인 `animation`, reduced 시 스타일 없음                                                                                                        |
| Step 3 RED: 모션·reduced                                                | PASS    | `tab-panel-in` 문자열·`style` null 검증                                                                                                                                                     |
| Step 4: `TabPanelBody`로 스크롤·패딩·타이포 기준 통일                   | PASS    | `TranscriptView`/`SummaryTabPanel`이 공통 래퍼 사용                                                                                                                                         |
| Step 4 RED: 본문·빈/로딩/에러 패턴 동일성                               | PARTIAL | `data-testid="tab-panel-body"` 존재 위주; 상태별(로딩·에러·빈) **동일 레이아웃 패턴**을 각각 단언하는 테스트는 계획 대비 얕음                                                               |
| Step 5: `(main)` route group + 홈/세션 동일 셸                          | PARTIAL | `(main)/layout.tsx`는 `main` 래퍼만; 실제 헤더·History는 `MainShell`이 홈(`HomePageShell`)·세션 페이지 각각에서 사용—기능은 충족, 계획 옵션 A의 “레이아웃에서 셸 렌더”와는 구조가 약간 다름 |
| Step 5 RED: 세션 경로에서 헤더·History·활성 하이라이트                  | PARTIAL | `pathname` 변경 시 drawer 닫힘·햄버거 `md:hidden` 검증; **Whirr 제목·사이드바 존재** 및 세션 페이지에서의 **활성 항목**은 단위 테스트로는 `SessionList`에 한정                              |
| 완료 조건(이슈 3항)                                                     | PASS\*  | 구현으로 충족 의도는 명확; 시각적 ChatGPT 유사도·일관성은 수동/시각 회귀 의존                                                                                                               |

## Findings

### [MEDIUM] Step 5 통합 검증 범위가 계획 RED보다 좁음

- Location: `src/components/__tests__/home-page-shell.test.tsx`
- Description: 계획은 세션 경로를 모킹한 채 헤더 타이틀·History 토글·사이드바·`SessionList` 활성 하이라이트까지 검증하라고 했으나, 현재는 drawer가 pathname 변경으로 닫히는 동작과 트리거 버튼 반응형 클래스 위주다.
- Suggestion: `MainShell`에 목업 `children`을 넣고 `getByRole("heading", { name: /Whirr/i })`, 데스크톱 `aside`·모바일 drawer 트리거, 필요 시 `SessionList`+`pathnameRef`로 활성 링크를 한 번에 검증하는 스모크 테스트 추가.

### [MEDIUM] Drawer 닫힘 시 `setTimeout`(220ms)과 CSS duration 동기화가 암묵적

- Location: `src/components/home-content.tsx` (대략 46–51행)
- Description: `transitionend` 대신 고정 지연으로 언마운트해 라우트 전환과 맞추는 방식은 동작하지만, Tailwind `duration-200`(200ms)과 숫자가 코드 두 곳에 흩어져 있어 한쪽만 바꾸면 닫힘 애니메이션이 잘리거나 빈 프레임이 남을 수 있다.
- Suggestion: 지연 시간을 `duration`과 공유하는 상수로 두거나, `transitionend`(캡처/타깃 필터)로 정리.

### [LOW] `usePrefersReducedMotion`의 SSR 초기값과 첫 클라이언트 페인트

- Location: `src/hooks/use-prefers-reduced-motion.ts`
- Description: 주석대로 첫 렌더는 `false`라 reduced-motion 사용자에게 아주 짧은 “모션 허용” UI가 한 틱 보일 수 있다. 계획의 CSS `motion-reduce:` 경로는 이런 플래시를 줄이는 데 유리하다.
- Suggestion: drawer/탭에 중요한 경우 `motion-reduce:` 유틸을 보조로 두거나, `matchMedia` 전까지 transition을 최소화하는 정책 검토.

### [LOW] Step 4 테스트가 타이포·상태별 레이아웃 패리티를 거의 검증하지 않음

- Location: `src/components/__tests__/transcript-view.test.tsx`, `src/components/__tests__/summary-tab-panel.test.tsx`
- Description: `tab-panel-body` 사용은 확인되나, 계획의 “동일 `max-w`·패딩·중앙 정렬 계열” 및 본문 `text-*`/`leading-*` 샘플 단언은 빠져 있다. 구현은 `TabPanelBody` 내부 스크롤 영역에 공통 `text-sm leading-relaxed`를 두는 등 방향은 맞다.
- Suggestion: `error`/`summarizing`/`idle` 각각에서 스크롤 루트 클래스 스냅샷 또는 공통 클래스 부분 문자열 검증 한두 개 추가.

### [LOW] `structure.test`가 세션 상세 페이지 경로를 검사하지 않음

- Location: `src/__tests__/structure.test.ts`
- Description: `(main)/page.tsx` 존재만 검사; `(main)/sessions/[id]/page.tsx`는 없다. 회귀 방지 측면에서 선택적 보강 여지.
- Suggestion: 세션 페이지 파일 경로 assert 한 줄 추가.

## Test Coverage Assessment

- **강점**: `usePathname` 모킹으로 활성 링크, `matchMedia` 모킹으로 drawer·탭의 reduced-motion 분기, 탭 패널의 `tab-panel-in` 계약이 명확하다. 중복 `data-testid` 없이 활성 패널만 모션 래퍼를 렌더해 `getByTestId`가 안정적이다.
- **간극**: Step 4의 “상태별 동일 패턴”과 Step 5의 “세션 라우트에서의 전체 셸 + 활성 목록”은 구현 대비 테스트가 얕다. drawer 테스트는 reduced 시 백드롭의 `transition-opacity` 제거를 단언하지 않는다(구현상 함께 제거됨).

## Verdict

**PASS_WITH_NOTES** — 기능·완료 조건은 구현으로 대체로 충족하고, 계획 Step 1–3과 훅 재사용은 요구와 잘 맞는다. 다만 Step 4·5의 계획된 RED 범위 전체를 테스트가 덮지는 못하며, drawer 닫힘 타이밍은 유지보수 시 깨지기 쉬운 암묵적 결합이 있다.
