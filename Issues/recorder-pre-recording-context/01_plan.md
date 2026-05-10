---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "recorder-pre-recording-context"
---

# 녹음 전 회의 컨텍스트 입력 — 개발 계획서

## 개발 범위

Recorder 컴포넌트의 `showSessionContext` 조건을 변경하여 홈 idle 상태에서도 회의 정보 입력 카드와 회의록 형식 선택기를 노출한다. 녹음 시작 전에 사용자가 참석자·주제·키워드·회의록 형식을 미리 입력할 수 있게 하며, enqueue 성공 시 입력값을 초기화하고 실패 시에는 유지한다.

주요 변경 지점:

- `src/components/recorder.tsx` — `showSessionContext` 조건 변경, enqueue 후 초기화 로직 추가
- `src/components/recorder-ui-preview.tsx` — 프리뷰 단계 라벨·표시 조건 정합
- `src/components/__tests__/recorder-phased-ui.test.tsx` — idle 숨김 단언 수정
- `src/components/__tests__/recorder-pre-recording-context.test.tsx` — 신규 회귀 테스트
- `docs/USER_FLOWS.md` — §2 흐름 갱신

비목표: 화자 수 UI, 새 라우트, 임시 초안 저장, 마이크 권한·pipeline 정책 변경.

## 기술적 접근 방식

1. **`showSessionContext` 조건 변경** — 현재 `recordingActive`(녹음 중만 `true`)에서 상수 `true`로 변경한다. `RevealSection`의 `visible` 속성이 항상 `true`가 되어 idle·recording·pipeline 처리 중 모든 상태에서 회의 정보 영역이 보인다. `disabled={pipeline.isBusy}` 속성은 그대로 유지하여 파이프라인 처리 중에는 입력을 비활성화하고, `SessionContextInput` 내부의 안내 문구("회의록 생성 중에는 수정할 수 없습니다.")도 기존 정책 그대로 노출된다.

2. **enqueue 성공 후 초기화** — 배치 모드의 `persistBatchResult` 함수와 스트리밍 모드의 `stop()` 내부 try 블록에서 `enqueuePipeline()` 호출 직후에 `setSessionContext(EMPTY_SESSION_CONTEXT)`와 `setMeetingTemplate(DEFAULT_MEETING_MINUTES_TEMPLATE)`를 호출한다. catch 블록에서는 초기화하지 않아 실패 시 입력값이 보존된다. `persistBatchResult`는 `handleBatchRetry`에서도 호출되므로 재시도 성공 시에도 동일하게 초기화된다.

3. **기존 mock 패턴 유지** — 새 테스트 파일도 `vi.hoisted` + `vi.mock` 패턴을 따른다. `enqueuePipeline`을 `mocks` 객체에 `vi.fn()`으로 노출하여 호출 인자를 검증할 수 있게 한다. `saveSession`·`saveSessionAudio`(`@/lib/db`)도 mock하여 배치·스트리밍 양쪽 stop 흐름을 시뮬레이션한다.

4. **프리뷰 컴포넌트 정합성** — `recorder-ui-preview.tsx`에서도 `showSessionContext`를 동일하게 `true`로 변경하고, idle 단계 라벨을 갱신하여 프리뷰가 실제 동작과 일치하도록 한다.

## TDD 구현 순서

### Step 1: idle 상태에서 회의 정보·회의록 형식 영역 노출

**RED** — 실패하는 테스트 작성
- 테스트 파일: `src/components/__tests__/recorder-pre-recording-context.test.tsx` (신규 생성)
- 테스트 케이스:
  - `idle 상태에서 reveal-session-context가 보인다(aria-hidden이 아니다)` — `screen.getByTestId("reveal-session-context")`가 `aria-hidden` 속성을 갖지 않음을 단언
  - `idle 상태에서 session-context-input과 meeting-template-selector가 DOM에 존재한다` — `screen.getByTestId("session-context-input")` 및 회의록 형식 선택기 요소가 렌더링되었음을 단언
