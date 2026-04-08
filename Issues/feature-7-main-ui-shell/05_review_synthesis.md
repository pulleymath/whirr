---
issue_driven_dev:
  source: subagent
  phase: synthesis
  subagent_type: generalPurpose
  subagent_model: "Auto"
  feature: "feature-7-main-ui-shell"
---

# Review Synthesis

## Overall Quality Score

**B** — 기능·레이아웃·전체 테스트(117개)는 요구를 충족하지만, 계획 대비 Step 4·5 테스트 공백과 `HomePageShell`의 경로 동기화 방식이 세 도메인에서 동시에 지적되어 완성도와 회귀 방지 측면에서 한 단계 남습니다.

## Executive Summary

구현 리뷰와 아키텍처 리뷰는 계획서 대비 **드로어·사이드바 테스트 깊이**와 **`usePathname` 기반 드로어 닫힘을 `useEffect`가 아닌 렌더 중 `setState`로 처리한 점**에서 겹칩니다. 보안 리뷰는 신규 경계 위반이나 XSS 등은 없다고 보고, 동일 pathname 패턴을 **성능·안정성(추가 렌더, Strict Mode 민감도)** 관점에서 정리할 것을 권합니다. 종합하면 머지 직전·직후에 짧은 수정으로 묶을 수 있는 **FIX_THEN_SHIP** 구간입니다.

## Consolidated Findings

### Immediate Fixes Required (CRITICAL/HIGH)

| #   | Finding                                                                                                                     | Source               | Severity | Category                 |
| --- | --------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------- | ------------------------ |
| 1   | `HomePageShell`에서 pathname 변경 시 렌더 본문에서 `setPathnameSeen` / `setDrawerOpen(false)` 호출(계획은 `useEffect` 기반) | impl, arch, security | **HIGH** | correctness / React 패턴 |
| 2   | Step 4: 계획의 `matchMedia`·트리거 열기·`usePathname` 변경 시 드로어 닫힘 미검증; props로만 dialog 검증                     | impl, arch           | **HIGH** | 테스트 / 계획 준수       |

#### 1. 렌더 중 pathname·드로어 상태 동기화

- Original severity: 구현 **MEDIUM**, 아키텍처 **Important(수정 권장)**, 보안·성능 **LOW**
- Adjusted severity: **HIGH** (다중 리뷰어 + 구조적 권장사항과 결합)
- Location: `src/components/home-page-shell.tsx` (pathname 분기)
- Action: `useEffect(() => { setDrawerOpen(false); }, [pathname])` 등으로 이전. 계획서(`01_plan.md`)와 동일 패턴으로 맞추는 것을 권장.

#### 2. History drawer 테스트와 계획 불일치

- Original severity: 구현 **HIGH**, 아키텍처 **Important**
- Adjusted severity: **HIGH**
- Location: `src/components/__tests__/history-drawer.test.tsx`, 연동 `home-page-shell.tsx`
- Action: `HomePageShell`을 렌더하고 `next/navigation`의 `usePathname` 모의 값을 `/` → `/sessions/x` 등으로 바꾼 뒤 드로어가 닫히는지 검증. `(min-width: 768px)` 분기는 `matchMedia` 스텁으로 고정하고, 트리거 클릭으로 열리는 흐름을 포함.

### Recommended Improvements (MEDIUM)

| #   | Finding                                                                                                 | Source   | Category                |
| --- | ------------------------------------------------------------------------------------------------------- | -------- | ----------------------- |
| 1   | 비활성 탭에서도 transcript 패널이 마운트·갱신되어 숨겨진 패널까지 비용 발생                             | security | performance / rendering |
| 2   | Step 5: 사이드바 테스트가 `aside` 클래스 위주; `SessionList`·`refreshTrigger`·드로어 트리거 숨김 미검증 | impl     | 테스트 / 계획 준수      |
| 3   | `main-transcript-tabs.tsx`에서 `React.ReactNode` 사용 시 `React` 네임스페이스 import 부재 가능성        | arch     | TypeScript / 컨벤션     |
| 4   | `Recorder`가 녹음·STT·저장·요약·탭 조합까지 담당해 단일 책임이 무거움                                   | arch     | 구조 / 유지보수         |

### Optional Enhancements (LOW)

- `recorder.tsx` 저장 실패 시 `console.error`에 원본 예외 객체 전체 로깅 → 메시지 위주로 축약(보안·데이터 취급).
- Step 1에서 슬롯 대신 모킹 `TranscriptView`로 `data-testid` 단언(통합 회귀 선택).
- 탭 패널의 `hidden` 속성과 `className`의 `hidden` 중복 정리(아키텍처 제안).
- `deriveSummaryTabState`를 `src/lib/`로 분리는 선택; PR과 무관한 `docs/*`·기타 테스트 포맷 diff는 이후 PR로 분리(리뷰 부담 완화).

## Cross-Domain Observations

- **pathname·드로어 로직**이 구현(계획 이탈)·아키텍처(React 권장 패턴)·성능(추가 렌더)에서 한 줄로 수렴하는 **시스템 이슈**입니다. 한 번 고치면 세 영역이 동시에 정리됩니다.
- **“테스트는 통과, 계획 RED 시나리오는 미달”** 패턴이 Step 4·5에 반복됩니다. 기능은 구현되어 있으나 **회귀 방지가 약한 상태**로, 아키텍처 리뷰의 “머지 전·직후 손보기”와 정합합니다.
- 보안 측면에서는 **새 공격면이 크지 않고**, 남은 것은 로깅·렌더링 비용 같은 **하드닝·최적화**에 가깝습니다.

## Deduplicated Items

- **렌더 중 pathname 동기화**: 구현(MEDIUM), 아키텍처(Important), 보안·성능(LOW) → 위 표 **#1** 한 건으로 통합, 심각도 **HIGH**로 상향.
- **Step 4 drawer / pathname 테스트 부족**: 구현(HIGH), 아키텍처(Important) → **#2** 한 건으로 통합.

## Conflicts Resolved

- **심각도 해석**: pathname 패턴에 대해 구현은 MEDIUM, 보안은 LOW였으나 아키텍처가 “수정 권장”이고 다중 리뷰 겹침 규칙에 따라 **HIGH**로 통일했습니다.
- **구조 vs 정확성**: 구조·패턴은 아키텍처 리뷰 의견을 따르고, “동작이 맞는가”에 대한 구현 리뷰의 지적(계획과 다른 구현)은 **동일 수정(useEffect 등)**으로 함께 해소됩니다. 상충되는 “그대로 둔다” 의견은 없습니다.

## Final Verdict

**FIX_THEN_SHIP**

### Rationale

CRITICAL급 보안·아키텍처 붕괴는 없고 전체 테스트도 통과하지만, **다중 리뷰에서 공통으로 지적된 pathname·드로어 동기화 방식**과 **계획 Step 4에 해당하는 실제 닫힘 로직 검증 부재**는 머지 후 회귀 비용을 키울 수 있습니다. 이 두 가지를 반영한 뒤 배포·머지하는 것이 합리적이며, 나머지는 MEDIUM/LOW로 후속 PR로 넘겨도 **SHIP**에 가깝게 정리할 수 있습니다. 전면 재설계 수준은 아니므로 **MAJOR_REVISION_NEEDED**는 아닙니다.
