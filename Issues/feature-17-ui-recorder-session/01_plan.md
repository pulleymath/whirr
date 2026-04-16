---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "feature-17-ui-recorder-session"
---

# Feature 17 — 개발 계획서

## 개발 범위

### 포함

| 영역           | 변경 사항                                                                    |
| -------------- | ---------------------------------------------------------------------------- |
| 홈 녹음 버튼   | 시작=빨간 원, 중지=둥근 사각형, 상태 전환 시 `border-radius` 모핑 애니메이션 |
| 홈 탭          | 회의록 탭 제거 — `MainTranscriptTabs` 대신 `TranscriptView` 직접 렌더링      |
| 세션 상세 헤더 | "뒤로" 버튼·`<audio controls>` 제거 (오디오 다운로드 버튼 유지)              |
| 세션 상세 액션 | 복사·다시 생성·저장·다운로드 → `lucide-react` 아이콘 버튼으로 교체           |
| 세션 상세 패널 | 탭 본문 `<h2>` 제목("회의록", "스크립트") 제거                               |
| 공유 컴포넌트  | `IconButton` — 아이콘 전용 / 아이콘+텍스트 공유 버튼                         |
| 일관성         | 모든 클릭 가능 요소에 `cursor-pointer` 적용                                  |
| 접근성         | `aria-label` 기존 수준 유지·보강, `prefers-reduced-motion` 대응              |

### 제외

- 마이크 권한에 따른 상단 안내 문구 조건부 표시

### 의존성 추가

- `lucide-react`

## 기술적 접근 방식

1. **녹음 버튼** — `RecordButton` 전용 컴포넌트. 단일 div의 `border-radius`를 CSS `transition`으로 모핑하여 원(50%) ↔ 둥근 사각형(`rounded-md`) 전환. `usePrefersReducedMotion()` true 시 `transition-duration: 0ms`.

2. **홈 탭 제거** — `Recorder` 컴포넌트에서 `MainTranscriptTabs`·`SummaryTabPanel`을 제거하고 `TranscriptView`를 직접 렌더링. 후처리 파이프라인(`usePostRecordingPipeline`)은 유지한다(백그라운드 회의록 생성 + `isBusy` 잠금).

3. **세션 상세 정리** — `SessionDetailReadyContent`에서 "뒤로" 버튼과 `<audio>` 요소를 삭제. `audioUrl` 관련 `useMemo`/`useEffect`(ObjectURL) 정리. 다운로드 버튼 유지.

4. **아이콘 버튼** — 공유 `IconButton` 컴포넌트(`src/components/ui/icon-button.tsx`). `lucide-react` 아이콘·`aria-label`·size variant를 prop으로 받는다. 세션 상세의 복사(`Copy`)·저장(`Save`)·다시 생성(`RefreshCw`)·다운로드(`Download`) 버튼을 이 컴포넌트로 교체.

5. **h2 제목 제거** — 세션 상세 인라인 `summaryPanel`·`transcriptPanel`의 `<h2>`, `SummaryTabPanel` complete 상태의 "회의록" `<p>`를 삭제.

6. **cursor-pointer** — `IconButton`에 기본 적용. `MainTranscriptTabs` 탭 버튼, 기존 인라인 버튼에도 추가.

## TDD 구현 순서

