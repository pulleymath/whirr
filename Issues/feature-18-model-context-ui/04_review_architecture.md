---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "feature-18-model-context-ui"
  review_kind: architecture
---

# Architecture & Code Style Review

## Summary

브라우저·IndexedDB 경계와 `PostRecordingPipelineProvider` 책임에 맞게 `scriptMeta`와 설정 옵션 공유(`options.ts`)가 정리되었고, 레이아웃은 `Recorder`의 `modelPanel` 주입으로 확장성을 확보했다. 다만 `session-detail.tsx`에 편집·영속·API 호출이 한 덩어리로 모여 계획서의 훅 추출 단계가 남아 있고, 컨텍스트 정규화 로직이 `recorder`와 중복된다.

## Architecture Findings

### [MEDIUM] 세션 상세 컴포넌트 응집도·단일 책임 과부하

- Location: `src/components/session-detail.tsx` (`SessionDetailReadyContent`)
- Category: coupling / structure / solid
- Description: `contextDraft`·`glossaryDraft`·`minutesModelDraft`·저장·`fetchMeetingMinutesSummary` 순서가 한 함수/컴포넌트에 집중되어, UI와 세션 업데이트 오케스트레이션이 강하게 결합된다. `01_plan.md` Step 6 REFACTOR에서 제안한 `useSessionDetailEditor` 같은 추출이 아직 없다.
- Suggestion: 편집 상태와 `updateSession` + `fetch` 시퀀스를 전용 훅(또는 작은 모듈)로 분리해 `SessionDetailReadyContent`는 패널 조립만 담당하도록 한다.

### [MEDIUM] 세션 컨텍스트 API용 정규화 로직 중복

- Location: `src/components/recorder.tsx` (`sessionContextForEnqueue`) vs `src/components/session-detail.tsx` (`sessionContextForApi`)
- Category: coupling / structure
- Description: “빈 컨텍스트는 null” 규칙이 두 곳에 유사하게 존재해, 규칙 변경 시 이중 수정 위험이 있다.
- Suggestion: `@/lib/glossary` 또는 `session-context.ts` 같은 공용 유틸로 `emptySessionContext`와 `toMeetingSessionContext(value): SessionContext | null` 한 벌로 통합한다.

### [LOW] 파이프라인 입력의 `engine` 기본값이 헬퍼 내부에 숨음

- Location: `src/lib/post-recording-pipeline/context.tsx` (`buildScriptMeta` 호출 시 `input.engine ?? "openai"`)
- Category: dependency / pattern
- Description: 실시간 모드인데 `engine` 누락 시 조용히 `openai`로 굳어져, 호출부 계약이 약해 보일 수 있다.
- Suggestion: `enqueue` 시점에 `realtime`이면 항상 `engine`을 채워 넣도록 타입/런타임 어서션을 강화하거나, 기본값을 `buildScriptMeta`가 아닌 단일 팩토리(예: `normalizeEnqueueInput`)에서만 처리한다.

### [LOW] 홈 레이아웃 폭 제약 이중화 가능성

- Location: `src/components/home-page-shell.tsx`, `src/components/recorder.tsx` 루트 `className` (`max-w-5xl` 등)
- Category: structure
- Description: 셸과 `Recorder` 모두 최대 폭을 잡으면 중첩 시 실제 제한이 어느 층인지 읽기 어렵다.
- Suggestion: 폭·패딩 책임을 한 층(보통 `HomePageShell` 또는 `MainShell` 하위 단일 래퍼)에만 두고 `Recorder`는 `w-full min-w-0` 정도로 단순화한다.

## Code Style Findings

### [MEDIUM] `ModelQuickPanel` import 정렬

- Location: `src/components/model-quick-panel.tsx` 상단 import
- Category: formatting
- Description: 프로젝트 가이드(외부 → 내부 `@/` → 상대) 관점에서 `react`와 `@/` 경로가 섞인 순서가 일관되지 않을 수 있다.
- Suggestion: `useSyncExternalStore`를 `react`와 함께 묶고, 그 다음 `@/` 알파벳 순 등 팀 규칙에 맞춘다.

### [LOW] `SessionGlossaryEditor`의 즉시 trim/filter

- Location: `src/components/session-glossary-editor.tsx` `onChange`
- Category: readability
- Description: 입력 중에도 줄 단위 trim·빈 줄 제거가 적용되어, 로컬 state와 textarea 표시가 1:1이 아닐 수 있다(편집 UX·디버깅 난이도).
- Suggestion: 원문 문자열을 state로 두고 blur/submit 시에만 `string[]`로 정규화하거나, 최소한 주석으로 의도(회의록 API용 정규화)를 짧게 남긴다.

### [LOW] `RealtimeEngine` 캐스팅

- Location: `src/components/model-quick-panel.tsx` `e.target.value as RealtimeEngine`
- Category: typescript
- Description: `<select>` 값이 항상 허용 엔진 집합이라는 가정에 의존한다.
- Suggestion: `ENGINE_OPTIONS`에서 찾은 값만 통과시키는 소형 헬퍼나 `satisfies` 패턴으로 좁히면 타입 안전성이 좋아진다.

## Verdict

PASS_WITH_NOTES
