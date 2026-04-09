# Feature 9: 설정(Settings) 인프라 및 UI

## 1. 개요

헤더 오른쪽에 **설정 버튼**을 추가하고, 전사 모드·모델 등을 선택할 수 있는 **설정 패널**을 구현한다. Feature 10(녹음 후 일괄 전사), Feature 11(Web Speech API)이 이 설정 인프라 위에서 동작하므로, 본 이슈가 **선행 작업**이다.

### 배경

- 현재 전사 방식은 OpenAI Realtime API 하나로 고정되어 있다.
- 실시간 전사 인식률 문제로 **녹음 후 일괄 전사** 모드 추가가 필요하고, 브라우저 내장 **Web Speech API**도 지원 대상이다.
- 사용자가 전사 모드·모델을 직접 선택할 수 있는 UI가 아직 없다.
- 헤더(`main-shell.tsx`)의 오른쪽 영역이 비어 있어 설정 버튼 배치에 적합하다.

### 선행 작업

- Feature 7 (메인 UI 셸) — 헤더·레이아웃 구조가 구현되어 있어야 한다. ✅ 완료

### 후속 작업 (본 이슈에서는 구현하지 않음)

- Feature 10: 녹음 후 일괄 전사 — `batch` 모드 실제 전사 로직
- Feature 11: Web Speech API — `webSpeechApi` 모드 실제 전사 로직

## 2. 상세 기획 (Detailed Plan)

### 2.1 설정 타입 정의

**파일**: `src/lib/settings/types.ts`

전사 관련 설정의 타입을 정의한다.

```ts
/** 전사 모드 */
type TranscriptionMode = "realtime" | "batch" | "webSpeechApi";

/** 실시간 전사에서 사용할 엔진 */
type RealtimeEngine = "openai" | "assemblyai";

type TranscriptionSettings = {
  /** 전사 모드: 실시간 / 녹음 후 일괄 / Web Speech API */
  mode: TranscriptionMode;
  /** 실시간 전사 시 사용할 엔진 (mode='realtime'일 때만 적용) */
  realtimeEngine: RealtimeEngine;
  /** 녹음 후 일괄 전사 시 사용할 모델 (mode='batch'일 때만 적용) */
  batchModel: string;
  /** 전사 언어 코드 (ISO 639-1) */
  language: string;
};
```

- `mode`의 기본값: `'realtime'` (기존 동작 유지)
- `realtimeEngine`의 기본값: `'openai'`
- `batchModel`의 기본값: `'whisper-1'`
- `language`의 기본값: `'ko'`

### 2.2 설정 Context 및 영속화

**파일**: `src/lib/settings/context.tsx`

React Context를 사용해 앱 전역에서 설정에 접근할 수 있도록 한다.

- `SettingsProvider`: 앱 루트(`layout.tsx` 또는 메인 레이아웃)에 배치할 Context Provider.
- `useSettings()`: 현재 설정 값과 업데이트 함수를 반환하는 커스텀 훅.
- **영속화**: `localStorage`에 JSON으로 저장. 초기 로드 시 localStorage에서 읽고, 값이 없거나 파싱 실패 시 기본값을 사용한다.
- **SSR 안전**: `typeof window === 'undefined'` 또는 `useEffect` 내에서만 localStorage에 접근하여 서버 렌더링 시 에러를 방지한다.

```ts
// 사용 예시
const { settings, updateSettings } = useSettings();
updateSettings({ mode: "batch" });
```

### 2.3 헤더에 설정 버튼 추가

**파일**: `src/components/main-shell.tsx`

현재 헤더 구조:

- 왼쪽: 햄버거 버튼 (모바일, `md:hidden`)
- 가운데: "Whirr" 타이틀
- **오른쪽: 비어 있음** → 여기에 설정 버튼 추가

기어(⚙) 아이콘 버튼을 `absolute right-4 top-1/2 -translate-y-1/2`로 배치한다 (왼쪽 햄버거 버튼과 대칭). 클릭 시 설정 패널을 열고 닫는다.

- 버튼은 데스크톱·모바일 모두에서 항상 표시된다.
- `aria-label="설정"` 접근성 속성을 포함한다.
- 아이콘: SVG 기어 아이콘 (인라인 또는 아이콘 컴포넌트).

### 2.4 설정 패널 컴포넌트

**파일**: `src/components/settings-panel.tsx`

설정 버튼 클릭 시 표시되는 패널. **Popover** 또는 **Drawer** 형태로 구현한다.

#### 패널 내 설정 항목