- 파일 상단에 `/** @vitest-environment happy-dom */` 지시. mock 구조는 기존 `recorder-phased-ui.test.tsx`를 그대로 따른다: `vi.hoisted`로 mock 상태 선언 → `vi.mock("@/hooks/use-transcription")` · `vi.mock("@/hooks/use-recorder")` · `vi.mock("@/hooks/use-batch-transcription")` · `vi.mock("@/lib/post-recording-pipeline/context")`. `MainAppProviders`로 감싸서 렌더링.
- **현재 `showSessionContext = recordingActive`이고 idle에서는 `recordingActive = false`이므로 두 테스트 모두 실패한다.**

**GREEN** — 테스트를 통과하는 최소 구현
- 구현 파일: `src/components/recorder.tsx`
- 핵심 변경: `const showSessionContext = recordingActive;` → `const showSessionContext = true;`
- 이 변경으로 새 테스트 2개가 통과한다. 단, `recorder-phased-ui.test.tsx`의 `"idle 상태에서 reveal-session-context는 숨김(aria-hidden)이다"` 테스트가 실패하게 된다 (Step 2에서 처리).

**REFACTOR** — 코드 개선
- `showSessionContext` 변수를 유지할지 인라인할지 검토. `showTranscript`과 대비되는 의미론적 변수이므로 유지를 권장한다.

---

### Step 2: 기존 `recorder-phased-ui.test.tsx` idle 숨김 단언을 새 흐름에 맞게 수정

**RED** — 실패하는 테스트 확인
- 테스트 파일: `src/components/__tests__/recorder-phased-ui.test.tsx`
- Step 1의 구현(`showSessionContext = true`)으로 인해 아래 테스트가 실패한다:
  - `"idle 상태에서 reveal-session-context는 숨김(aria-hidden)이다"` — 이제 idle에서도 `aria-hidden`이 없으므로 단언 불일치

**GREEN** — 테스트를 새 흐름에 맞게 수정
- 구현 파일: `src/components/__tests__/recorder-phased-ui.test.tsx`
- 기존 단언(119–125행):
  ```tsx
  it("idle 상태에서 reveal-session-context는 숨김(aria-hidden)이다", () => {
    renderRecorder();
    expect(screen.getByTestId("reveal-session-context")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
  ```
- 수정 후:
  ```tsx
  it("idle 상태에서도 reveal-session-context가 보인다", () => {
    renderRecorder();
    expect(screen.getByTestId("reveal-session-context")).not.toHaveAttribute(
      "aria-hidden",
    );
  });
  ```
- 테스트 제목을 새 흐름에 맞게 갱신.

**REFACTOR** — 코드 개선
- `describe` 블록 내 다른 테스트 설명과 문맥이 일관되는지 확인한다.

---

### Step 3: 회의 정보가 비어 있어도 녹음 시작 가능

**RED** — 실패하는 테스트 작성
- 테스트 파일: `src/components/__tests__/recorder-pre-recording-context.test.tsx`
- 테스트 케이스:
  - `회의 정보가 모두 비어 있는 idle 상태에서 시작 버튼이 활성화되어 있고 클릭 가능하다` — `sessionContext`를 기본 빈 값으로 두고, 시작 버튼이 `disabled`가 아님을 확인한 뒤 `fireEvent.click`으로 클릭. 배치 모드 기준 `startBatchRecording` mock이 호출되었는지 단언한다.
- **이 테스트는 회귀 방지 목적이며, 현재 구현에서 이미 통과한다.** `start()` 함수는 `sessionContext` 값에 의존하지 않으므로 빈 상태에서도 녹음이 시작된다.

**GREEN** — 테스트를 통과하는 최소 구현
- 추가 구현 불필요. 기존 코드가 이미 올바르게 동작한다.

**REFACTOR** — 코드 개선
- 없음

---

