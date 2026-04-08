---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  subagent_model: "fast"
  feature: "feature-8-ui-refinement"
---

# Feature 8: UI 개선 — 개발 계획서

이 문서는 `Issues/feature-8-ui-refinement/00_issue.md`의 **2.1~2.4 상세 기획**과 **3. 완료 조건**을 구현 가능한 단위로 쪼개고, Vitest 기반 TDD 순서와 파일 단위 변경을 정의한다. 구현 전 `docs/CONVENTIONS.md`, `docs/TESTING.md`, `docs/CODEMAP.md`를 확인한다.

## 개발 범위

| 영역               | 요약                                                                                                                        | 이슈 대응 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------- |
| **History 목록**   | `SessionList`의 그룹 헤더·항목 타이포·구분선·호버·포커스·**현재 경로(`/sessions/[id]`)와 일치하는 항목 강조**               | 2.1       |
| **Drawer·딤**      | 모바일 History 패널 **슬라이드·배경 딤 페이드**, 닫힘 시에도 동일 이징; **`prefers-reduced-motion: reduce` 시 전환 최소화** | 2.2       |
| **탭 모션**        | `MainTranscriptTabs`에서 실시간 전사 ↔ 요약 전환 시 **짧은 opacity 또는 슬라이드 중 하나**, 과한 모션 금지                  | 2.2       |
| **탭 본문 일관성** | `TranscriptView`와 `SummaryTabPanel`의 **패딩·스크롤 컨테이너·본문 타이포·빈/로딩/에러 상태** 레이아웃 통일                 | 2.3       |
| **공통 레이아웃**  | `/`와 `/sessions/[id]`가 **동일 헤더 + 데스크톱 사이드바 + 모바일 drawer**를 공유; 세션 상세만 본문 영역에서 교체           | 2.4       |

**범위 밖·최소화**: 데이터 페칭·STT·녹음 로직 변경 없음. 탭/헤더 라벨 문구 변경은 필요 시만.

## 기술적 접근 방식

1. **라우팅·활성 상태**
   - `next/navigation`의 `usePathname()`으로 현재 경로를 읽고, `SessionList`의 각 `Link`(`href="/sessions/{id}"`)와 비교해 **활성 항목**에 `aria-current="page"` 및 시각적 클래스를 부여한다.
   - 테스트에서는 `next/navigation` 모킹으로 경로를 고정한다.

2. **애니메이션**
   - 우선 **Tailwind `transition-*`, `duration-*`, `ease-*`** 및 필요 시 **`transform translate`**로 drawer 패널·백드롭 opacity를 제어한다.
   - `prefers-reduced-motion`은 **`@media (prefers-reduced-motion: reduce)`** 또는 Tailwind의 `motion-reduce:` 변형으로 **transition duration을 0 또는 극단적으로 짧게** 두거나 transform을 생략한다.
   - 프로젝트에 vaul 등이 있으면 drawer에 이미 맞는 API가 있는지 확인 후 **중복 라이브러리 추가는 피한다**.

3. **탭 전환**
   - 활성 패널 래퍼에 `key={activeTab}` 또는 단일 래퍼에 **opacity + 짧은 duration**으로 콘텐츠 전환을 표현한다. reduced-motion 시 즉시 전환.

4. **본문 일관성**
   - 공통 **콘텐츠 스캐폴드** 컴포넌트(예: `tab-panel-body.tsx`) 또는 **공유 className 상수**로 `min-h-0`, `overflow-auto`, 좌우 패딩, `max-w-*`를 한곳에서 정의하고 `TranscriptView` / `SummaryTabPanel` 내부 루트에 적용한다.
   - 빈·로딩·에러는 **같은 수직 중앙/카드 패턴**과 문구 계층(`text-sm` 등)을 맞춘다.