### Step 1: lucide-react 의존성 추가

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/ui/__tests__/icon-button.test.tsx`
- `it("lucide-react 아이콘을 렌더링할 수 있다")` — `lucide-react`에서 `Copy` 아이콘을 import 후 렌더링하면 SVG가 DOM에 존재하는지 확인하는 스모크 테스트. 패키지 미설치 상태에서 import 실패.

**GREEN** — 테스트를 통과하는 최소 구현

- `npm install lucide-react`
- `package.json` dependencies에 `lucide-react` 추가 확인

**REFACTOR** — 코드 개선

- 없음 (의존성 추가만)

---

### Step 2: 공유 IconButton 컴포넌트 생성

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/ui/__tests__/icon-button.test.tsx`
- 테스트 케이스:
  - `it("아이콘과 aria-label을 렌더링한다")` — `Copy` 아이콘 + `aria-label="복사"` 전달 시 `role="button"` + SVG 존재 확인
  - `it("label prop이 있으면 아이콘 옆에 텍스트를 표시한다")` — `label="복사"` 전달 시 텍스트 노드 확인
  - `it("label이 없으면 아이콘만 표시하고 텍스트가 없다")`
  - `it("disabled이면 opacity가 낮아지고 클릭 핸들러가 호출되지 않는다")` — `disabled` + `onClick` spy 검증
  - `it("cursor-pointer 클래스가 기본 적용된다")` — className에 `cursor-pointer` 포함 확인
  - `it("disabled이면 cursor-not-allowed이다")`
  - `it("variant='ghost'이면 border/배경 없이 hover만 적용된다")`
  - `it("variant='outline'이면 border가 있다")`
  - `it("variant='primary'이면 emerald 배경이다")`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/ui/icon-button.tsx`
- Props 인터페이스:
  ```
  icon: LucideIcon
  ariaLabel: string
  label?: string
  variant?: 'ghost' | 'outline' | 'primary'   (기본 'outline')
  disabled?: boolean
  onClick?: () => void
  className?: string
  ```
- `cursor-pointer` 기본, `disabled` 시 `cursor-not-allowed opacity-50`
- variant별 Tailwind 클래스 맵 (`Record<string, string>`)

**REFACTOR** — 코드 개선

- variant 클래스 맵을 상수로 분리
- `type IconButtonProps`를 export하여 외부에서 재사용 가능하게

---

### Step 3: 녹음 버튼 리디자인 (원 ↔ 사각형 애니메이션)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/record-button.test.tsx`
- 테스트 케이스:
  - `it("mode='start'이면 원형 인디케이터(rounded-full)를 렌더링한다")` — `data-testid="record-indicator"` 요소의 className에 `rounded-full` 포함
  - `it("mode='stop'이면 둥근 사각형 인디케이터를 렌더링한다")` — `rounded-full`이 아닌 `rounded` 계열 클래스 확인
  - `it("mode='start'이면 aria-label이 '녹음 시작'이다")`
  - `it("mode='stop'이면 aria-label이 '녹음 중지'이다")`
  - `it("모션 허용 시 transition 클래스가 인디케이터에 적용된다")` — `transition` 관련 클래스 확인
  - `it("prefers-reduced-motion이면 transition 클래스가 없다")` — `matchMedia` mock
  - `it("disabled이면 클릭 핸들러가 호출되지 않는다")`
  - `it("cursor-pointer 클래스가 적용된다")`
  - `it("클릭 시 onClick이 호출된다")`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/record-button.tsx`
- Props: `mode: 'start' | 'stop'`, `disabled?: boolean`, `onClick: () => void`
- 구조:
  ```
  <button> (w-14 h-14, 원형 외곽, 배경)
    <div data-testid="record-indicator"> (w-6 h-6, bg-rose-500)
      mode='start' → rounded-full (원)
      mode='stop'  → rounded-md (둥근 사각형)
      transition: border-radius 200ms ease-in-out
    </div>
  </button>
  ```
- `usePrefersReducedMotion()` → true이면 transition 클래스 제거

**REFACTOR** — 코드 개선

- `recorder.tsx`의 기존 텍스트 버튼(`녹음 시작`, `중지`)을 `RecordButton`으로 교체
- 기존 `recorder-*.test.tsx`에서 `getByRole("button", { name: "녹음 시작" })` / `getByRole("button", { name: "녹음 중지" })` 패턴은 aria-label 기반이므로 영향 없음
- 버튼 텍스트(`getByText("녹음 시작")` 등)로 조회하는 테스트가 있다면 수정

---

### Step 4: 홈 화면 — 스크립트만 표시 (탭 제거)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-ui.test.tsx` (신규)
- 테스트 케이스:
  - `it("tablist가 렌더링되지 않는다")` — `screen.queryByRole("tablist")`가 null
  - `it("TranscriptView가 탭 없이 직접 렌더링된다")` — `data-testid="transcript-partial"` 존재 확인
  - `it("회의록 탭 버튼이 존재하지 않는다")` — `screen.queryByRole("tab", { name: "회의록" })`가 null
  - `it("파이프라인 처리 중 메시지는 여전히 표시된다")` — `pipeline.isBusy` 시 "이전 녹음을 처리 중" 문구 확인

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder.tsx`
- 변경:
  - `MainTranscriptTabs` + `SummaryTabPanel` import 제거
  - `deriveSummaryTabState` 함수 삭제 (더 이상 미사용)
  - `summaryUiState` 변수 삭제
  - `<MainTranscriptTabs transcriptPanel={...} summaryPanel={...} />` → `<TranscriptView .../>` 직접 렌더링
- 유지: `usePostRecordingPipeline` 호출 (백그라운드 회의록 생성 + `isBusy` 잠금)

**REFACTOR** — 코드 개선

- 사용하지 않는 import 정리 (`SummaryTabPanel`, `MainTranscriptTabs`)
- `SummaryTabPanel` 자체는 삭제하지 않음 (세션 상세에서 간접 활용 가능성 보류)
- `recorder.tsx`의 코드량 감소 확인

---

### Step 5: 세션 상세 — "뒤로" 버튼 및 오디오 미리듣기 제거

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/session-detail.test.tsx`
- 테스트 케이스:
  - `it("뒤로 버튼이 렌더링되지 않는다")` — `screen.queryByRole("button", { name: "뒤로" })`가 null (기존 "뒤로 버튼이 router.back을 호출한다" 테스트를 이 테스트로 교체)
  - `it("오디오 미리듣기가 렌더링되지 않는다")` — `screen.queryByLabelText("오디오 재생")`가 null
  - `it("오디오가 있으면 다운로드 버튼은 여전히 표시된다")` — 기존 `session-detail-audio.test.tsx`의 테스트와 중복 방지 위해 간단 확인