### Step 4: 녹음 전 입력한 sessionContext·meetingTemplate이 enqueue payload에 반영

**RED** — 실패하는 테스트 작성
- 테스트 파일: `src/components/__tests__/recorder-pre-recording-context.test.tsx`
- 테스트 케이스:
  - `배치 모드 — 녹음 전 입력한 참석자·주제·키워드가 enqueue payload의 sessionContext에 포함된다` — idle에서 참석자·주제·키워드 `<textarea>` / `<input>`에 값을 입력한 뒤 배치 녹음 시작·종료 흐름을 시뮬레이션하고, `enqueuePipeline` mock의 호출 인자에서 `sessionContext`가 입력값과 일치하는지 검증한다.
  - `배치 모드 — 녹음 전 선택한 회의록 형식이 enqueue payload의 meetingTemplate에 포함된다` — idle에서 meeting template을 변경한 뒤 배치 녹음 종료 시 `enqueuePipeline` mock의 `meetingTemplate` 인자가 변경된 값인지 검증한다.
- mock 준비: `mocks` 객체에 `pipeline.enqueue`를 `vi.fn()`으로 노출한다. `vi.mock("@/lib/db", ...)`로 `saveSession`이 id를 resolve하도록 설정. `mocks.batch.stopAndTranscribe`가 유효한 `BatchStopResult`(`{ partialText: "...", finalBlob: null, segments: [] }`)를 반환하도록 설정.
- **기존 구현이 `sessionContext`·`meetingTemplate`을 `enqueuePipeline`에 이미 전달하므로, Step 1 이후 idle에서 입력이 가능해진 상태에서 이 테스트는 통과할 수 있다.** 주된 목적은 새 흐름(녹음 전 입력 → 녹음 후 payload 반영)의 end-to-end 회귀 보호다.

**GREEN** — 테스트를 통과하는 최소 구현
- 추가 구현 불필요. `recorder.tsx`의 `persistBatchResult`가 `sessionContextForEnqueue(sessionContext)`과 `meetingTemplate`을 이미 enqueue 인자에 포함한다.

**REFACTOR** — 코드 개선
- 없음

---

### Step 5: 배치 모드 — enqueue 성공 후 sessionContext·meetingTemplate 초기화

**RED** — 실패하는 테스트 작성
- 테스트 파일: `src/components/__tests__/recorder-pre-recording-context.test.tsx`
- 테스트 케이스:
  - `배치 모드 — enqueue 성공 후 sessionContext 입력 필드가 빈 값으로 초기화된다` — idle에서 참석자·주제·키워드를 입력 → 배치 녹음 시작·종료(enqueue 성공, `persistError` 미발생) 후, 참석자·주제·키워드 입력 필드의 `value`가 빈 문자열인지 확인한다.
  - `배치 모드 — enqueue 성공 후 meetingTemplate이 기본값으로 초기화된다` — 동일 흐름에서, 회의록 형식 선택기가 `DEFAULT_MEETING_MINUTES_TEMPLATE` 값을 표시하는지 확인한다.
- **현재 `persistBatchResult`에 초기화 로직이 없으므로 두 테스트 모두 실패한다.**

**GREEN** — 테스트를 통과하는 최소 구현
- 구현 파일: `src/components/recorder.tsx`
- `persistBatchResult` 콜백에서 `enqueuePipeline({...})` 호출 직후에 다음을 추가:
  ```tsx
  setSessionContext(EMPTY_SESSION_CONTEXT);
  setMeetingTemplate(DEFAULT_MEETING_MINUTES_TEMPLATE);
  ```
- `setSessionContext`·`setMeetingTemplate`는 `useState`의 안정적 setter이므로 `useCallback` 의존성 배열에 추가할 필요 없다.
- `persistBatchResult`는 `handleBatchRetry`에서도 호출되므로, 재시도 성공 시에도 동일하게 초기화된다.

