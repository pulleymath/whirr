---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "session-detail-home-note-ui"
---

# session-detail-home-note-ui — 개발 계획서

## 개발 범위

세션 상세(`SessionDetail`)를 홈 녹음 화면(`RecorderNoteWorkspace`)과 동일한 노트형 UI로 재구성한다.

| 범위 | 설명 |
|------|------|
| **포함** | `RecorderNoteWorkspace` 재사용(탭 라벨 "AI 요약"/"스크립트", 속성 행, 제목), 제목 읽기전용 표시, `MainTranscriptTabs`·`SessionContextInput` 중복 제거, `RecordingCard` 미노출 보장, 기존 기능(ZIP 다운로드·스크립트 저장·요약 생성/재생성·용어집·모델·메타) 유지 |
| **제외** | 세션 상세에서 새 녹음 시작, 인앱 오디오 플레이어 추가, IndexedDB·API 계약 변경 |

### 현재 구현 상태

Working tree에 구현이 **이미 존재**한다.

따라서 본 계획은 **검증 중심(verification-only)** 스텝으로 구성하며, 누락된 회귀 테스트를 보강하는 RED/GREEN 스텝을 포함한다.

## 기술적 접근 방식

1. **컴포넌트 재사용**: `RecorderNoteWorkspace`에 `summaryPanelContent`(요약 패널 슬롯)와 `titleReadOnly`(읽기전용 제목) props를 추가하여 홈/상세 양쪽에서 동일 컴포넌트를 사용한다.
2. **중복 제거**: `SessionContextInput`은 상세에서 제거하고 `RecorderNoteWorkspace` 내장 속성 행(참석자·주제·키워드·요약 형식)으로 통일한다.
3. **탭 통일**: `MainTranscriptTabs`(요약/스크립트) 대신 `RecorderNoteWorkspace` 내장 탭("AI 요약"/"스크립트")을 사용한다.
4. **기능 보존**: ZIP 다운로드, 스크립트 편집·저장, 요약 생성·재생성, 용어집, 모델 선택, 스크립트 메타, `beforeunload` 경고는 기존과 동일하게 유지한다.

## TDD 구현 순서

### Step 1: 탭 라벨 통일 — "AI 요약" / "스크립트"

> **상태: 구현 완료 → 검증만 수행**

**VERIFY (GREEN 확인)**

- 테스트 파일: `src/components/__tests__/session-detail.test.tsx`
- 검증: 모든 탭 접근 코드가 `screen.getByRole("tab", { name: "AI 요약" })`을 사용하는지 확인
- 검증: `screen.getByRole("tab", { name: "스크립트" })`로 스크립트 탭 접근 가능
- 검증: 기본 탭이 "AI 요약"이며 `aria-selected="true"`

**VERIFY (구현 확인)**

- 구현 파일: `src/components/session-detail.tsx`
- 확인: `MainTranscriptTabs` import 없음
- 확인: `RecorderNoteWorkspace`를 import하고 사용

### Step 2: RecordingCard 부재 확인

> **상태: 신규 회귀 테스트 추가**

**RED — 실패하는 테스트 작성**

- 테스트 파일: `src/components/__tests__/session-detail.test.tsx`
- 테스트명: `"세션 상세에 RecordingCard 도킹이 없다"`
- 단언: `expect(screen.queryByTestId("recording-card-dock")).toBeNull()`

**GREEN — 통과 확인**

- 구현 파일: 변경 없음 (이미 `RecordingCard`를 사용하지 않음)

### Step 3: 제목 읽기전용 표시

> **상태: 구현 완료 → 검증 + 회귀 테스트 보강**

**RED — 실패하는 테스트 작성**

- 테스트 파일: `src/components/__tests__/session-detail.test.tsx`
- 테스트명: `"세션 제목을 읽기전용 h2로 표시한다"`
- 단언: `recorder-note-title`이 `H2`, `textbox` 노트 제목 없음, 세션 제목 텍스트 표시

**GREEN — 통과 확인**

- 구현 파일: `src/components/recorder-note-workspace.tsx`, `src/components/session-detail.tsx`

### Step 4: 요약 생성 설정 — 스크립트 탭 하단 유지

> **상태: 구현 완료 → 검증만 수행**

**VERIFY**

- 기존 테스트로 간접 검증, `session-detail.tsx`에 `SessionContextInput` import 없음, `aria-label="요약 생성 설정"` 섹션이 스크립트 본문 내부

### Step 5: 기존 기능 회귀 테스트

**VERIFY — 기존 테스트 전체 통과**

- `session-detail.test.tsx`, `session-detail-idb-failure.test.tsx`, `session-detail-mm-before-unload.test.tsx`

**RED — ZIP 다운로드 회귀 테스트**

- 테스트 파일: `src/components/__tests__/session-detail.test.tsx`
- 오디오 있을 때 버튼 노출, 없을 때 미노출

**GREEN**

- 구현 변경 없음

### Step 6: 접근성 회귀 확인

**VERIFY** — 기존 테스트 및 탭/패널 역할 유지

## 파일 변경 계획

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `src/components/session-detail.tsx` | 수정 | `RecorderNoteWorkspace`, ZIP, 스크립트·요약 본문 |
| `src/components/recorder-note-workspace.tsx` | 수정 | `summaryPanelContent`, `titleReadOnly` |
| `src/components/__tests__/session-detail.test.tsx` | 수정 | 탭 라벨 + 회귀 테스트 보강 |
| `src/components/__tests__/session-detail-idb-failure.test.tsx` | 수정 | 탭 라벨 |
| `src/components/__tests__/session-detail-mm-before-unload.test.tsx` | 수정 | 탭 라벨 |

## 완료 조건

- `npm test` — 세션 상세 관련 테스트 전체 통과
- 세션 상세에 `data-testid="recording-card-dock"` 없음 — 테스트로 보장
- 탭 라벨 "AI 요약" / "스크립트"
- 세션 제목 읽기전용 `<h2>` — 테스트로 보장
- ZIP 다운로드 조건부 노출 — 테스트로 보장
- 요약 생성·재생성, 스크립트 저장, `beforeunload` — 기존 테스트 통과

## 테스트 전략

Vitest + Testing Library. 세션 상세 3파일 회귀 + 신규 도킹 부재·제목·ZIP 테스트.

```bash
npm test -- --run src/components/__tests__/session-detail.test.tsx src/components/__tests__/session-detail-idb-failure.test.tsx src/components/__tests__/session-detail-mm-before-unload.test.tsx
```
