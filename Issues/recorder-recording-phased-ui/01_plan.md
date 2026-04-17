---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "recorder-recording-phased-ui"
---

# Recorder 녹음 단계 UI — 개발 계획서

## 개발 범위

현재 `Recorder` 컴포넌트는 `RecordingCard`, `SessionContextInput`, `TranscriptView` 세 블록을 녹음 상태와 무관하게 항상 렌더링한다. 이 작업에서는 **녹음 진행 단계**에 따라 블록을 점진적으로 노출하고, 등장 시 세련된 CSS 전환(blur→clear, translate, opacity)을 적용한다.

**단계별 가시성 규칙:**

| 단계                | RecordingCard | SessionContextInput    | TranscriptView         |
| ------------------- | ------------- | ---------------------- | ---------------------- |
| 녹음 시작 전 (idle) | 보임          | 숨김                   | 숨김                   |
| 녹음 중 (recording) | 보임          | 보임 (등장 애니메이션) | 숨김                   |
| 첫 스크립트 존재    | 보임          | 보임                   | 보임 (등장 애니메이션) |

**첫 스크립트 존재 판정:**

- **실시간 모드**: `finals.length > 0` 또는 `partial.length > 0`
- **배치 모드**: `batchTranscriptText`가 비어있지 않거나, 녹음 중 배치 파이프라인 상태 텍스트가 존재

**애니메이션 명세:**

- `SessionContextInput`·`TranscriptView` 등장: `opacity 0→1`, `filter blur(6px)→blur(0)`, `translateY(8px)→0` — `duration-300 ease-out`
- `RecordingCard`가 위로 밀리는 레이아웃 전환: 기존 `gap-6` flex 레이아웃이 자연스럽게 처리
- `prefers-reduced-motion: reduce` 시 모든 전환을 즉시 적용 (duration/delay 제거)

**범위 밖:**

- `RecordingCard`, `SessionContextInput`, `TranscriptView` 내부 구조 변경 없음
- 새로운 npm 의존성 추가 없음 (Tailwind CSS 전환만 사용)

## 기술적 접근 방식

### 상태 파생

`Recorder` 내부에서 기존 상태 변수들을 조합하여 두 개의 파생 불리언을 계산한다:

```typescript
const showSessionContext = recordingActive;

const hasTranscript = isBatchMode
  ? Boolean(batchTranscriptText)
  : finals.length > 0 || partial.length > 0;
const showTranscript = recordingActive && hasTranscript;
```

### 등장 애니메이션 래퍼

`<RevealSection>` 유틸 컴포넌트를 `recorder.tsx` 내부 또는 별도 파일 없이 인라인으로 구현한다. DOM에서 완전히 제거하지 않고 **조건부 CSS 클래스** 토글로 처리하여, 마운트 시점 애니메이션이 자연스럽게 동작하도록 한다.

```
visible:   opacity-100 blur-0 translate-y-0
hidden:    opacity-0 blur-sm translate-y-2 pointer-events-none h-0 overflow-hidden
transition: duration-300 ease-out
```

`pointer-events-none`과 `h-0 overflow-hidden`으로 숨긴 블록이 레이아웃과 접근성 트리에서 제외되도록 한다. `aria-hidden` 토글도 함께 적용한다.

### prefers-reduced-motion

Tailwind `motion-safe:` / `motion-reduce:` variant를 활용하여 transition duration과 blur를 조건부로 적용한다. `motion-reduce:` 시 `duration-0`으로 즉시 전환.

### 레이아웃 전환

숨겨진 블록이 `h-0`에서 `h-auto`로 바뀌면서 `RecordingCard` 아래 공간이 자연스럽게 확장된다. flex gap이 이 과정을 부드럽게 처리한다. 숨겨진 상태에서는 `gap` 영향을 받지 않도록 `h-0 m-0 p-0 overflow-hidden` 조합을 사용한다.

## TDD 구현 순서

### Step 1: 가시성 상태 파생 로직 — idle 상태에서 SessionContextInput·TranscriptView 숨김

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-phased-ui.test.tsx`
- 테스트 케이스 목록:
  - `idle 상태에서 session-context-input이 보이지 않는다`
  - `idle 상태에서 transcript-view-card가 보이지 않는다`
  - `idle 상태에서 recording-card는 보인다`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder.tsx`