**REFACTOR** — 코드 개선
- 초기화 호출이 배치·스트리밍 양쪽에 반복될 예정이므로, Step 6 완료 후 공통 인라인 헬퍼 추출을 검토한다.

---

### Step 6: 스트리밍 모드 — enqueue 성공 후 sessionContext·meetingTemplate 초기화

**RED** — 실패하는 테스트 작성
- 테스트 파일: `src/components/__tests__/recorder-pre-recording-context.test.tsx`
- 테스트 케이스:
  - `스트리밍 모드 — enqueue 성공 후 sessionContext 입력 필드가 빈 값으로 초기화된다` — 실시간 모드 설정(`localStorage`에 `mode: "realtime"`) → idle에서 참석자·주제·키워드 입력 → 스트리밍 녹음 시작·종료(enqueue 성공) 후, 입력 필드가 빈 값인지 확인한다.
  - `스트리밍 모드 — enqueue 성공 후 meetingTemplate이 기본값으로 초기화된다` — 위와 동일한 흐름에서 `meetingTemplate` 기본값 복원을 확인한다.
- mock 준비: `mocks.recorder.status`를 `"recording"`으로, `mocks.transcription.finals`에 텍스트를 넣어 빈 녹음이 아닌 상태로 설정. `stopRecording`·`finalizeStreaming`을 resolve하도록 mock. `saveSession` mock이 id를 반환.
- **현재 `stop()`의 스트리밍 경로(inner try 블록)에 초기화 로직이 없으므로 두 테스트 모두 실패한다.**

**GREEN** — 테스트를 통과하는 최소 구현
- 구현 파일: `src/components/recorder.tsx`
- `stop()` 콜백의 스트리밍 경로(`finally` 블록 안의 inner try)에서 `enqueuePipeline({...})` 호출 직후에 다음을 추가:
  ```tsx
  setSessionContext(EMPTY_SESSION_CONTEXT);
  setMeetingTemplate(DEFAULT_MEETING_MINUTES_TEMPLATE);
  ```

**REFACTOR** — 코드 개선
- 배치(Step 5)와 스트리밍(Step 6)의 초기화 호출이 동일하다. 인라인 헬퍼로 중복을 제거한다:
  ```tsx
  const resetSessionInputs = useCallback(() => {
    setSessionContext(EMPTY_SESSION_CONTEXT);
    setMeetingTemplate(DEFAULT_MEETING_MINUTES_TEMPLATE);
  }, []);
  ```
- `persistBatchResult`와 `stop()` 스트리밍 경로에서 `enqueuePipeline()` 뒤에 `resetSessionInputs()`를 호출하도록 통일한다.

---

### Step 7: 저장 실패 시 입력값 유지 및 오류 표시

**RED** — 실패하는 테스트 작성
- 테스트 파일: `src/components/__tests__/recorder-pre-recording-context.test.tsx`
- 테스트 케이스:
  - `배치 모드 — 저장 실패 시 sessionContext 입력값이 유지된다` — idle에서 참석자·주제를 입력 → 배치 녹음 종료 시 `saveSession`이 reject → 참석자·주제 입력 필드에 입력값이 그대로 남아 있는지 확인한다.
  - `배치 모드 — 저장 실패 시 오류 문구가 표시된다` — 위와 같은 조건에서 `data-testid="recorder-pipeline-user-error"` 요소에 `"세션을 저장하지 못했습니다."` 텍스트가 보이는지 확인한다.
- **Steps 5–6에서 성공 경로에만 초기화를 추가했으므로, catch 블록에서는 초기화가 일어나지 않는다. `saveSession`이 throw하면 `enqueuePipeline`·초기화에 도달하지 않고, 상위 catch에서 `setPersistError`만 호출된다. 따라서 두 테스트 모두 통과한다.**

**GREEN** — 테스트를 통과하는 최소 구현
- 추가 구현 불필요. 기존 catch 흐름이 이미 올바르게 동작한다.