5. **공통 레이아웃**
   - **옵션 A**: `src/app/(main)/layout.tsx` 같은 **Route Group**으로 `page.tsx`와 `sessions/[id]/page.tsx`를 묶고, 레이아웃에서 기존 `HomePageShell`과 동일한 구조를 렌더한 뒤 `children`에 홈 콘텐츠 vs `SessionDetail`만 넣는다.
   - **옵션 B**: `AppMainShell`(또는 이름 통일) 컴포넌트를 `src/components/`에 두고 `page.tsx`·`sessions/[id]/page.tsx`에서 각각 감싼다.
   - 중복을 줄이려면 **옵션 A를 우선** 검토한다. `HomePageShell`이 헤더+`HomeContent`만 담당한다면, 레이아웃에서는 **헤더+사이드바/drawer 래퍼**와 **`children` 슬롯**으로 분리해 홈은 기존 `HomeContent`의 메인 컬럼만, 세션 페이지는 `SessionDetail`만 주입한다.

## TDD 구현 순서

### Step 1: SessionList — ChatGPT 느낌의 목록 스타일 및 활성 경로 하이라이트

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/session-list.test.tsx`
- 테스트 케이스 목록
  - `usePathname`이 `/sessions/abc`일 때 `href`가 `/sessions/abc`인 항목에 **활성 스타일 또는 `aria-current="page"`**가 있는지 검증한다.
  - 다른 경로(예: `/`)일 때는 어떤 세션 항목도 `aria-current="page"`를 갖지 않는다(또는 정책에 맞게 홈만 예외 처리 시 문서화).
  - 날짜 그룹 헤더·항목이 **시맨틱 역할**(목록/헤딩)과 접근 가능한 이름을 유지하는지 스냅샷 또는 역할 기반 검증(기존 테스트 패턴에 맞춤).
  - 호버·포커스 가능 요소가 **키보드 포커스** 시 구분 가능한지(필요 시 `focus-visible` 클래스 존재 여부).

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/session-list.tsx`(및 필요 시 공유 스타일만 `src/components/` 내 소량 모듈)
- 핵심 구현 내용
  - `usePathname()`으로 현재 경로를 읽고, 각 세션 링크의 `href`와 비교해 활성 항목에 클래스·`aria-current` 적용.
  - 그룹 헤더·항목 간격·구분선·타이포·색상을 이슈 2.1 방향으로 조정(픽셀 복제가 아닌 계층 정리).

**REFACTOR** — 코드 개선

- 반복되는 링크/행 마크업을 소컴포넌트로 분리하거나, tailwind 클래스를 의미 있는 단위로 묶는다.
- 활성 판별 로직을 `pathname === href` 정규화(트레일링 슬래시 등)가 필요하면 한 함수로 모은다.

---

### Step 2: 모바일 History drawer·백드롭 애니메이션 및 `prefers-reduced-motion`

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/history-drawer.test.tsx`(및 필요 시 `src/components/__tests__/home-content-layout.test.tsx`)
- 테스트 케이스 목록
  - drawer 열림 상태에서 패널·백드롭에 **전환 관련 클래스 또는 `data-*` 속성**(예: `data-state=open`)이 기대대로 붙는지 검증한다.
  - `window.matchMedia('(prefers-reduced-motion: reduce)')`를 모킹했을 때 **장시간 transition 클래스가 제거되거나 `motion-reduce:` 경로**가 적용되는지 확인한다(구현 방식에 맞게 속성/클래스 단언).

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/home-content.tsx`, 필요 시 `src/components/home-page-shell.tsx`
- 핵심 구현 내용
  - 오버레이·패널에 `transform`/`opacity` transition과 일관된 `duration`·`ease` 적용; 닫힘 동작도 동일 이징.
  - `prefers-reduced-motion` 대응: CSS 미디어 쿼리 또는 클라이언트 훅으로 reduced 시 transition 비활성/단축.

**REFACTOR** — 코드 개선

- 애니메이션 관련 class 문자열을 상수화하거나, 작은 `usePrefersReducedMotion` 훅으로 분리해 탭 모션에서 재사용한다.

