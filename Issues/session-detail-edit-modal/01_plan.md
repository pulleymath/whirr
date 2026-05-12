---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "session-detail-edit-modal"
---

# 세션 상세 편집 모달 — 개발 계획서

## 개발 범위

이슈 `session-detail-edit-modal`은 세션 상세 페이지를 **읽기 전용 표면으로 정돈**하고, 편집·재생성 컨트롤을 **모달 다이얼로그(`SessionEditDialog`)**로 분리하는 작업이다.

### 핵심 변경

1. **속성 행 추출** — `RecorderNoteWorkspace` 내부의 `NotionPropertyRow` + 편집 인풋을 독립 컴포넌트로 추출하여 읽기 전용 블록 / 편집 가능 블록으로 분리.
2. **세션 상세 페이지 읽기 전용화** — 인라인 편집 컨트롤·"요약 생성" 섹션 제거. 속성은 값만 표시. 스크립트는 플레인 텍스트. 헤더에 `[오디오 다운로드][편집]`.
3. **SessionEditDialog 신설** — `SettingsPanel` 패턴 차용. 회의 정보 폼 + 스크립트 textarea + 용어집·요약 모델·생성 버튼 + dirty 확인 + 저장/닫기.
4. **요약 생성 흐름 변경** — 생성 클릭 시 암묵적 저장 → 모달 즉시 닫기 → 페이지에 진행 표시 → 완료 후 결과 반영.
5. **기타 정돈** — 다운로드 버튼 헤더 이동, `SessionScriptMetaDisplay` 스크립트 탭 상단 이동, 빈 요약 안내 카피 갱신.

### 비목표 (건드리지 않는 것)

- IDB 스키마·파이프라인·회의록 API 변경 없음.
- 요약 히스토리 기능 없음.
- 홈 `Recorder` 인터랙션 모델 변경 없음 (리팩터로 추출된 컴포넌트만 내부적으로 사용).
- 노트 제목 편집·인앱 오디오 플레이어·모달 내 요약 결과 보기 없음.

## 기술적 접근 방식

### 컴포넌트 추출 전략

현재 `RecorderNoteWorkspace` 안에 `NotionPropertyRow` 레이아웃 + 인풋 4개(참석자·주제·키워드·요약 형식) + `NOTION_CONTROL_CLASS` 스타일이 합쳐져 있다.

**추출 결과물:**

| 새 파일 | 역할 |
|---------|------|
| `src/components/session-property-rows.tsx` | `NotionPropertyRow` 레이아웃 원자 + `SessionPropertyRowsReadOnly` (값만 표시) + `SessionPropertyRowsEditable` (인풋 활성) |

- `SessionPropertyRowsReadOnly`: `sessionContext` + `meetingTemplate`를 받아 값만 텍스트로 렌더. 빈 값은 `—` 또는 placeholder 톤.
- `SessionPropertyRowsEditable`: 기존 `RecorderNoteWorkspace`의 인풋 4행과 동일. `onChange` 콜백 + `disabled` prop.
- `RecorderNoteWorkspace`는 내부적으로 `SessionPropertyRowsEditable`을 import해서 사용 → 홈 동작 불변.

### 모달 패턴

`SettingsPanel`(`src/components/settings-panel.tsx`)을 참조:

- 최외곽: `fixed inset-0 z-60`, 배경 `<button>` 클릭 닫기.
- 내부: `role="dialog"` + `aria-modal="true"` + `aria-labelledby`.
- 크기: 데스크탑 `max-w-2xl` (스크립트 편집 폭 확보), 모바일 bottom sheet (`rounded-t-xl`, `items-end`).
- ESC 닫기: `onKeyDown` 또는 `useEffect` keydown listener.
- 높이: `max-h-[min(90vh,48rem)]` + 본문 `overflow-y-auto`.

### 요약 생성 흐름 (모달 → 페이지 진행)