**REFACTOR** — 코드 개선
- 없음

---

### Step 8: `recorder-ui-preview.tsx` 프리뷰 단계 라벨·표시 조건 변경

**RED** — 실패하는 테스트 작성
- 이 컴포넌트에 대한 자동화 테스트는 두지 않는다. 수동 검증: `/recorder-preview`에서 idle 단계를 선택했을 때 회의 정보 영역이 보이는지 확인한다.

**GREEN** — 테스트를 통과하는 최소 구현
- 구현 파일: `src/components/recorder-ui-preview.tsx`
- `const showSessionContext = recordingActive;` → `const showSessionContext = true;`
- 단계 라벨 갱신:
  - `idle` 라벨: `"녹음 전 (카드만)"` → `"녹음 전 (카드+컨텍스트)"`
  - `recording` 라벨: `"녹음 중 (컨텍스트까지)"` → `"녹음 중"`

**REFACTOR** — 코드 개선
- `recordingActive` 변수는 `showTranscript`, `displayElapsedMs`, `displayLevel`, `batchRecording` 등에서 여전히 사용되므로 제거하지 않는다.

---

### Step 9: `docs/USER_FLOWS.md` §2 갱신

**RED** — 실패하는 테스트 작성
- 해당 없음. 문서 변경은 수동 검증한다.

**GREEN** — 문서 갱신
- 구현 파일: `docs/USER_FLOWS.md`
- §2 "녹음하기 (홈의 메인 루프)" happy path를 다음 순서로 갱신:
  1. (선택) 설정에서 **전역 용어**를 미리 채운다.
  2. (선택) 녹음 전에 **회의 정보**(참석자·주제·키워드)와 **회의록 형식**을 미리 입력한다.
  3. **시작**을 누른다 → 마이크 권한 허용.
  4. 말한다. 경과 시간·레벨 미터가 움직인다. 회의 정보는 계속 보인다.
  5. **종료**를 누른다.
  6. 곧이어 자동 처리(§3)가 시작되고, 회의 정보·회의록 형식이 초기값으로 되돌려진다.
- edge case에 추가:
  - "세션 저장·enqueue 성공 후 회의 정보와 회의록 형식이 초기값으로 되돌려진다. 저장 실패 시에는 입력값이 유지되고 오류 안내가 보인다."
- 기존 step 3 ("녹음 카드 아래에 회의 정보·템플릿 입력 영역이 펼쳐진다") 삭제 — idle에서 이미 보이므로 "펼쳐진다" 표현이 부적절.

**REFACTOR** — 코드 개선
- 문서 내용이 실제 UI 흐름과 일치하는지 최종 대조한다.

## 파일 변경 계획

| 파일 | 변경 종류 | 변경 내용 요약 |
|------|----------|----------------|
| `src/components/recorder.tsx` | 수정 | `showSessionContext`를 `true`로 변경. `persistBatchResult`와 `stop()` 스트리밍 경로에서 enqueue 성공 후 `sessionContext`·`meetingTemplate` 초기화 추가. 공통 `resetSessionInputs` 헬퍼 추출 |
| `src/components/recorder-ui-preview.tsx` | 수정 | `showSessionContext`를 `true`로 변경. idle 라벨을 `"녹음 전 (카드+컨텍스트)"`로, recording 라벨을 `"녹음 중"`으로 갱신 |
| `src/components/__tests__/recorder-pre-recording-context.test.tsx` | 신규 | idle 노출, 빈 context 시작, enqueue payload 반영, 배치·스트리밍 성공 초기화, 실패 유지·오류 표시 회귀 테스트 (약 11개 케이스) |
| `src/components/__tests__/recorder-phased-ui.test.tsx` | 수정 | `"idle 상태에서 reveal-session-context는 숨김"` 단언을 `"idle 상태에서도 보임"`으로 변경. 테스트 제목 갱신 |
| `docs/USER_FLOWS.md` | 수정 | §2 happy path에 녹음 전 회의 정보 입력 단계 추가. "펼쳐진다" step 삭제. edge case에 초기화·실패 유지 설명 추가 |
| `src/components/session-context-input.tsx` | 변경 없음 | 기존 구조 유지. `disabled` 안내 문구가 이미 적절하므로 수정 불필요 |