1. **전사 모드** (라디오 그룹 또는 Select)
   - `실시간 전사` — 녹음하면서 실시간으로 텍스트 표시 (기존 방식)
   - `녹음 후 전사` — 녹음 종료 후 한꺼번에 전사 (Feature 10에서 구현)
   - `Web Speech API` — 브라우저 내장 음성 인식 사용 (Feature 11에서 구현)

2. **실시간 전사 엔진** (mode='realtime'일 때만 표시)
   - `OpenAI Realtime` (기본)
   - `AssemblyAI` (레거시)

3. **일괄 전사 모델** (mode='batch'일 때만 표시)
   - `whisper-1` (기본)
   - `gpt-4o-transcribe`

4. **언어**
   - `한국어 (ko)` (기본)
   - `English (en)`
   - `자동 감지 (auto)` — batch 모드에서만 지원

#### UI/UX 원칙

- 아직 구현되지 않은 모드(Feature 10, 11 완료 전)는 **선택은 가능하되**, 해당 모드로 녹음 시작 시 `Recorder`에서 "아직 지원되지 않는 모드입니다" 안내를 표시한다. 이는 Feature 10, 11이 완료되면 자동으로 해제된다.
- 설정 변경은 **즉시 반영**(녹음 중이 아닌 상태에서만). 녹음 중에는 설정 버튼을 비활성화하거나, 패널 내 항목을 `disabled` 처리한다.
- 각 설정 항목에 짧은 설명 텍스트를 표시해 사용자가 차이를 이해할 수 있게 한다.

### 2.5 Recorder 컴포넌트와 설정 연동

**파일**: `src/components/recorder.tsx`

`useSettings()` 훅으로 현재 설정을 읽어, 녹음 시작 시 적절한 전사 경로를 선택한다.

- `mode === 'realtime'`: 기존 `prepareStreaming → startRecording(sendPcm) → finalizeStreaming` 흐름 유지.
- `mode === 'batch'`: Feature 10에서 구현할 배치 전사 흐름 호출 (본 이슈에서는 스텁/미지원 안내).
- `mode === 'webSpeechApi'`: Feature 11에서 구현할 Web Speech API 흐름 호출 (본 이슈에서는 스텁/미지원 안내).

`useTranscription` 훅에 `settings.realtimeEngine`에 따라 적절한 `createProvider`를 전달한다.

### 2.6 테스트

- `src/lib/settings/__tests__/context.test.tsx`: SettingsProvider + useSettings 훅 테스트
  - 기본값 정상 로드
  - updateSettings 호출 시 Context 값 갱신
  - localStorage 영속화/복원
- `src/components/__tests__/settings-panel.test.tsx`: 설정 패널 렌더링 및 인터랙션 테스트
  - 모드 변경 시 조건부 항목 표시/숨김
  - 설정 변경 시 useSettings.updateSettings 호출

### 2.7 문서 업데이트

- `docs/DECISIONS.md`: 설정 상태 관리 방식 (React Context + localStorage) 결정 기록
- `docs/ARCHITECTURE.md`: 설정 계층 추가 (구성 요소 책임 테이블)
- `Issues/STATUS.md`: Feature 9 항목 추가

## 3. 완료 조건 (Done Criteria)

- [x] `TranscriptionSettings` 타입이 정의되어 있고, `mode`, `realtimeEngine`, `batchModel`, `language` 필드를 갖는다.
- [x] `SettingsProvider`가 앱 레이아웃에 배치되어 있고, `useSettings()` 훅으로 어느 컴포넌트에서든 설정을 읽고 쓸 수 있다.
- [x] 설정이 `localStorage`에 영속화되어, 새로고침 후에도 마지막 선택이 유지된다.
- [x] 헤더 오른쪽에 설정 버튼(기어 아이콘)이 표시되고, 클릭 시 설정 패널이 열린다.
- [x] 설정 패널에서 전사 모드(실시간/배치/Web Speech API)를 선택할 수 있다.
- [x] 선택한 모드에 따라 조건부 설정 항목(엔진, 모델)이 올바르게 표시/숨김된다.
- [x] 녹음 중에는 설정 변경이 불가하다 (비활성화 처리).
- [x] `Recorder`가 `useSettings()`에서 읽은 `mode`에 따라 전사 경로를 분기한다 (미구현 모드는 안내 메시지).
- [x] 설정 Context 단위 테스트, 설정 패널 컴포넌트 테스트가 통과한다.
- [x] 기존 실시간 전사(OpenAI Realtime) 흐름이 정상 동작한다 (회귀 없음).
