# 세션 상세 — 홈 노트형 UI 정렬

## 배경

홈 녹음 화면은 노션·클로바 노트에 가까운 **노트 작업면**(`RecorderNoteWorkspace`: 제목, 참석자·주제·키워드 속성 행, 요약 형식, AI 요약/스크립트 탭과 동일한 표면)과 하단 **고정 녹음 도킹**(`RecordingCard`)으로 재구성되었다.

세션 상세(`SessionDetail`)는 여전히 `MainTranscriptTabs` 중심의 카드형 요약·스크립트 레이아웃이며, 회의 컨텍스트·용어집·요약 모델 등은 스크립트 탭 하단에 모여 있다. 홈과 시각·정보 위계가 어긋나 같은 데이터를 다르게 읽는 느낌을 줄 수 있다.

## 목표

1. **홈과 같은 UI 언어**로 세션 상세를 재구성한다 — 제목·속성 행·요약 형식·탭 표면(`NOTE_TAB_SURFACE` 계열) 등 `RecorderNoteWorkspace`와 최대한 동일한 리듬과 컴포넌트 재사용을 우선한다.
2. **녹음 플로팅 바(하단 고정 `RecordingCard` 도킹)는 세션 상세에 두지 않는다.** 이 화면은 재생·편집·요약 재생성이 목적이며, 녹음 시작은 홈에서만 유지한다.
3. **기존 기능은 유지**한다 — 오디오 세그먼트 ZIP 다운로드, 스크립트 편집·저장, 요약 생성·재생성, 회의 컨텍스트·용어집·요약 모델·스크립트 메타 표시 등. 배치와 그룹핑은 UI/UX 관점에서 자유롭게 바꿔도 된다.
4. **접근성·디자인 토큰**은 [DESIGN.md](../../docs/DESIGN.md), [UI_PATTERNS.md](../../docs/UI_PATTERNS.md)에 맞춘다 — `rose`는 녹음 전용이므로 상세 화면의 일반 액센트에 쓰지 않는다.

## 비목표

- 세션 상세에서 새 녹음을 시작하거나 `RecordingCard`를 노출하는 것.
- 인앱 오디오 미리듣기 플레이어 추가(현재 정책과 테스트가 “미리듣기 없음”을 전제로 한 경우 유지).
- IndexedDB·파이프라인·회의록 API 계약 변경.

## 변경 후보

| 영역 | 후보 |
|------|------|
| 레이아웃 | `src/components/session-detail.tsx` — `MainTranscriptTabs` 대신 `RecorderNoteWorkspace` 패턴(또는 공통 래퍼)으로 상단 메타 + 탭 본문 정렬 |
| 재사용 | `src/components/recorder-note-workspace.tsx` — 상세 전용 props(예: `pipelineBusy` ↔ 요약 생성 중, `children`에 스크립트 에디터) 확장 여부 검토 |
| 헤더/제목 | 세션 `title`을 홈과 동일한 큰 타이포로 **읽기 전용** 표시(입력 필드·저장 없음) |
| 테스트 | `src/components/__tests__/session-detail*.test.tsx` — 탭 라벨·역할, 요약 재생성, 다운로드, 스크립트 저장 회귀 |

## 테스트·완료 조건

- 기존 세션 상세 테스트가 의도에 맞게 갱신되고 `npm test` 통과.
- 오디오가 있을 때 ZIP 다운로드 동작 유지(실패 시 기존과 같이 조용히 복구되는 정책 유지 여부 명시).
- 요약 생성·재생성, 스크립트 저장, `beforeunload` 경고(요약 진행 중) 기존과 동등.
- 세션 상세 라우트에 `data-testid="recording-card-dock"` 또는 동등한 고정 녹음 UI가 **없음**.

## 열린 결정 (구현 전 확정)

- ~~세션 제목을 홈과 같이 상단에서 바로 편집할지, 읽기 전용으로 둘지.~~ **읽기 전용** — 홈과 동일한 큰 제목 타이포로 표시만 하고, 저장·편집은 하지 않는다.
- ~~“요약 생성 설정” 블록을 스크립트 탭 안에 둘지, 별도 접이식 **도구** 영역으로 뺄지.~~ **스크립트 탭 하단 유지(A)** — 편집·재생성 맥락을 한 탭에 둔다.
- ~~`MainTranscriptTabs`를 완전히 제거할지, 내부적으로 탭 라벨만 홈과 맞출지.~~ **상세에서는 제거** — `RecorderNoteWorkspace` 탭(“AI 요약” / “스크립트”)으로 통일. `MainTranscriptTabs` 컴포넌트·테스트는 다른 경로용으로 유지 가능.

## 구현 메모 (안 1 반영)

- `RecorderNoteWorkspace`에 `summaryPanelContent`, `titleReadOnly` 추가. 상세는 `summaryPanelContent`로 실제 요약 마크다운·복사·빈 상태를 넣고, 제목은 `session.title` 읽기 전용 `h2`.
- `SessionDetail`은 상단 오디오 ZIP 다운로드 유지, 본문은 `max-w-5xl` + 노트 작업면. 회의 정보·요약 형식은 작업면 속성 행만 사용(`SessionContextInput` 중복 제거). 요약 생성 블록은 스크립트 탭 하단 유지.
- 세션 상세 테스트의 탭 역할 이름을 “AI 요약”으로 맞춤.