## 완료 조건

- `npm run test` 통과 — 신규 `recorder-pre-recording-context.test.tsx` 포함, 수정된 `recorder-phased-ui.test.tsx` 반영
- `npm run lint` 통과
- `npm run typecheck` 통과
- `npm run build` 통과
- `docs/USER_FLOWS.md` §2가 실제 UI 흐름과 일치
- 기존 동작에 regression 없음: 녹음 시작·종료, 빈 녹음 무시, pipeline busy 비활성화, 배치 재시도

## 테스트 전략

**테스트 환경**: `happy-dom` (파일 상단 `/** @vitest-environment happy-dom */`).

**mock 패턴**: 기존 `recorder-phased-ui.test.tsx`와 동일한 `vi.hoisted` + `vi.mock` 구조를 따른다.

- `enqueuePipeline`을 `mocks` 객체에 `vi.fn()`으로 노출하여 호출 인자를 검증한다.
- `vi.mock("@/lib/db", ...)`로 `saveSession`(id resolve 또는 reject)·`saveSessionAudio`를 mock한다.
- `mocks.batch.stopAndTranscribe`가 유효한 `BatchStopResult`를 반환하도록 설정하여 배치 stop 흐름을 시뮬레이션한다.
- 스트리밍 모드 테스트에서는 `mocks.recorder.status = "recording"`, `mocks.transcription.finals`에 텍스트를 넣어 빈 녹음이 아닌 상태를 만든다.
- `MainAppProviders`로 감싸서 렌더링한다.

**테스트 케이스 전체 요약** (약 11개 + 기존 수정 1개):

| # | 테스트 | 파일 | 검증 대상 |
|---|--------|------|-----------|
| 1 | idle에서 reveal-session-context가 보인다 | pre-recording-context | `aria-hidden` 없음 |
| 2 | idle에서 session-context-input·meeting-template이 DOM에 존재 | pre-recording-context | DOM 존재 |
| 3 | 빈 context에서 시작 버튼 활성·클릭 가능 | pre-recording-context | `disabled` 없음, mock 호출 |
| 4 | 배치 — 녹음 전 입력 → enqueue payload sessionContext 반영 | pre-recording-context | `enqueuePipeline` 인자 |
| 5 | 배치 — 녹음 전 선택 → enqueue payload meetingTemplate 반영 | pre-recording-context | `enqueuePipeline` 인자 |
| 6 | 배치 — enqueue 성공 후 sessionContext 초기화 | pre-recording-context | 입력 필드 빈 값 |
| 7 | 배치 — enqueue 성공 후 meetingTemplate 기본값 복원 | pre-recording-context | 선택기 기본값 |
| 8 | 스트리밍 — enqueue 성공 후 sessionContext 초기화 | pre-recording-context | 입력 필드 빈 값 |
| 9 | 스트리밍 — enqueue 성공 후 meetingTemplate 기본값 복원 | pre-recording-context | 선택기 기본값 |
| 10 | 배치 — 저장 실패 시 입력값 유지 | pre-recording-context | 입력 필드 값 유지 |
| 11 | 배치 — 저장 실패 시 오류 문구 표시 | pre-recording-context | 오류 요소 존재 |
| — | idle에서도 reveal-session-context가 보인다 (기존 수정) | phased-ui | `aria-hidden` 없음 |

**커버리지 경계**: 마이크 권한·batch transcription·pipeline 내부 동작은 이슈 비목표이므로 테스트하지 않는다. UI 컴포넌트 레벨에서 idle 노출·payload 전달·초기화·실패 유지에 집중한다.