1. 사용자가 모달에서 "요약 생성" 클릭.
2. 모달 내부에서 `updateSession` (폼 값 저장) 호출.
3. 콜백을 통해 부모(`SessionDetailReadyContent`)의 `handleMeetingMinutes`를 호출.
4. **모달 즉시 닫기** (`setEditOpen(false)`).
5. 페이지에서 `mmLoading=true` 상태로 진행 표시 (헤더 영역 또는 탭 영역에 스피너 + "요약 생성 중…" 텍스트).
6. `useBeforeUnload(mmLoading)` 유지 — 모달 열림/닫힘과 무관하게 페이지 이탈 보호.
7. 완료 시 `onSessionRefresh()` → 결과 반영.

### dirty 확인 전략

모달 내부에서 `isDirty` 계산: 열릴 때 초기값 스냅샷 저장, 현재 폼 값과 비교. 닫기 시도 시 dirty면 `window.confirm("저장하지 않은 변경이 있습니다. 닫으시겠어요?")` 또는 간단한 인라인 확인 UI.

## TDD 구현 순서

### Step 1: 속성 행 컴포넌트 추출

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/session-property-rows.test.tsx`
- 테스트 케이스 목록:
  - `SessionPropertyRowsReadOnly`가 참석자·주제·키워드·요약 형식 값을 텍스트로 렌더한다
  - `SessionPropertyRowsReadOnly`에서 빈 값은 `—`(또는 placeholder 톤) 표시한다
  - `SessionPropertyRowsReadOnly`에 input/select가 존재하지 않거나 readOnly이다
  - `SessionPropertyRowsEditable`가 4개 인풋을 렌더하고 onChange가 동작한다
  - `SessionPropertyRowsEditable`에서 `disabled=true`이면 인풋이 비활성이다
  - `SessionPropertyRowsEditable`의 요약 형식이 `MeetingTemplateSelector`를 렌더한다

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/session-property-rows.tsx`
- 핵심 구현 내용:
  - `RecorderNoteWorkspace`에서 `NotionPropertyRow`, `NOTION_CONTROL_CLASS` 추출
  - `SessionPropertyRowsReadOnly` 컴포넌트: `sessionContext` + `meetingTemplate` props → 라벨 + 값 텍스트
  - `SessionPropertyRowsEditable` 컴포넌트: 기존 `RecorderNoteWorkspace`의 인풋 4행을 그대로 이동
  - 두 컴포넌트 모두 `NotionPropertyRow` 레이아웃 재사용

**REFACTOR** — 코드 개선

- `NotionPropertyRow`를 named export로 공개 (레이아웃 원자로서 재사용 가능)
- 컴포넌트 props 타입에 JSDoc 추가

---

### Step 2: RecorderNoteWorkspace 리팩터

**RED** — 실패하는 테스트 작성

