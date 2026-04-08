# Feature 7: 메인 UI 셸 — 작업 요약

## 구현된 기능

- 상단 헤더: 중앙 **Whirr** 텍스트만(링크·버튼 없음), 모바일 좌측 History 햄버거(`md:hidden`).
- **≥768px**: 좌측 `aside`에 `SessionList` + `refreshTrigger`로 기존과 동일 데이터.
- **&lt;768px**: 오버레이 drawer(스크림·닫기), 라우트(`pathname`) 변경 시 자동 닫힘.
- 본문: **Record(녹음)** 블록 위, **실시간 전사 텍스트** / **요약** 탭 아래(메인 컬럼 내부).
- 전사는 탭 패널의 `TranscriptView`에만 표시(`showHeading={false}`로 탭과 제목 중복 완화).
- 요약 탭: 녹음 전·중·요약 중·완료(플레이스홀더)·저장 실패 시 error 카피.

## 주요 기술적 결정

- 셸: `HomePageShell`(헤더·부제·drawer 상태·`usePathname` effect), 본문 레이아웃·History UI는 `HomeContent`.
- drawer 닫기: `useEffect([pathname])` + ESLint 예외 한 줄(라우터 외부 소스 동기화 명시).
- 요약 완료 스텁: 저장 성공 후 `setTimeout` 400ms로 `summarizing` → `complete` 전환(API 대기).

## 테스트 커버리지

- 신규: `main-transcript-tabs`, `summary-tab-panel`, `home-header`(셸 스텁), `home-content-layout`(Recorder 순서), `history-drawer`, `history-sidebar`(클래스), **`home-page-shell`(pathname 변경 시 drawer 닫힘·`md:hidden`)**.
- 기존 Recorder·STT·세션 저장 통합 테스트 유지 통과.

## 파일 변경 목록

- 앱: `src/app/page.tsx` → `HomePageShell` 래핑.
- 컴포넌트: `home-page-shell.tsx`, `home-content.tsx`, `recorder.tsx`, `main-transcript-tabs.tsx`, `summary-tab-panel.tsx`, `transcript-view.tsx`.
- 이슈 산출물: `Issues/feature-7-main-ui-shell/*`, `Issues/STATUS.md`.
- 품질 게이트: `docs/*.md` 및 일부 테스트 파일은 Prettier 정렬로 포맷만 변경됨.

## 알려진 제한 사항

- 요약 API 미연동: 플레이스홀더·타이머 기반 상태만.
- 요약 탭 선택 시에도 전사 패널은 마운트 유지(성능 최적화는 후속).
- 사이드바 동작은 Tailwind `md:` + 클래스 테스트 위주; `matchMedia` 단위 테스트는 일부만.

## 다음 단계 (해당 시)

- 요약 생성 API 연동 시 `Recorder`의 요약 상태·`SummaryTabPanel`을 실데이터로 교체.
- 필요 시 `RecordingWorkspace` 추출로 `Recorder` 단일 책임 완화.
