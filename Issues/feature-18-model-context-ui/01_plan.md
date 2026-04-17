---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "feature-18-model-context-ui"
---

# Feature 18 — 개발 계획서

## 개발 범위

1. **Session 타입 확장 & DB 마이그레이션**: `Session`에 `scriptMeta` 필드를 추가하여 생성 시점 모델·모드·언어 정보를 영구 저장한다. `DB_VERSION` 2 → 3 (IndexedDB object store 스키마는 변경 없이 필드 추가).
2. **홈 4영역 레이아웃**: `HomePageShell`을 리팩토링하여 ① 녹음 컨트롤 ② 모델 빠른 변경 ③ 회의 컨텍스트 ④ 스크립트 결과를 `md` 이상 2열, 모바일 세로 스택으로 배치한다.
3. **모델 빠른 변경 패널**: 전역 `settings`와 동기화되는 드롭다운 UI. 녹음 중 비활성화.
4. **세션 상세 — 스크립트 모델 읽기 전용 표시**: 레거시 세션(`scriptMeta` 없음)은 블록을 숨긴다.
5. **세션 상세 — 회의 컨텍스트/glossary 편집 + 회의록 모델 선택**: 세션별로 독립 관리.
6. **세션 상세 — 재생성 버그 수정**: `fetchMeetingMinutesSummary` 호출 시 `glossary`·`sessionContext` 옵션을 전달하도록 수정.
7. **파이프라인 메타 저장**: 녹음 완료 후 `scriptMeta`가 세션에 일관되게 남도록 `saveSession`, 파이프라인 코드를 정리한다.

## 기술적 접근 방식

### Session 스키마 확장

```typescript
export type SessionScriptMeta = {
  mode: TranscriptionMode;
  engine?: RealtimeEngine; // mode='realtime'일 때만
  batchModel?: string; // mode='batch'일 때만
  language: string;
  minutesModel: string;
};
```

- `Session.scriptMeta?: SessionScriptMeta` — optional이므로 레거시 세션은 자연스럽게 `undefined`.
- `SaveSessionOptions`에 `scriptMeta` 추가.
- `SessionUpdate`에 `scriptMeta` 추가.
- `DB_VERSION` 2 → 3. IndexedDB object store에 새 인덱스나 key 변경은 없음. `upgrade` 핸들러에서 `oldVersion < 3`일 때는 no-op (데이터 마이그레이션 불필요, 필드 부재 = 레거시).

### 홈 레이아웃

- `HomePageShell` 내부를 `md:grid-cols-2` 그리드로 변경.
  - 좌열: 녹음 컨트롤 + 모델 빠른 변경
  - 우열: 회의 컨텍스트 + 스크립트 결과
  - 모바일: `grid-cols-1` 세로 스택.
- 새 컴포넌트 `ModelQuickPanel` (`src/components/model-quick-panel.tsx`): `useSettings`에서 읽고 `updateSettings`로 쓴다. 녹음 중(`isRecording`) disabled.

### 세션 상세

- `SessionScriptMetaDisplay` (`src/components/session-script-meta-display.tsx`): `scriptMeta`를 받아 읽기 전용 뱃지/라벨로 렌더링. `scriptMeta`가 `undefined`이면 `null` 반환 → 레거시 숨김.
- `SessionContextEditor`: `SessionContextInput`을 재사용하되 세션 로컬 상태로 관리. `session.context`에서 초기값 로드.
- `SessionGlossaryEditor` (`src/components/session-glossary-editor.tsx`): 전역 용어 사전의 textarea를 세션 단위로 편집.
- `SessionMinutesModelSelect` (`src/components/session-minutes-model-select.tsx`): 회의록 모델 선택 드롭다운 (세션 로컬 상태, 전역 설정 미변경).
- 재생성 버튼 하나로: context/glossary/minutesModel을 세션에 저장 → `fetchMeetingMinutesSummary(text, model, signal, { glossary, sessionContext })` 호출 → 결과 저장.

### 버그 수정

현재 `session-detail.tsx`의 `handleMeetingMinutes`에서 `fetchMeetingMinutesSummary(t, settings.meetingMinutesModel)` 호출 시 4번째 인자 `options`를 전달하지 않음. 세션에 저장된 context의 glossary·sessionContext를 `options`로 전달하도록 수정.

## TDD 구현 순서