- 테스트 파일: 기존 홈 녹음 관련 테스트 (회귀 확인)
- 테스트 케이스 목록:
  - `RecorderNoteWorkspace`가 `SessionPropertyRowsEditable`을 렌더하고 기존 인풋이 동작한다
  - 홈 `Recorder` 컴포넌트의 녹음 흐름에 변화가 없다 (기존 테스트 그대로 통과)
  - `pipelineBusy=true`일 때 인풋 비활성 동작 유지

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder-note-workspace.tsx`
- 핵심 구현 내용:
  - 내부 `NotionPropertyRow` 정의 제거, `session-property-rows.tsx`에서 `SessionPropertyRowsEditable` import
  - 기존 인풋 4행을 `<SessionPropertyRowsEditable ... />` 한 줄로 교체
  - props 인터페이스 변경 없음 — 홈 `Recorder`는 코드 수정 불필요

**REFACTOR** — 코드 개선

- `NOTION_CONTROL_CLASS` 정의가 `session-property-rows.tsx`로 이동되었으므로 workspace에서 제거
- import 정리

---

### Step 3: 세션 상세 페이지 읽기 전용 셸

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/session-detail.test.tsx` (기존 파일 수정)
- 테스트 케이스 목록:
  - 페이지에 `textarea`(`session-detail-script-textarea`)가 존재하지 않는다 (스크립트는 플레인 텍스트)
  - 페이지에 "요약 생성" 버튼이 존재하지 않는다
  - 속성 행이 값만 표시하고 input이 존재하지 않는다
  - 헤더에 "편집" 버튼(`Pencil` 아이콘)이 있다
  - 오디오가 있으면 헤더에 `[오디오 다운로드][편집]` 순서로 액션이 보인다
  - 오디오가 없으면 다운로드 버튼만 미노출, 편집 버튼은 보인다
  - 스크립트 탭 상단에 `SessionScriptMetaDisplay`가 표시된다 (scriptMeta가 있을 때)
  - AI 요약 빈 상태에서 "편집에서 요약을 생성하세요" 안내가 표시된다
  - 스크립트 복사 버튼 동작 유지 (플레인 텍스트 복사)

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/session-detail.tsx`
- 핵심 구현 내용:
  - `SessionDetailReadyContent`에서 `RecorderNoteWorkspace` 사용을 제거하고 직접 읽기 전용 레이아웃 구성:
    - 노트 제목 `h2` (기존 유지)
    - `<SessionPropertyRowsReadOnly ... />` (새 컴포넌트)
    - 탭 UI (AI 요약 / 스크립트) — 기존 `NOTE_TAB_SURFACE_CLASS` 등 스타일은 공유 또는 인라인
  - 스크립트 탭: `<pre>` 또는 `<p>` 플레인 텍스트 + 복사 버튼 + `SessionScriptMetaDisplay` 상단 배치
  - AI 요약 탭: 마크다운 렌더 (기존 유지) + 빈 상태 카피 갱신
  - "요약 생성" 섹션 전체 제거
  - 헤더 액션바: `[오디오 다운로드][편집]` — 다운로드는 `audioSegments.length > 0` 조건부
  - 편집 버튼: `Pencil` 아이콘 + "편집" 라벨, `onClick` → `setEditOpen(true)`
  - 탭 스타일 상수(`NOTE_TAB_SURFACE_CLASS`, `NOTE_TAB_BUTTON_BASE`)를 `recorder-note-workspace.tsx`에서 export하거나 별도 공유 파일로 이동

**REFACTOR** — 코드 개선

- 인라인 편집 관련 state 제거 (`scriptDraft`, `scriptDirty`, `handleSaveScript` 등 — 이 로직은 Step 4에서 모달로 이동)
- 사용하지 않는 import 정리
- 탭 컴포넌트를 `NoteTabLayout` 등으로 추출할 수 있으면 추출 검토 (스코프 제한: 필요 시에만)

---

### Step 4: SessionEditDialog 모달

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/session-edit-dialog.test.tsx` (신규)
- 테스트 케이스 목록:
  - `open=true`이면 `role="dialog"` + `aria-modal="true"`가 렌더된다
  - `open=false`이면 다이얼로그가 렌더되지 않는다
  - 모달 헤더에 "노트 편집" 제목이 표시된다
  - 회의 정보 인풋 4개(참석자·주제·키워드·요약 형식)가 활성 상태로 렌더된다
  - 인풋에 세션 데이터가 초기값으로 채워진다
  - 스크립트 textarea가 세션 텍스트로 초기화된다
  - `SessionGlossaryEditor`와 `SessionMinutesModelSelect`가 렌더된다
  - 푸터에 "닫기"와 "저장" 버튼이 있다
  - 배경 클릭 시 `onClose`가 호출된다
  - ESC 키 시 `onClose`가 호출된다
  - "닫기" 버튼 클릭 시 `onClose`가 호출된다
  - "저장" 클릭 시 `updateSession`이 현재 폼 값으로 호출된다
  - 저장 성공 시 `onSave` 콜백 호출 후 모달이 닫힌다
  - 저장 실패 시 에러 메시지 표시, 모달은 열린 상태 유지
  - "요약 생성/재생성" 버튼이 세션에 summary가 있으면 "재생성" 라벨
  - "요약 생성" 클릭 시 `onGenerateSummary` 콜백이 호출된다
  - 스크립트가 비어 있으면 "요약 생성" 버튼이 비활성

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/session-edit-dialog.tsx` (신규)
- 핵심 구현 내용:
  - Props: `open`, `session`, `onClose`, `onSave`, `onGenerateSummary`
  - `SettingsPanel` 패턴 차용: `fixed inset-0 z-60` + 배경 버튼 + `role="dialog"` + `aria-modal="true"`
  - 크기: 데스크탑 `max-w-2xl`, 모바일 bottom sheet
  - 내부 state: `contextDraft`, `glossaryDraft`, `minutesModelDraft`, `templateDraft`, `scriptDraft`
  - 본문: `<SessionPropertyRowsEditable ... />` + 스크립트 textarea + `SessionGlossaryEditor` + `SessionMinutesModelSelect` + 생성 버튼
  - 푸터: 닫기(ghost) + 저장(primary)
  - ESC listener: `useEffect` + `keydown` 이벤트
  - 저장: `updateSession(session.id, { text, context, scriptMeta })` → `onSave()` → 닫기
  - 생성: 폼 값으로 `updateSession` → `onGenerateSummary(scriptDraft, contextDraft, glossaryDraft, minutesModelDraft, templateDraft)` 호출 (부모에서 모달 닫기 + 파이프라인 시작)

**REFACTOR** — 코드 개선

- 폼 초기화 로직을 커스텀 훅 `useSessionEditForm(session)` 등으로 분리 검토 (복잡도에 따라)
- `session-detail.tsx`의 기존 `handleMeetingMinutes` 로직을 모달 콜백과 연결하는 부분 정리

---

### Step 5: dirty 확인 다이얼로그

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/session-edit-dialog.test.tsx` (기존 파일에 추가)
- 테스트 케이스 목록:
  - 폼 변경 없이 닫기 시 확인 없이 바로 닫힌다
  - 인풋을 수정한 뒤 닫기 시 확인 다이얼로그가 표시된다 (또는 `window.confirm` 호출)
  - 확인에서 "닫기(폐기)" 선택 시 모달이 닫힌다
  - 확인에서 "취소" 선택 시 모달이 열린 상태로 유지된다
  - 스크립트를 수정한 뒤 배경 클릭 시에도 dirty 확인이 동작한다
  - 스크립트를 수정한 뒤 ESC 시에도 dirty 확인이 동작한다
  - 저장 후에는 dirty가 리셋되어 닫기 시 확인 없음

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/session-edit-dialog.tsx` (수정)
- 핵심 구현 내용:
  - `isDirty` 계산: 열릴 때 `initialSnapshot` 저장 → 현재 값과 shallow compare
  - `handleClose` 함수: `isDirty ? window.confirm("저장하지 않은 변경이 있습니다. 닫으시겠어요?") : true` → true면 `onClose()`
  - 배경 클릭·ESC·닫기 버튼 모두 `handleClose` 경유

**REFACTOR** — 코드 개선

- dirty 비교 로직을 `isSessionFormDirty(initial, current)` 순수 함수로 추출
- `window.confirm` 대신 추후 커스텀 확인 UI로 교체 가능한 구조 유지

---

### Step 6: 요약 생성 — 모달 닫기 + 페이지 진행 표시

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/session-detail.test.tsx` (기존 파일에 추가) + `src/components/__tests__/session-detail-mm-before-unload.test.tsx` (수정)
- 테스트 케이스 목록:
  - 편집 모달에서 "요약 생성" 클릭 → 모달이 즉시 닫힌다
  - 생성 진행 중 페이지에 "요약 생성 중…" 진행 표시가 보인다
  - 생성 완료 후 진행 표시가 사라지고 AI 요약 탭에 결과가 반영된다
  - 생성 진행 중 "편집" 버튼이 비활성이다 (또는 진행 중 표시)
  - 생성 실패 시 페이지에 에러 메시지가 표시된다
  - `useBeforeUnload(mmLoading)` — 생성 요청이 끝날 때까지 보호 켜짐 (기존 테스트 패턴 유지)
  - 생성 진행 중 모달을 다시 열 수 없다 (또는 열면 읽기 전용 상태)

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/session-detail.tsx` (수정)
- 핵심 구현 내용:
  - `SessionDetailReadyContent`에 `editOpen` state + `SessionEditDialog` 렌더
  - `onGenerateSummary` 콜백 구현: 모달에서 전달받은 폼 값으로 `handleMeetingMinutes` 호출 → `setEditOpen(false)` 즉시
  - 기존 `handleMeetingMinutes` 로직을 모달 콜백 인터페이스에 맞게 조정 (인자로 폼 값 수신)
  - 페이지 진행 표시: `mmLoading` 상태일 때 헤더 또는 탭 영역에 `<Loader2 className="animate-spin" />` + "요약 생성 중…" 텍스트
  - `mmLoading` 중 편집 버튼 비활성화
  - `useBeforeUnload(mmLoading)` 위치 유지 (SessionDetailReadyContent 레벨)

**REFACTOR** — 코드 개선

- `handleMeetingMinutes`의 폼 값 의존성을 파라미터 기반으로 변경 (state에서 읽지 않고 인자로 받음)
- 사용하지 않는 인라인 편집 state/effect 정리

---

### Step 7: 기존 테스트 회귀 검증 + 누락 테스트 보강

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/session-detail-idb-failure.test.tsx`, `src/components/__tests__/session-detail-audio.test.tsx`, `src/components/__tests__/session-detail-badid.test.tsx` (수정)
- 테스트 케이스 목록:
  - (audio) 다운로드 버튼이 헤더 영역에 표시된다 (위치 변경 반영)
  - (audio) 다운로드 클릭 → zip 다운로드 유틸 호출 유지
  - (audio) 오디오 없으면 다운로드 버튼 미노출 유지
  - (idb-failure) 모달에서 저장 실패 시 에러 문구 표시 (새 흐름에 맞게 갱신)
  - (badid) 잘못된 세션 ID 처리 유지
  - (mm-before-unload) 모달에서 생성 시작 → 모달 닫힘 → `useBeforeUnload(true)` 확인 → 완료 → `useBeforeUnload(false)` 확인

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: 기존 테스트 파일 수정
- 핵심 구현 내용:
  - 기존 테스트의 인라인 편집 기반 assertions을 모달 기반으로 갱신
  - 예: `fireEvent.click(screen.getByRole("tab", { name: "스크립트" }))` → `fireEvent.click(screen.getByRole("button", { name: "편집" }))` + 모달 내 조작
  - `session-detail.test.tsx`의 스크립트 저장 테스트 → 모달 열기 → textarea 수정 → 저장 버튼 → 모달 닫힘 + updateSession 호출 확인
  - `session-detail.test.tsx`의 요약 생성 테스트 → 모달 열기 → 생성 버튼 → 모달 닫힘 + fetchMeetingMinutesSummary 호출 + 페이지 결과 반영