- `showSessionContext`, `showTranscript` 파생 변수 추가
- `SessionContextInput`과 `TranscriptView`를 래퍼로 감싸되, `showSessionContext === false`일 때 `aria-hidden="true"`와 시각적 숨김 클래스 적용
- 테스트에서는 `aria-hidden` 또는 CSS hidden 상태로 가시성 판정

**REFACTOR** — 코드 개선

- 래퍼 패턴을 `RevealSection` 인라인 컴포넌트로 추출하여 중복 제거

### Step 2: 녹음 중 SessionContextInput 표시

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-phased-ui.test.tsx`
- 테스트 케이스 목록:
  - `배치 녹음 중일 때 session-context-input이 보인다`
  - `스트리밍 녹음 중일 때 session-context-input이 보인다`
  - `녹음 중에도 transcript-view-card는 아직 숨겨져 있다 (스크립트 없을 때)`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder.tsx`
- `useRecorder` / `useBatchTranscription` mock에서 `status: "recording"` 반환하는 테스트 헬퍼 추가
- `showSessionContext = recordingActive`이 이미 true가 되므로 래퍼의 visible 클래스 토글이 동작

**REFACTOR** — 코드 개선

- 테스트 헬퍼 함수(mock override)를 파일 상단 유틸로 정리

### Step 3: 첫 스크립트 존재 시 TranscriptView 표시 — 실시간 모드

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-phased-ui.test.tsx`
- 테스트 케이스 목록:
  - `스트리밍 녹음 중 partial이 존재하면 transcript-view-card가 보인다`
  - `스트리밍 녹음 중 finals가 존재하면 transcript-view-card가 보인다`
  - `WebSpeech 모드에서도 동일 규칙이 적용된다`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder.tsx`
- `useTranscription` mock을 케이스별로 override하여 `partial` 또는 `finals` 설정
- `showTranscript` 파생값이 `recordingActive && (finals.length > 0 || partial.length > 0)` 일 때 true

**REFACTOR** — 코드 개선

- 실시간 / 배치 `hasTranscript` 판정을 명확한 이름의 변수로 분리

### Step 4: 첫 스크립트 존재 시 TranscriptView 표시 — 배치 모드

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-phased-ui.test.tsx`
- 테스트 케이스 목록:
  - `배치 녹음 중 transcript가 빈 문자열이면 transcript-view-card가 숨겨진다`
  - `배치 녹음 중 transcript가 존재하면 transcript-view-card가 보인다`
  - `배치 모드에서 pipeline.displayTranscript가 존재하면 transcript-view-card가 보인다`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder.tsx`
- 배치 모드 `hasTranscript` 판정: `Boolean(batchTranscriptText)`
- `useBatchTranscription` mock에서 `transcript` 필드를 설정하는 테스트 변형

**REFACTOR** — 코드 개선

- `batchTranscriptText` 계산 로직과 `hasTranscript` 판정이 같은 블록 근처에 위치하도록 재배치

### Step 5: CSS 전환 애니메이션 및 prefers-reduced-motion

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-phased-ui.test.tsx`
- 테스트 케이스 목록:
  - `숨겨진 SessionContextInput 래퍼에 transition 관련 CSS 클래스가 존재한다`
  - `보이는 SessionContextInput 래퍼에 opacity-100 클래스가 존재한다`
  - `숨겨진 래퍼에 aria-hidden="true"가 설정된다`
  - `보이는 래퍼에 aria-hidden이 없거나 "false"이다`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder.tsx`
- `RevealSection` 인라인 컴포넌트 구현:
  - props: `visible: boolean`, `children`, `testId?: string`
  - visible일 때: `opacity-100 blur-0 translate-y-0`
  - hidden일 때: `opacity-0 blur-sm translate-y-2 pointer-events-none h-0 overflow-hidden`
  - 공통: `motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none`

**REFACTOR** — 코드 개선

- 클래스 문자열을 `cn()` 유틸 또는 template literal로 정리
- 불필요한 중복 클래스 제거

### Step 6: 기존 Recorder 테스트 갱신

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-ui.test.tsx`
- 테스트 케이스 목록:
  - 기존 테스트 중 `transcript-partial`을 직접 `getByTestId`로 찾는 케이스가 이제 idle 상태에서 숨겨진 래퍼 안에 있으므로 실패할 수 있음

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/__tests__/recorder-ui.test.tsx`
- 기존 `TranscriptView 영역이 탭 없이 표시된다` 테스트 수정: idle 상태에서는 `transcript-partial`이 aria-hidden 래퍼 안에 있으므로 DOM 존재 여부로 검증하거나, 가시성 조건을 녹음 중 상태로 변경
- 기타 기존 테스트에서 녹음 중 mock을 설정해야 하는 케이스 점검