---

### Step 3: 실시간 전사 ↔ 요약 탭 전환 모션

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/main-transcript-tabs.test.tsx`
- 테스트 케이스 목록
  - 탭 전환 후 활성 패널 래퍼에 **전환용 클래스**(예: `transition-opacity`) 또는 `data-active`와 연계된 스타일이 존재하는지 검증한다.
  - reduced-motion 모킹 시 **즉시 전환/무애니메이션**에 해당하는 마크업·클래스를 기대한다.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/main-transcript-tabs.tsx`
- 핵심 구현 내용
  - 활성 탭 콘텐츠 영역에 짧은 opacity(또는 미세한 slide) 전환 한 가지 방식만 적용; 인디케이터만 하는 대안을 택한 경우 이 계획서 **완료 조건**에 한 줄로 명시.

**REFACTOR** — 코드 개선

- Step 2에서 도입한 reduced-motion 훅/유틸과 중복 제거.

---

### Step 4: 전사 탭·요약 탭 본문 레이아웃·타이포·빈 상태 일관성

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/transcript-view.test.tsx`, `src/components/__tests__/summary-tab-panel.test.tsx`
- 테스트 케이스 목록
  - 두 컴포넌트의 **본문 스크롤 영역**이 동일한 루트 클래스(또는 공통 `data-testid="tab-panel-body"`)를 사용하는지 검증한다.
  - 빈 상태·로딩·에러 UI가 **같은 레이아웃 패턴**(예: 동일 `max-w`, 좌우 패딩, 중앙 정렬 계열)을 공유하는지 확인한다.
  - 본문 텍스트에 동일 계열 `text-*`·`leading-*`가 적용되는지 샘플 렌더 단언.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/transcript-view.tsx`, `src/components/summary-tab-panel.tsx`, 필요 시 `src/components/tab-panel-body.tsx`(신규) 또는 공유 상수 파일
- 핵심 구현 내용
  - 공통 래퍼로 패딩·`overflow-y-auto`·`min-h-0`·최대 너비 정렬 통일.
  - 마크다운/플레이스홀더와 전사 블록의 기본 글자 크기·줄간·본문 색 통일.

**REFACTOR** — 코드 개선

- 공통 래퍼 한 컴포넌트로 추출해 향후 탭 추가 시 재사용.

---

### Step 5: `/sessions/[id]` — 홈과 동일한 헤더·History 공유 레이아웃

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/home-page-shell.test.tsx` 확장, 또는 `src/components/__tests__/session-detail.test.tsx`·**라우트 레벨 통합 테스트**(프로젝트에 페이지 테스트 관례가 있으면 `src/app/...` 근처) 중 선택
- 테스트 케이스 목록
  - 세션 상세 경로를 모킹한 채 **헤더 타이틀(Whirr 등)·History 토글(모바일)·사이드바 영역**이 렌더되는지 검증한다.
  - `SessionList`가 세션 페이지에서도 렌더될 때 **Step 1의 활성 하이라이트**가 현재 `id`와 일치하는지 검증한다.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/app/` 하위 레이아웃(예: `src/app/(main)/layout.tsx`), `src/app/page.tsx`, `src/app/sessions/[id]/page.tsx`, `src/components/home-page-shell.tsx` / 신규 `app-main-shell`류
- 핵심 구현 내용
  - 홈과 세션 상세가 **동일 레이아웃 트리**를 타도록 분리; 세션 페이지에서만 본문에 `SessionDetail` 배치.
  - 기존 “헤더 없는 풀스크린” 세션 페이지 구성이 있으면 제거.

**REFACTOR** — 코드 개선

- `HomePageShell` vs 레이아웃 책임 경계를 명확히 하고, 네이밍·import를 `docs/CONVENTIONS.md`에 맞게 정리.

## 파일 변경 계획