**REFACTOR** — 코드 개선

- 테스트 헬퍼 `openEditModal()` 추출 — 여러 테스트에서 반복되는 "편집 버튼 클릭 → 모달 열림 대기" 패턴
- 테스트 간 중복 mock 설정 정리

## 파일 변경 계획

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `src/components/session-property-rows.tsx` | **신규** | `NotionPropertyRow` 원자 + `SessionPropertyRowsReadOnly` + `SessionPropertyRowsEditable` |
| `src/components/session-edit-dialog.tsx` | **신규** | 편집 모달 다이얼로그 (SettingsPanel 패턴) |
| `src/components/recorder-note-workspace.tsx` | **수정** | 내부 `NotionPropertyRow`·인풋 4행을 `SessionPropertyRowsEditable` import로 교체. `NOTE_TAB_SURFACE_CLASS` 등 탭 스타일 상수 export. |
| `src/components/session-detail.tsx` | **대폭 수정** | 읽기 전용 레이아웃으로 재구성. 인라인 편집 제거. 헤더 액션바. `SessionEditDialog` 연결. 요약 생성 흐름 변경. |
| `src/components/__tests__/session-property-rows.test.tsx` | **신규** | 속성 행 컴포넌트 단위 테스트 |
| `src/components/__tests__/session-edit-dialog.test.tsx` | **신규** | 모달 열기/닫기, dirty 확인, 저장, 생성 테스트 |
| `src/components/__tests__/session-detail.test.tsx` | **대폭 수정** | 읽기 전용 페이지 assertions + 모달 기반 편집 흐름으로 갱신 |
| `src/components/__tests__/session-detail-idb-failure.test.tsx` | **수정** | 모달 기반 저장 실패 흐름 갱신 |
| `src/components/__tests__/session-detail-mm-before-unload.test.tsx` | **수정** | 모달에서 생성 시작 → 모달 닫힘 → beforeunload 보호 검증 |
| `src/components/__tests__/session-detail-audio.test.tsx` | **수정** | 다운로드 버튼 위치 변경 반영 (헤더 영역) |
| `src/components/__tests__/session-detail-badid.test.tsx` | **최소 수정** | 기존 동작 확인 (변경 없을 수 있음) |