### Step 1: Session 타입 확장 및 DB 마이그레이션

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/__tests__/db.test.ts`
- `saveSession`에 `scriptMeta`를 넘기면 저장된 세션에 반영된다
- `updateSession`으로 `scriptMeta`를 갱신할 수 있다
- 레거시 세션(`scriptMeta` 없음)을 조회하면 `scriptMeta`가 `undefined`이다
- `DB_VERSION`이 3이다

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/db.ts`, `src/lib/session-script-meta.ts`
- `SessionScriptMeta` 타입 정의 (새 파일)
- `Session.scriptMeta?: SessionScriptMeta` 추가
- `SaveSessionOptions`에 `scriptMeta?: SessionScriptMeta` 추가
- `SessionUpdate` Pick에 `scriptMeta` 추가
- `saveSession`에서 `options?.scriptMeta`를 레코드에 포함
- `DB_VERSION` 2 → 3, `upgrade`에 `oldVersion < 3` no-op 추가

**REFACTOR** — 코드 개선

- `SessionScriptMeta` 타입을 `session-script-meta.ts`로 분리하여 db.ts의 import가 깔끔하도록 정리

### Step 2: 파이프라인에서 scriptMeta 저장

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/post-recording-pipeline/__tests__/script-meta-persistence.test.tsx`
- 파이프라인 완료 후 `updateSession`이 `scriptMeta`를 포함하여 호출된다
- `scriptMeta.mode`, `scriptMeta.minutesModel` 등이 enqueue input과 일치한다

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/post-recording-pipeline/context.tsx`, `src/components/recorder.tsx`
- `PostRecordingPipelineEnqueueInput`에 `mode: TranscriptionMode`, `engine?: RealtimeEngine` 추가
- 파이프라인 `buildMeetingContextForPersistence` 옆에 `buildScriptMeta` 헬퍼 추가
- `runPipelineRef` 내에서 `updateSession` 호출 시 `scriptMeta` 포함
- `saveSession` 호출 시에도 `scriptMeta` 전달 (recorder.tsx에서 `enqueuePipeline` 시점에 값 전달)

**REFACTOR** — 코드 개선

- `buildScriptMeta`를 `session-script-meta.ts`로 이동하여 재사용 가능하게 정리