| 파일/경로                                                | 변경 유형      | 비고                                   |
| -------------------------------------------------------- | -------------- | -------------------------------------- |
| `src/components/session-list.tsx`                        | 수정           | `usePathname`, 활성·스타일             |
| `src/components/home-content.tsx`                        | 수정           | drawer·딤 transition, reduced-motion   |
| `src/components/home-page-shell.tsx`                     | 수정 또는 축소 | 레이아웃 분리 시 `children` 슬롯화 등  |
| `src/components/main-transcript-tabs.tsx`                | 수정           | 탭 전환 모션                           |
| `src/components/transcript-view.tsx`                     | 수정           | 본문 스캐폴드 정렬                     |
| `src/components/summary-tab-panel.tsx`                   | 수정           | 동일 스캐폴드                          |
| `src/components/tab-panel-body.tsx`(예시명)              | 신규(선택)     | 공통 본문 래퍼                         |
| `src/app/page.tsx`                                       | 수정           | 새 레이아웃에 맞게 children 구조 조정  |
| `src/app/sessions/[id]/page.tsx`                         | 수정           | 공통 레이아웃 하에서 `SessionDetail`만 |
| `src/app/(main)/layout.tsx` 또는 동등                    | 신규(권장)     | Route Group으로 공통 셸                |
| `src/components/__tests__/session-list.test.tsx`         | 수정           | 활성 경로·a11y                         |
| `src/components/__tests__/history-drawer.test.tsx`       | 수정           | 애니메이션·reduced-motion              |
| `src/components/__tests__/main-transcript-tabs.test.tsx` | 수정           | 탭 모션                                |
| `src/components/__tests__/transcript-view.test.tsx`      | 수정           | 본문 일관성                            |
| `src/components/__tests__/summary-tab-panel.test.tsx`    | 수정           | 본문 일관성                            |
| `src/components/__tests__/home-page-shell.test.tsx` 등   | 수정           | 레이아웃 공유 검증                     |

## 완료 조건

`00_issue.md` **3. 완료 조건**과 동일하게 검수한다.

- [ ] History(사이드바·drawer 동일 목록)가 그룹·항목·선택·호버가 정돈되어 ChatGPT 스타일 **참고**에 맞는다.
- [ ] 모바일 History drawer 열림/닫힘·딤에 **의도된 애니메이션**이 있고 `prefers-reduced-motion`이 반영된다.
- [ ] 실시간 전사 / 요약 탭 전환에 **과하지 않은** 모션이 있거나, 합의된 대안이 **이 계획서 또는 이슈에** 한 줄로 문서화된다.
- [ ] 두 탭 **본문**의 패딩·스크롤·기본 타이포·빈 상태 레이아웃이 **시각적으로 일관**된다.
- [ ] `/sessions/[id]`에서 홈과 동일하게 **헤더 + History(사이드바/drawer)** 가 보이고 내비게이션이 자연스럽다.

추가 게이트: `pnpm test`(또는 프로젝트 스크립트) 전부 통과, 린트·타입 체크 통과.

## 테스트 전략

- **러너·도구**: Vitest, React Testing Library(`docs/TESTING.md` 준수).
- **단위**: `SessionList`, drawer 마크업, `MainTranscriptTabs`, `TranscriptView`, `SummaryTabPanel` 각각에서 **동작·접근성·클래스 계약**을 검증한다.
- **모킹**: `next/navigation`의 `usePathname`(및 필요 시 `useRouter`), `matchMedia`로 `prefers-reduced-motion` 시나리오를 재현한다.
- **통합**: 레이아웃 공유(Step 5)는 셸 컴포넌트에 **세션 자식을 끼워 넣는 스모크 렌더**로 헤더·사이드바 존재를 검증; E2E가 있으면 한 시나리오로 `/` ↔ `/sessions/[id]` 이동 시 헤더 유지만 추가 검토한다.
- **시각적 회귀**: 자동화가 없으면 수동으로 모바일·데스크톱 뷰포트에서 drawer·탭·세션 페이지를 각각 확인한다.