## 완료 조건

1. **읽기 전용 페이지**: 속성 행은 값만, 스크립트는 플레인 텍스트, "요약 생성" 섹션 없음.
2. **헤더 액션**: `[오디오 다운로드][편집]` 순. 오디오 없으면 다운로드 미노출.
3. **모달 동작**: 편집 버튼 → dialog 열림 → ESC/배경/닫기로 닫힘 → dirty 확인 작동.
4. **저장**: 모달에서 저장 → IDB 반영 → 페이지 갱신 → 모달 닫힘. 실패 시 에러 표시.
5. **요약 생성**: 모달에서 생성 → 암묵적 저장 → 모달 즉시 닫힘 → 페이지 진행 표시 → 완료 시 결과 반영.
6. **beforeunload**: `mmLoading` 중 페이지 이탈 경고 유지.
7. **홈 회귀 없음**: `Recorder` + `RecorderNoteWorkspace` 동작 불변.
8. **품질 게이트 통과**: `npm test`, `npx tsc --noEmit`, `npx eslint .`, `npx prettier --check .`, `npm run build`.

## 테스트 전략

### 테스트 파일 목록

| 테스트 파일 | 환경 | 범위 |
|------------|------|------|
| `src/components/__tests__/session-property-rows.test.tsx` | happy-dom | 속성 행 읽기/편집 단위 테스트 |
| `src/components/__tests__/session-edit-dialog.test.tsx` | happy-dom | 모달 렌더·ESC·배경·dirty·저장·생성 |
| `src/components/__tests__/session-detail.test.tsx` | happy-dom | 읽기 전용 페이지 + 모달 연동 통합 |
| `src/components/__tests__/session-detail-idb-failure.test.tsx` | happy-dom | IDB 실패 경로 (모달 기반) |
| `src/components/__tests__/session-detail-mm-before-unload.test.tsx` | happy-dom | 모달 생성 → 닫힘 → beforeunload |
| `src/components/__tests__/session-detail-audio.test.tsx` | happy-dom | 오디오 다운로드 헤더 배치 |
| `src/components/__tests__/session-detail-badid.test.tsx` | happy-dom | 잘못된 ID 처리 (변경 최소) |

### Mock 전략

- `@/lib/db`: `getSessionById`, `getSessionAudio`, `updateSession` — 기존 패턴 유지
- `@/lib/meeting-minutes/fetch-meeting-minutes-client`: `fetchMeetingMinutesSummary` — 기존 패턴
- `@/hooks/use-before-unload`: spy mock으로 호출 인자 검증
- `@/lib/download-recording`: `downloadRecordingZip` — 기존 패턴
- `next/navigation`: `useParams` — 기존 패턴
- `window.confirm`: `vi.stubGlobal`로 dirty 확인 테스트

### 검증 흐름

1. Step별 RED → GREEN → REFACTOR 사이클 준수
2. 각 Step 완료 후 `npm run test` 전체 통과 확인
3. 최종 Step 완료 후 `npm run test && npx tsc --noEmit && npx eslint . && npx prettier --check . && npm run build` 전체 통과
