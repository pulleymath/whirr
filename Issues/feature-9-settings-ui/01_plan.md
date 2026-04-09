---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  subagent_model: "composer"
  feature: "feature-9-settings-ui"
---

# Feature 9: 설정(Settings) 인프라 및 UI — 개발 계획서

## 개발 범위

- **포함**: 전사 관련 설정 타입·기본값, `localStorage` 영속화 + SSR 안전한 `SettingsProvider` / `useSettings`, 헤더 우측 설정(기어) 버튼, 설정 패널 UI(모드별 조건부 필드, 녹음 중 비활성화, 짧은 설명), `Recorder`에서 `useSettings`와 `useTranscription` 옵션 연동(`realtime`만 실제 스트리밍, `batch` / `webSpeechApi`는 사용자 메시지 스텁), 단위·컴포넌트 테스트, 이슈에 명시된 문서 갱신.
- **제외**: Feature 10의 일괄 전사 실제 파이프라인, Feature 11의 Web Speech API 실제 구현, AssemblyAI용 별도 토큰 API가 없다면 **엔진 선택 UI는 두되** `assemblyai` 선택 시 토큰/연결 실패는 사용자용 에러로 노출되는 수준까지(필요 시 이슈/후속 작업으로 토큰 라우트 확장 명시).

## 기술적 접근 방식

- **타입**: `src/lib/settings/types.ts`에 이슈 스펙의 `TranscriptionMode`, `RealtimeEngine`, `TranscriptionSettings` 및 기본값 상수(또는 `DEFAULT_TRANSCRIPTION_SETTINGS`)를 둔다. 저장/로드용으로 `unknown` → 검증·정규화하는 `parseTranscriptionSettings(raw: unknown): TranscriptionSettings` 같은 순수 함수를 같은 모듈 또는 `src/lib/settings/parse.ts`에 두면 TDD와 SSR 무관 테스트가 쉬움.
- **Context**: `src/lib/settings/context.tsx` — `"use client"`, `SettingsProvider`, `useSettings()`. 초기 상태는 **기본값**으로 두고, 마운트 후 `useEffect`에서 `localStorage` 읽기(키는 예: `whirr:transcription-settings`). 변경 시 `setState` + `localStorage.setItem`. 파싱 실패·알 수 없는 필드는 기본값으로 병합.
- **Provider 배치**: 루트 `src/app/layout.tsx`는 RSC이므로, `(main)` 트리를 감싸는 **클라이언트 래퍼** 한 겹을 두는 방식이 안전함. 예: `src/components/settings-provider-shell.tsx`(이름 가칭)에서 `SettingsProvider`로 `children` 감싼 뒤 `src/app/(main)/layout.tsx`에서 import. 이렇게 하면 `MainShell` / `HomePageShell` / 향후 동일 레이아웃 페이지가 동일 설정을 공유.
- **헤더**: `src/components/main-shell.tsx` — 기존 `absolute left-4` History 버튼과 대칭으로 `absolute right-4 top-1/2 -translate-y-1/2`, `aria-label="설정"`, 모바일/데스크톱 공통 노출(이슈 스펙). 설정 패널 열림 상태는 `MainShell` 로컬 state 또는 `HomePageShell`에서 끌어올리기; **헤더와 패널이 한 트리**에 있으면 `MainShell` 내부 state + `SettingsPanel` 렌더가 단순.
- **설정 패널**: `src/components/settings-panel.tsx` — 접근성: 제목(`Settings` 또는 `설정`), `role="dialog"` + `aria-modal` 패턴 또는 기존 프로젝트 drawer 스타일과 일치하는 오버레이. 필드: 모드(`realtime` | `batch` | `webSpeechApi`), `realtime`일 때 엔진(`openai` | `assemblyai`), `batch`일 때 `batchModel` 입력/선택, 공통 `language`. 녹음 중(`recording`)에는 컨트롤 `disabled` + `aria-disabled` 및 시각적 힌트.
- **Recorder 연동**: `src/components/recorder.tsx`에서 `useSettings()`로 `mode`, `realtimeEngine` 등 읽기. `mode === 'realtime'`일 때만 기존 플로우: `useTranscription({ createProvider, useAssemblyAiPcmFraming })`를 `useMemo`/`useCallback` 의존성에 맞게 구성 — `realtimeEngine === 'openai'` → `createOpenAiRealtimeProvider`, `false`; `assemblyai` → `createAssemblyAiRealtimeProvider`, `useAssemblyAiPcmFraming: true`(기존 `use-transcription.ts` 주석과 일치). `mode === 'batch'` | `webSpeechApi'`일 때는 `prepareStreaming` 호출 시 토스트/인라인 메시지로 “아직 지원하지 않습니다” 등 이슈 문구에 맞게 스텁 후 `return false` 또는 녹음 시작 버튼 비활성화 중 하나로 일관되게 선택.
- **문서**: `docs/DECISIONS.md`에 설정 키·기본값·후속 Feature 10/11과의 경계, `docs/ARCHITECTURE.md`에 Provider 위치와 데이터 흐름(설정 → Recorder → `useTranscription`).