- 테스트 파일: `src/components/__tests__/session-detail-audio.test.tsx`
  - `it("audio 요소가 렌더링되지 않는다")` — 추가 확인

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/session-detail.tsx`
- `SessionDetailReadyContent`에서:
  - "뒤로" `<button onClick={onBack}>` 삭제
  - `<audio src={audioUrl} controls>` 삭제
  - `audioUrl` useMemo 삭제 (더 이상 ObjectURL 불필요)
  - `audioUrl` useEffect(cleanup) 삭제
- `SessionDetailReadyContent` props에서 `onBack`, `audioUrl` 제거
- `SessionDetailBody`에서 `useRouter`, `router.back()` 콜백 제거

**REFACTOR** — 코드 개선

- `Link` import이 더 이상 필요한지 확인 (에러/미존재 화면에서 아직 사용 중 → 유지)
- `useRouter` import 제거 가능 여부 확인
- 불필요한 import 정리

---

### Step 6: 세션 상세 — 아이콘 기반 액션 버튼

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/session-detail.test.tsx`
- 테스트 케이스:
  - `it("스크립트 복사 버튼에 lucide 아이콘 SVG가 있다")` — 스크립트 탭 전환 후 복사 버튼 내 SVG 존재 확인
  - `it("스크립트 저장 버튼에 lucide 아이콘 SVG가 있다")`
  - `it("회의록 전체 복사 버튼에 lucide 아이콘 SVG가 있다")`
  - `it("다시 생성 버튼에 lucide 아이콘 SVG가 있다")`
  - `it("오디오 다운로드 버튼에 lucide 아이콘 SVG가 있다")`
  - `it("아이콘 버튼의 기존 aria-label이 유지된다")` — "스크립트 텍스트 복사", "회의록 전체 복사" 등

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/session-detail.tsx`
- lucide-react import: `Copy`, `RefreshCw`, `Save`, `Download`
- 기존 인라인 `<button>` → `IconButton` 컴포넌트 교체:
  | 기존 | 아이콘 | aria-label |
  |------|--------|-----------|
  | "복사" / "복사됨" | `Copy` | 스크립트 텍스트 복사 |
  | "전체 복사" / "복사됨" | `Copy` | 회의록 전체 복사 |
  | "다시 생성" / "생성 중…" | `RefreshCw` | 다시 생성 |
  | "스크립트 저장" / "저장 중…" | `Save` | 스크립트 저장 |
  | "오디오 다운로드" / "다운로드 중..." | `Download` | 오디오 다운로드 |
- 상태 피드백(복사됨, 저장 중 등)은 `IconButton`의 `label` prop 전환 또는 아이콘 교체(`Check`)로 표현

**REFACTOR** — 코드 개선

- 인라인 button 스타일 코드 대폭 감소 확인
- 상태별 아이콘 전환 패턴을 헬퍼로 추출 가능한지 검토
- 복사됨 상태의 `Check` 아이콘 사용 검토 (`lucide-react`의 `Check`)

---

### Step 7: 세션 상세 — 패널 본문 h2 제목 제거

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/session-detail.test.tsx`
  - `it("회의록 탭 패널에 h2 '회의록' 제목이 없다")` — `screen.queryByRole("heading", { level: 2, name: "회의록" })`가 null (회의록 탭 내부)
  - `it("스크립트 탭 패널에 h2 '스크립트' 제목이 없다")` — 스크립트 탭 전환 후 `screen.queryByRole("heading", { level: 2, name: "스크립트" })`가 null

