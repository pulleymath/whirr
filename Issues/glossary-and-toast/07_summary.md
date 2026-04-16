# glossary-and-toast — 작업 요약

## 구현된 기능

- 전역 용어 사전(`GlossaryProvider`, localStorage `whirr:global-glossary`) 및 설정 패널 textarea 편집
- 녹음 화면 `SessionContextInput`(참석자·주제·키워드, 접기, 파이프라인 busy 시 비활성)
- 회의록 API가 `glossary`·`sessionContext`를 검증(항목 수 200, 필드 길이 2000, **항목당 500자**) 후 `generateMeetingMinutes`에 `MeetingContext`로 전달
- `buildSystemPromptWithContext`로 SINGLE/MAP 시스템 프롬프트에만 컨텍스트 주입(REDUCE는 기존 상수 유지)
- 파이프라인 enqueue/fetch에 컨텍스트 전달, 완료 시 `completedSessionId` 노출, 세션 `context`로 IndexedDB에 저장
- `sonner` + 루트 `AppToaster`, `PipelineToastNotifier`로 완료 토스트 및 `window.location.assign`으로 세션 상세 이동
- `fetchMeetingMinutesSummary`에 선택적 glossary/sessionContext 인자

## 주요 기술적 결정

- Vitest·happy-dom에서 `useRouter` 의존을 피하기 위해 토스트 액션은 `window.location.assign` 사용
- 서버 `MeetingContext`는 glossary 누락 시 `[]`, 세션 컨텍스트 누락 시 `null`로 정규화하여 `buildSystemPromptWithContext`가 빈 입력을 무시하도록 유지

## 테스트 커버리지

- 타입·프롬프트·map-reduce·API route·glossary context·파이프라인 fetch·`completedSessionId` 전이·DB context·클라이언트 fetch·UI 컴포넌트·설정 패널·토스트·MainAppProviders 스모크
- 리뷰에서 지적된 일부 계획 항목(Recorder UI 통합, layout 전용 Toaster 테스트 등)은 후속으로 남김(`06_fixes.md` 참고)

## 파일 변경 목록

- `Issues/glossary-and-toast/*` 산출물, `Issues/STATUS.md`
- `package.json` / `package-lock.json` (`sonner`)
- `src/lib/glossary/*`, `src/lib/meeting-minutes/*`, `src/lib/post-recording-pipeline/context.tsx`, `src/lib/db.ts`, `src/lib/api/meeting-minutes-api-constants.ts`
- `src/app/api/meeting-minutes/route.ts`, `src/app/layout.tsx`
- `src/components/session-context-input.tsx`, `pipeline-toast-notifier.tsx`, `app-toaster.tsx`, `recorder.tsx`, `settings-panel.tsx`, `main-app-providers.tsx`
- 대응 `__tests__` 및 기존 테스트 보강

## 알려진 제한 사항

- glossary **전체** 문자 합계 상한은 두지 않음(항목당 500자만). 추가 남용 방지가 필요하면 후속 이슈에서 확장
- 설정 패널 용어 사전은 입력마다 localStorage 저장(리뷰 MEDIUM, debounce는 미적용)

## 다음 단계 (해당 시)

- `useRouter().push`로 통일할지, 문서를 `location.assign`에 맞출지 결정
- Recorder·layout 관련 계획 대비 남은 통합 테스트 보강