**REFACTOR** — 코드 개선

- 기존 테스트 파일의 mock 패턴을 새 phased-ui 테스트와 일관되게 통일

## 파일 변경 계획

| 파일                                                   | 변경 유형 | 설명                                                                                                                                         |
| ------------------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/recorder.tsx`                          | 수정      | `showSessionContext`, `showTranscript` 파생 변수 추가, `RevealSection` 인라인 컴포넌트, 래퍼로 `SessionContextInput`·`TranscriptView` 감싸기 |
| `src/components/__tests__/recorder-phased-ui.test.tsx` | 신규      | 단계별 가시성 규칙 + 애니메이션 클래스 + aria 속성 테스트                                                                                    |
| `src/components/__tests__/recorder-ui.test.tsx`        | 수정      | idle 상태에서 숨겨진 블록으로 인한 기존 테스트 보정                                                                                          |

추가 파일 없음. `RevealSection`은 `recorder.tsx` 내부에 선언하여 별도 파일을 만들지 않는다. Recorder 외부에서 재사용 필요성이 생길 때 분리한다.

## 완료 조건

1. **가시성 규칙 충족**: idle → RecordingCard만, recording → + SessionContextInput, 첫 스크립트 → + TranscriptView
2. **배치·실시간(Web Speech 포함) 경로 일관성**: 세 가지 모드 모두에서 동일 규칙 동작
3. **애니메이션 동작**: 등장 시 blur→clear + translateY + opacity 전환이 시각적으로 확인됨
4. **접근성**: `prefers-reduced-motion: reduce`에서 전환 즉시 적용, `aria-hidden` 올바르게 토글
5. **기존 테스트 통과**: `npm run test` 전체 통과, 기존 recorder 관련 테스트 회귀 없음
6. **신규 테스트 커버**: `recorder-phased-ui.test.tsx`에서 idle/recording/transcript 세 단계 × 배치/실시간 경로 커버

## 테스트 전략

### 테스트 환경

- `@vitest-environment happy-dom` 지시자 사용
- `@testing-library/react`의 `render`, `screen` 활용
- `vi.mock`으로 `use-recorder`, `use-batch-transcription`, `use-transcription` 훅 제어

### 가시성 검증 방법

숨겨진 블록은 DOM에 존재하되 `aria-hidden="true"` + 시각적 숨김 CSS가 적용된 상태이므로:

- **숨김 검증**: `expect(wrapper).toHaveAttribute("aria-hidden", "true")`
- **노출 검증**: `expect(wrapper).not.toHaveAttribute("aria-hidden", "true")` 또는 `wrapper.getAttribute("aria-hidden") !== "true"`
- `data-testid="reveal-session-context"` / `data-testid="reveal-transcript"` 래퍼에 테스트 ID 부여

### Mock Override 패턴

```typescript
function mockRecording(mode: "batch" | "streaming") {
  if (mode === "batch") {
    vi.mocked(useBatchTranscription).mockReturnValue({
      ...defaultBatchReturn,
      status: "recording",
    });
  } else {
    vi.mocked(useRecorder).mockReturnValue({
      ...defaultRecorderReturn,
      status: "recording",
    });
  }
}
```

### 테스트 매트릭스

| 시나리오                                    | 배치 | 실시간 | WebSpeech |
| ------------------------------------------- | ---- | ------ | --------- |
| idle → context 숨김                         | O    | O      | —         |
| recording → context 노출                    | O    | O      | O         |
| recording + 스크립트 없음 → transcript 숨김 | O    | O      | —         |
| recording + 스크립트 있음 → transcript 노출 | O    | O      | O         |
| aria-hidden 토글                            | O    | O      | —         |
| transition 클래스 존재                      | O    | —      | —         |

### 수동 검증 (개발 중)

- 브라우저에서 `prefers-reduced-motion` 토글하여 애니메이션 차이 확인
- 녹음 시작 → SessionContextInput 등장 전환 확인
- 첫 스크립트 수신 → TranscriptView 등장 전환 확인
- DevTools > Accessibility Tree에서 숨겨진 블록이 접근성 트리에서 제외되는지 확인