### Step 3: 모델 빠른 변경 패널 (ModelQuickPanel)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/model-quick-panel.test.tsx`
- 스크립트 모드 라디오가 현재 설정값을 반영한다
- 모드 변경 시 `updateSettings`가 호출된다
- 회의록 모델 select가 현재 설정값을 반영한다
- `isRecording=true`일 때 모든 입력이 disabled 된다

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/model-quick-panel.tsx`
- `useSettings` 훅으로 상태 읽기/쓰기
- 모드 라디오 그룹 (realtime / batch / webSpeechApi)
- 조건부: realtime 엔진 select, batch 모델 select
- 회의록 모델 select
- 언어 select
- `disabled` prop 전달로 녹음 중 비활성화

**REFACTOR** — 코드 개선

- `SettingsPanel`과 중복되는 옵션 상수(`MODE_OPTIONS`, `ENGINE_OPTIONS`, `BATCH_MODEL_OPTIONS`, `MEETING_MINUTES_MODEL_OPTIONS`)를 `src/lib/settings/options.ts`로 추출하여 두 컴포넌트 모두에서 사용

### Step 4: 홈 4영역 레이아웃

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/home-page-shell.test.tsx` (기존 파일 확장)
- 홈에 `data-testid="home-model-panel"` 영역이 존재한다
- 홈에 `data-testid="session-context-input"` 영역이 존재한다
- 홈에 `data-testid="recorder-root"` 영역이 존재한다

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/home-page-shell.tsx`
- `Recorder`에서 녹음 컨트롤과 `TranscriptView`만 남기고, `SessionContextInput`은 `HomePageShell`이 직접 렌더링
- `ModelQuickPanel`을 import하여 배치
- 2열 그리드: `md:grid-cols-2 gap-6`
- 모바일: `grid-cols-1`

**REFACTOR** — 코드 개선

- `Recorder` 컴포넌트에서 `SessionContextInput` 렌더링 제거 후, `sessionContext`와 `setSessionContext`를 `HomePageShell`에서 관리하여 props로 전달하도록 리팩토링
- 또는 `Recorder`가 `sessionContext`를 외부에서 받을 수 있도록 props 확장

### Step 5: 세션 상세 — 스크립트 모델 읽기 전용 표시

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/session-script-meta-display.test.tsx`
- `scriptMeta`가 있으면 모드 라벨·모델명·언어가 표시된다
- `scriptMeta`가 `undefined`이면 아무것도 렌더링하지 않는다
- realtime 모드: "실시간 · OpenAI · ko" 형태
- batch 모드: "녹음 후 · whisper-1 · ko" 형태

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/session-script-meta-display.tsx`
- `SessionScriptMeta | undefined`를 props로 받음
- `undefined`이면 `return null`
- 뱃지/칩 스타일로 모드·모델·언어를 읽기 전용 표시

**REFACTOR** — 코드 개선

- 모드 라벨 매핑을 별도 유틸로 분리 (`src/lib/settings/labels.ts`)

### Step 6: 세션 상세 — 컨텍스트/glossary 편집 + 모델 선택

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/session-detail-context-editor.test.tsx`
- 세션에 `context`가 있으면 참석자·주제·키워드 필드에 초기값이 채워진다
- glossary 편집 시 textarea 값이 변경된다
- 회의록 모델 select가 `session.scriptMeta.minutesModel` 또는 기본값을 표시한다
- 편집 후 재생성 클릭 시 변경된 값이 `fetchMeetingMinutesSummary`에 전달된다

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/session-detail.tsx` (기존 파일 확장), `src/components/session-glossary-editor.tsx`, `src/components/session-minutes-model-select.tsx`
- `SessionDetailReadyContent`에 로컬 상태 추가: `contextDraft`, `glossaryDraft`, `minutesModelDraft`
- 세션 로드 시 `session.context` 및 `session.scriptMeta`에서 초기값 설정
- UI: `SessionContextInput`(편집 모드), `SessionGlossaryEditor`, `SessionMinutesModelSelect` 렌더링
- `SessionScriptMetaDisplay` 렌더링 (Step 5)

**REFACTOR** — 코드 개선

- `SessionDetailReadyContent`의 상태가 많아지므로, 편집 관련 상태를 `useSessionDetailEditor` 커스텀 훅으로 추출

### Step 7: 세션 상세 — 재생성 시 glossary·sessionContext 전달 (버그 수정)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/session-detail.test.tsx` (기존 파일 확장)
- 회의록 재생성 시 `fetchMeetingMinutesSummary`의 4번째 인자에 `{ glossary, sessionContext }`가 포함된다
- 재생성 후 `updateSession`이 변경된 `context`·`scriptMeta`를 포함하여 호출된다

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/session-detail.tsx`
- `handleMeetingMinutes`에서 `fetchMeetingMinutesSummary` 호출 시 `options` 인자 추가
- `updateSession` 호출 시 `context: { glossary, sessionContext }` 및 `scriptMeta: { ...prev, minutesModel }`도 함께 저장
- 전역 설정(`settings`)은 변경하지 않음

**REFACTOR** — 코드 개선

- `handleMeetingMinutes`의 책임을 명확히: "세션 로컬 값을 저장하고 API 호출" 흐름을 코드로 명확하게 표현

### Step 8: Recorder에서 scriptMeta 전달 연결

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-session-storage.test.tsx` (기존 파일 확장)
- 실시간 모드 녹음 완료 시 `enqueuePipeline`에 `mode: "realtime"`, `engine` 값이 포함된다
- batch 모드 녹음 완료 시 `enqueuePipeline`에 `mode: "batch"` 값이 포함된다

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder.tsx`
- `enqueuePipeline` 호출부(stop 콜백, persistBatchResult)에 `mode: settings.mode`, `engine: settings.realtimeEngine` 추가

**REFACTOR** — 코드 개선

- enqueue input 구성을 헬퍼 함수로 추출하여 두 호출 지점의 중복 제거

### Step 9: 통합 테스트 — 전체 플로우

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/session-detail-regenerate-flow.test.tsx`
- 세션에 `scriptMeta`와 `context`가 있는 상태에서 스크립트 메타가 읽기 전용으로 표시된다
- glossary/context를 편집하고 재생성하면 API에 변경된 값이 전달된다
- 레거시 세션(scriptMeta 없음)에서는 스크립트 메타 블록이 보이지 않는다

**GREEN** — 테스트를 통과하는 최소 구현

- 이미 구현된 코드의 통합 확인. 필요 시 누락된 연결 보완.

**REFACTOR** — 코드 개선

- 테스트 유틸 정리: 세션 fixture factory 함수를 `src/lib/__tests__/session-fixtures.ts`로 추출

## 파일 변경 계획