## TDD 구현 순서

### Step 1: 설정 타입·파서·기본값

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/settings/__tests__/types.test.ts`(또는 `parse.test.ts`)
- 테스트 케이스 목록
  - `parseTranscriptionSettings(undefined)` → 전 필드 기본값
  - 부분 객체 `{ mode: 'batch' }` → 나머지는 기본값 유지
  - 잘못된 `mode` 문자열 → 기본값 `realtime`으로 정규화
  - 잘못된 `realtimeEngine` → 기본값 `openai`
  - `JSON.parse` 실패 시나리오는 파서 호출부에서 빈 객체로 처리하는 함수가 있으면 그 경로 테스트

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/settings/types.ts`, 필요 시 `src/lib/settings/parse.ts`
- 핵심 구현 내용: 타입 export, 기본값 상수, 안전한 필드별 좁히기(narrowing) 또는 허용 리스트 검사

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: 검증 로직을 작은 순수 함수로 분리해 이후 Context에서 재사용

### Step 2: Settings Context + localStorage

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/settings/__tests__/context.test.tsx`
- 테스트 케이스 목록
  - `SettingsProvider` 없이 `useSettings()` 호출 시 에러(또는 프로젝트 컨벤션에 맞는 동작) 명시
  - `render` 후 `useSettings`로 기본값과 동일한 상태
  - `localStorage`에 유효 JSON이 있으면 병합된 값 표시(`vi.stubGlobal` 또는 `Storage` mock)
  - `updateSettings` 호출 후 화면(또는 hook result) 반영 및 `localStorage`에 직렬화됨
  - 손상된 JSON은 기본값으로 폴백

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/settings/context.tsx`
- 핵심 구현 내용: `useState` + `useEffect`에서만 읽기/쓰기, 업데이트 시 파서 통과

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: storage 키 상수화, `useCallback`으로 안정적인 `updateSettings`, 중복 파싱 제거

### Step 3: SettingsPanel UI

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/settings-panel.test.tsx`
- 테스트 케이스 목록
  - 열림(`open=true`)일 때 모드 선택 및 `realtime`일 때 엔진 필드 표시
  - `batch`일 때 `batchModel` 필드 표시, `webSpeechApi`일 때 실시간 엔진 필드 미표시
  - `isRecording=true`일 때 폼 컨트롤 비활성화
  - 변경 시 `onChange` 또는 Context 업데이트(테스트에서는 mock `updateSettings` 주입 가능)

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/settings-panel.tsx`
- 핵심 구현 내용: `useSettings` 또는 제어 컴포넌트 props, 조건부 필드, 짧은 설명 문구

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: 라벨/설명 문자열 정리, 접근성 속성 보강, Tailwind를 `main-shell`과 톤 맞춤

### Step 4: MainShell 설정 버튼 + 패널 연동

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/main-shell-settings.test.tsx`(신규) 또는 기존 `main-shell-session.test.tsx` 확장
- 테스트 케이스 목록
  - `aria-label="설정"` 버튼 존재 및 우측 배치 클래스(스냅샷 또는 `className` 포함 여부)
  - 설정 클릭 시 패널(또는 dialog) 표시
  - 닫기 동작(오버레이 클릭/닫기 버튼) 시 패널 숨김

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/main-shell.tsx`, 필요 시 `settings-panel.tsx`에 `open`/`onClose` props 보강
- 핵심 구현 내용: `settingsOpen` state, 기어 SVG, `SettingsPanel`에 `SettingsProvider`는 상위 레이아웃에서 이미 제공된다고 가정하고 테스트에서는 `SettingsProvider`로 wrap

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: History 버튼과 설정 버튼 스타일 공통 유틸 또는 클래스 문자열 정리