- 테스트 파일: `src/components/__tests__/summary-tab-panel.test.tsx`
  - `it("complete 상태에서 '회의록' 텍스트 헤딩이 없다")` — complete 상태 렌더 시 "회의록" 텍스트 노드 부재

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/session-detail.tsx`
  - `summaryPanel` 내 `<h2 className="...">회의록</h2>` 삭제 (line ~279)
  - `transcriptPanel` 내 `<h2 className="...">스크립트</h2>` 삭제 (line ~349)
- 구현 파일: `src/components/summary-tab-panel.tsx`
  - `complete` 상태의 `<p className="mb-3 ...">회의록</p>` 삭제 (line ~58–59)

**REFACTOR** — 코드 개선

- 제목 제거 후 남은 wrapper div의 spacing(`mt`, `mb`, `gap`) 조정
- `TranscriptView`의 `showHeading` prop — 세션 상세는 `TranscriptView`를 쓰지 않으므로(자체 `<textarea>`) 영향 없음 확인

---

### Step 8: cursor-pointer 및 접근성 마무리

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/main-transcript-tabs.test.tsx`
  - `it("탭 버튼에 cursor-pointer 클래스가 있다")` — 두 탭 모두 className에 `cursor-pointer` 포함
- 테스트 파일: `src/components/__tests__/session-detail.test.tsx`
  - `it("회의록 생성 버튼에 cursor-pointer가 있다")` — 회의록 미존재 시 "회의록 생성" 버튼 cursor 확인
  - `it("다시 시도 버튼에 cursor-pointer가 있다")` — 에러 화면의 버튼 cursor 확인

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/main-transcript-tabs.tsx`
  - `transcriptTabClass` 함수의 양쪽 분기에 `cursor-pointer` 추가
- 구현 파일: `src/components/session-detail.tsx`
  - 남은 인라인 `<button>`에 `cursor-pointer` 추가 (회의록 생성, 다시 시도 등)
- 구현 파일: `src/components/recorder.tsx`
  - 남은 인라인 `<button>`에 `cursor-pointer` 추가 (배치 다시 시도 등)

**REFACTOR** — 코드 개선

- 전체 앱에서 `<button>`·`<a>`·`role="tab"` 요소의 cursor 일관성 확인
- `aria-label` 누락 여부 최종 점검
- `IconButton`·`RecordButton`에는 이미 `cursor-pointer`가 적용되어 있으므로 중복 확인

---

## 파일 변경 계획

| 파일                                                     | 변경 유형 | 설명                                                   |
| -------------------------------------------------------- | --------- | ------------------------------------------------------ |
| `package.json`                                           | 수정      | `lucide-react` 의존성 추가                             |
| `src/components/ui/icon-button.tsx`                      | **신규**  | 공유 아이콘 버튼 컴포넌트                              |
| `src/components/ui/__tests__/icon-button.test.tsx`       | **신규**  | IconButton 테스트                                      |
| `src/components/record-button.tsx`                       | **신규**  | 녹음 시작/중지 버튼 (원 ↔ 사각형 애니메이션)           |
| `src/components/__tests__/record-button.test.tsx`        | **신규**  | RecordButton 테스트                                    |
| `src/components/__tests__/recorder-ui.test.tsx`          | **신규**  | Recorder 홈 화면 렌더링 테스트 (탭 없음)               |
| `src/components/recorder.tsx`                            | 수정      | RecordButton 사용, 탭 제거, TranscriptView 직접 렌더   |
| `src/components/main-transcript-tabs.tsx`                | 수정      | 탭 버튼에 `cursor-pointer` 추가                        |
| `src/components/session-detail.tsx`                      | 수정      | 뒤로·오디오 제거, 아이콘 버튼, h2 제거, cursor-pointer |
| `src/components/summary-tab-panel.tsx`                   | 수정      | complete 상태 "회의록" 텍스트 제거                     |
| `src/components/__tests__/session-detail.test.tsx`       | 수정      | 뒤로 버튼 테스트 교체, 아이콘·h2·cursor 테스트 추가    |
| `src/components/__tests__/session-detail-audio.test.tsx` | 수정      | audio element 부재 확인 추가                           |
| `src/components/__tests__/main-transcript-tabs.test.tsx` | 수정      | cursor-pointer 테스트 추가                             |
| `src/components/__tests__/summary-tab-panel.test.tsx`    | 수정      | heading 제거 테스트 추가                               |

## 완료 조건

1. `npm run test` — 전체 테스트 통과
2. `npm run lint` — 린트 오류 없음
3. `npm run build` — 빌드 성공
4. 홈 화면: 빨간 원/사각형 녹음 버튼, 스크립트만 표시(탭 UI 없음)
5. 세션 상세: "뒤로" 버튼·`<audio controls>` 없음, lucide-react 아이콘 액션 버튼, `<h2>` 없음
6. 모든 버튼·탭에 `cursor-pointer` 적용
7. `prefers-reduced-motion` 시 녹음 버튼 애니메이션 비활성화
8. `aria-label` 기존 수준 유지

## 테스트 전략

| 계층   | 도구                                         | 대상                                                          |
| ------ | -------------------------------------------- | ------------------------------------------------------------- |
| 단위   | Vitest + @testing-library/react + happy-dom  | `IconButton`, `RecordButton`                                  |
| 통합   | Vitest + @testing-library/react + happy-dom  | `Recorder` (탭 제거), `SessionDetail` (뒤로·오디오·아이콘·h2) |
| 접근성 | aria-label/role assertion                    | 모든 변경 컴포넌트                                            |
| 모션   | `matchMedia` mock (`prefers-reduced-motion`) | `RecordButton`, `MainTranscriptTabs` (기존)                   |

### 테스트 환경

- 모든 컴포넌트 테스트 파일 상단: `/** @vitest-environment happy-dom */`
- `matchMedia` mock: `prefers-reduced-motion` 쿼리 대응 (`beforeEach`)
- `navigator.clipboard` mock: 복사 기능 테스트
- `next/navigation` mock: `useParams`, `useRouter`
- `@/lib/db` mock: `getSessionById`, `getSessionAudio`, `updateSession`

### 기존 테스트 영향도

| 테스트 파일                     | 영향                                                   | 조치                                              |
| ------------------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| `session-detail.test.tsx`       | "뒤로 버튼이 router.back을 호출한다" 실패              | 삭제 후 "뒤로 버튼 미존재" 테스트로 교체          |
| `session-detail.test.tsx`       | 기존 "기본 탭은 회의록" 테스트에서 `<h2>` heading 쿼리 | heading 쿼리 제거 또는 수정                       |
| `session-detail-audio.test.tsx` | `<audio>` 요소 사라짐                                  | audio 부재 확인 테스트 추가, 다운로드 테스트 유지 |
| `recorder-*.test.tsx`           | 버튼 aria-label 불변 → 대부분 영향 없음                | 버튼 텍스트(`getByText`) 기반 쿼리만 수정 필요    |
| `main-transcript-tabs.test.tsx` | 변경 최소 (cursor-pointer 추가만)                      | 테스트 추가만                                     |