| 파일                                                                         | 변경                                                                                        | 유형 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---- |
| `src/lib/session-script-meta.ts`                                             | `SessionScriptMeta` 타입 + `buildScriptMeta` 헬퍼                                           | 신규 |
| `src/lib/db.ts`                                                              | `Session.scriptMeta`, `SaveSessionOptions.scriptMeta`, `SessionUpdate` 확장, `DB_VERSION` 3 | 수정 |
| `src/lib/settings/options.ts`                                                | 모드·엔진·모델 옵션 상수 추출                                                               | 신규 |
| `src/lib/settings/labels.ts`                                                 | 모드/엔진/언어 → 한글 라벨 매핑 유틸                                                        | 신규 |
| `src/components/model-quick-panel.tsx`                                       | 모델 빠른 변경 UI                                                                           | 신규 |
| `src/components/session-script-meta-display.tsx`                             | 스크립트 메타 읽기 전용 표시                                                                | 신규 |
| `src/components/session-glossary-editor.tsx`                                 | 세션별 glossary 편집                                                                        | 신규 |
| `src/components/session-minutes-model-select.tsx`                            | 세션별 회의록 모델 선택                                                                     | 신규 |
| `src/components/home-page-shell.tsx`                                         | 4영역 2열 레이아웃                                                                          | 수정 |
| `src/components/recorder.tsx`                                                | `enqueuePipeline`에 mode·engine 추가, SessionContext props                                  | 수정 |
| `src/components/session-detail.tsx`                                          | 스크립트 메타 표시, 컨텍스트/glossary/모델 편집, 재생성 버그 수정                           | 수정 |
| `src/components/settings-panel.tsx`                                          | 옵션 상수를 `options.ts`에서 import로 변경                                                  | 수정 |
| `src/lib/post-recording-pipeline/context.tsx`                                | `EnqueueInput`에 mode·engine 추가, `buildScriptMeta`, `updateSession`에 scriptMeta 포함     | 수정 |
| `src/lib/__tests__/db.test.ts`                                               | scriptMeta 저장·조회·DB_VERSION 테스트 추가                                                 | 수정 |
| `src/components/__tests__/model-quick-panel.test.tsx`                        | ModelQuickPanel 테스트                                                                      | 신규 |
| `src/components/__tests__/session-script-meta-display.test.tsx`              | 스크립트 메타 표시 테스트                                                                   | 신규 |
| `src/components/__tests__/session-detail-context-editor.test.tsx`            | 컨텍스트/glossary 편집 테스트                                                               | 신규 |
| `src/components/__tests__/session-detail-regenerate-flow.test.tsx`           | 재생성 통합 테스트                                                                          | 신규 |
| `src/components/__tests__/session-detail.test.tsx`                           | 재생성 시 options 전달 테스트 추가                                                          | 수정 |
| `src/components/__tests__/home-page-shell.test.tsx`                          | 4영역 존재 확인 테스트 추가                                                                 | 수정 |
| `src/components/__tests__/recorder-session-storage.test.tsx`                 | mode·engine 전달 테스트 추가                                                                | 수정 |
| `src/lib/post-recording-pipeline/__tests__/script-meta-persistence.test.tsx` | 파이프라인 scriptMeta 저장 테스트                                                           | 신규 |

## 완료 조건

1. 홈에서 4영역 레이아웃이 `md` 이상에서 2열, 모바일에서 세로 스택으로 렌더링된다.
2. 모델 빠른 변경 패널에서 설정을 바꾸면 전역 `settings`에 즉시 반영되고, 녹음 중에는 비활성화된다.
3. 새로 저장되는 세션에 `scriptMeta` (mode·engine/batchModel·language·minutesModel)가 기록된다.
4. 세션 상세에서 `scriptMeta`가 있는 세션은 "모드 · 모델/엔진 · 언어" 형식으로 읽기 전용 표시된다.
5. 레거시 세션(`scriptMeta` 없음)은 스크립트 모델 블록이 보이지 않는다.
6. 세션 상세에서 회의 컨텍스트(참석자·주제·키워드)와 glossary를 편집할 수 있다.
7. 세션 상세에서 회의록 모델을 변경할 수 있다 (전역 설정 미변경).
8. 재생성 버튼 클릭 시 변경된 context·glossary·모델이 세션에 저장되고 `fetchMeetingMinutesSummary`에 `options`로 전달된다.
9. 모든 Vitest 테스트 통과, TypeScript 타입 체크 통과, ESLint 통과, `next build` 성공.

## 테스트 전략

- **단위 테스트**: 각 새 컴포넌트에 대한 렌더링·인터랙션 테스트.
- **DB 테스트**: `scriptMeta` 저장·조회·업데이트, DB_VERSION 3 마이그레이션 (fake-indexeddb 사용).
- **통합 테스트**: 세션 상세 재생성 플로우 전체 (컨텍스트 편집 → 재생성 → API 호출 검증 → 세션 업데이트 검증).
- **기존 테스트 보호**: 변경되는 파일의 기존 테스트가 깨지지 않도록 확인.
- **환경**: `@vitest-environment happy-dom`, `@testing-library/react`, `vi.mock`으로 DB·API·navigation 격리.

## Issue source (verbatim for context)

`Issues/feature-18-model-context-ui/00_issue.md` 참조.