### Step 5: Recorder + 설정 + useTranscription 분기

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-settings.test.tsx`(신규) 및 필요 시 `recorder-stt-integration.test.tsx` 보강
- 테스트 케이스 목록
  - `SettingsProvider`에서 `mode: 'realtime'`, `realtimeEngine: 'openai'`일 때 기존과 같이 `prepareStreaming` → 녹음 시작 흐름(mock 유지)
  - `realtimeEngine: 'assemblyai'`일 때 `useTranscription`에 `useAssemblyAiPcmFraming: true`와 `createAssemblyAiRealtimeProvider`가 전달되는지(mock `useTranscription`으로 옵션 캡처)
  - `mode: 'batch'`(또는 `webSpeechApi`)일 때 녹음 시작 시 스텁 메시지 표시 및 `prepareStreaming` 미호출 또는 호출되지 않음

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder.tsx`
- 핵심 구현 내용: `useSettings`, `useMemo`로 `useTranscription` 옵션 구성, 비-realtime 모드 스텁

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: 분기 로직을 작은 헬퍼(예: `buildTranscriptionHookOptions(settings)`)로 이동해 테스트 용이성 향상

### Step 6: 앱 레이아웃에 Provider 연결

**RED** — 실패하는 테스트 작성

- 테스트 파일: 선택 — `src/components/__tests__/home-page-shell.test.tsx`(신규)에서 `SettingsProvider`가 없을 때를 재현하지 않고, Provider 래퍼 컴포넌트만 RTL로 스모크 렌더하거나 Step 4/5에서 이미 커버.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/app/(main)/layout.tsx` + 클라이언트 래퍼(예: `src/components/providers/main-settings-provider.tsx`)
- 핵심 구현 내용: `(main)`의 `children`을 `SettingsProvider`로 감쌈

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: 향후 다른 전역 Provider가 생기면 단일 `AppProviders`로 합침

## 파일 변경 계획

| 경로                                                    | 변경                                           |
| ------------------------------------------------------- | ---------------------------------------------- |
| `src/lib/settings/types.ts`                             | 신규                                           |
| `src/lib/settings/parse.ts`                             | 선택 신규(파서 분리 시)                        |
| `src/lib/settings/context.tsx`                          | 신규                                           |
| `src/lib/settings/__tests__/types.test.ts`              | 신규                                           |
| `src/lib/settings/__tests__/context.test.tsx`           | 신규                                           |
| `src/components/settings-panel.tsx`                     | 신규                                           |
| `src/components/__tests__/settings-panel.test.tsx`      | 신규                                           |
| `src/components/main-shell.tsx`                         | 설정 버튼·패널 state·`SettingsPanel` 연동      |
| `src/components/__tests__/main-shell-settings.test.tsx` | 신규 또는 기존 확장                            |
| `src/components/recorder.tsx`                           | `useSettings` + `useTranscription` 옵션 + 스텁 |
| `src/components/__tests__/recorder-settings.test.tsx`   | 신규                                           |
| `src/app/(main)/layout.tsx`                             | `SettingsProvider` 래핑                        |
| `src/components/providers/...`                          | 선택: 클라이언트 Provider 래퍼                 |
| `docs/DECISIONS.md`                                     | 설정·storage·범위 기록                         |
| `docs/ARCHITECTURE.md`                                  | Provider·데이터 흐름                           |

## 완료 조건

- 헤더에 설정 버튼이 스펙 위치·`aria-label`을 만족하고, 패널에서 모드·(조건부) 엔진·배치 모델·언어를 바꿀 수 있다.
- 새로고침 후에도 `localStorage`에서 설정이 복구되고, 잘못된 저장값은 기본값으로 안전하게 복귀한다.
- SSR/하이드레이션 시 `localStorage` 접근으로 인한 예외가 없다.
- 녹음 중에는 설정 변경 UI가 비활성화된다.
- `mode === 'realtime'`일 때 기존 OpenAI 실시간 전사 동작이 기본 설정에서 변하지 않는다(회귀).
- `batch` / `webSpeechApi`는 실제 전사 없이 이슈에서 정한 대로 사용자에게 안내한다.
- 명시된 테스트 파일들이 통과하고, 문서 두 파일이 현재 아키텍처와 일치한다.

## 테스트 전략

- **러너/환경**: 기존과 동일하게 Vitest + `@vitest-environment happy-dom`, `@testing-library/react` (`render`, `screen`, `fireEvent`, `waitFor`, 필요 시 `renderHook` + `act`).
- **모킹**: `next/navigation`의 `usePathname`은 `MainShell` 테스트에서 기존 패턴 유지. `useTranscription`은 Recorder 테스트에서 옵션 검증 시 `vi.mock`으로 래핑 훅이 받은 인자 저장.
- **localStorage**: `beforeEach`에서 `localStorage.clear()`, 특정 케이스에서 `setItem`으로 시드.
- **회귀**: `recorder-stt-integration.test.tsx`, `recorder-session-storage.test.tsx`는 Provider 래핑만 추가되면 통과해야 함 — 깨지면 `HomePageShell` 또는 테스트 `wrapper`에 `SettingsProvider` 추가.
