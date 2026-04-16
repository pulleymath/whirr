---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "glossary-and-toast"
---

# 용어 사전 / 세션 컨텍스트 + 완료 토스트 — 개발 계획서

## 개발 범위

전역 용어 사전과 세션별 컨텍스트를 회의록 LLM 프롬프트에 주입하여 STT 오인식을 교정하고, 회의록 생성 완료 시 sonner 토스트로 알림 및 세션 이동을 지원한다.

### 핵심 기능

1. **타입 정의** — `GlossaryEntry`, `GlobalGlossary`, `SessionContext`, `MeetingContext` 타입 신규 생성
2. **전역 용어 사전 Context** — localStorage 기반 `GlossaryProvider` + `useGlossary` 훅 (기존 `SettingsProvider` 패턴 준수)
3. **프롬프트 빌더** — `buildSystemPromptWithContext()` 함수로 SINGLE/MAP 시스템 프롬프트에 용어·참석자·주제·키워드 섹션 주입 (REDUCE에는 미적용)
4. **map-reduce 확장** — `generateMeetingMinutes`에 `context?: MeetingContext | null` 파라미터 추가
5. **API Route 검증** — `glossary` (string[], 최대 200개), `sessionContext` (각 필드 최대 ~2000자) 파싱/검증/전달
6. **파이프라인 입력 확장** — `PostRecordingPipelineEnqueueInput`에 glossary/sessionContext 추가, fetch body 포함, `completedSessionId` 노출
7. **fetch-meeting-minutes-client 일관성** — 요청 body에 context 필드 추가
8. **Session DB 타입** — `Session`에 `context?: MeetingContext` optional 필드 추가
9. **SessionContextInput 컴포넌트** — 참석자/주제/키워드 입력 UI (접이식, disabled 지원)
10. **설정 패널 용어 사전** — `settings-panel.tsx`에 전역 용어 사전 textarea 섹션 추가
11. **sonner 토스트** — 패키지 설치, `layout.tsx`에 `<Toaster />` 마운트
12. **PipelineToastNotifier** — phase=done 전환 시 토스트 + 세션 네비게이션
13. **Provider 배선** — `main-app-providers.tsx`에 `GlossaryProvider` + `PipelineToastNotifier` 연결

### 범위 밖 (명시적 제외)

- STT prompt 변경 없음 (회의록 LLM 프롬프트만 수정)
- GlossaryEntry alias 매핑 (후속 확장)
- DB 버전 업그레이드 (IndexedDB optional 필드 추가로 불필요)

## 기술적 접근 방식

### 데이터 흐름

```
GlossaryProvider(localStorage) ──┐
SessionContextInput(state) ──────┤
                                 ▼
recorder.tsx → enqueue({ glossary, sessionContext })
                                 ▼
PostRecordingPipelineProvider → POST /api/meeting-minutes { text, model, glossary, sessionContext }
                                 ▼
API route → validateGlossary/validateSessionContext → generateMeetingMinutes(text, { model, completeChat, context })
                                 ▼
buildSystemPromptWithContext(SINGLE/MAP_SYSTEM, context) → LLM 호출
                                 ▼
Pipeline phase=done + completedSessionId → PipelineToastNotifier → toast.success → /sessions/[id]
```

### 패턴 준수

- **Context 패턴**: `src/lib/settings/context.tsx`와 동일한 localStorage+Context 패턴으로 `GlossaryProvider` 구현
- **테스트 패턴**: 기존 `__tests__/` 디렉터리 구조와 Vitest + happy-dom 환경 지시자 패턴 유지
- **API 검증**: 기존 route.ts의 단계적 파싱/검증 패턴 (body 파싱 → 필드 추출 → 타입 검증 → 범위 검증) 확장
- **파이프라인 확장**: 기존 `PostRecordingPipelineEnqueueInput` 타입에 optional 필드 추가로 하위 호환성 유지

### 의존성

- `sonner` 패키지 신규 설치 (토스트 알림)
- Next.js `useRouter` (PipelineToastNotifier에서 세션 페이지 네비게이션)

## TDD 구현 순서

### Step 1: 타입 정의

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/glossary/__tests__/types.test.ts`
- 테스트 케이스:
  - `GlossaryEntry는 string 타입이다`
  - `GlobalGlossary는 terms 배열을 가진다`
  - `SessionContext는 participants, topic, keywords 필드를 가진다`
  - `MeetingContext는 glossary 배열과 sessionContext를 가진다`
  - `MeetingContext.sessionContext는 null을 허용한다`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/glossary/types.ts`
- `GlossaryEntry = string`, `GlobalGlossary = { terms: GlossaryEntry[] }`, `SessionContext = { participants: string; topic: string; keywords: string }`, `MeetingContext = { glossary: GlossaryEntry[]; sessionContext: SessionContext | null }` 타입 export

**REFACTOR** — 코드 개선

- 타입 파일은 순수 선언이므로 별도 리팩토링 불필요

---

### Step 2: 프롬프트 빌더

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/meeting-minutes/__tests__/prompts.test.ts`
- 테스트 케이스:
  - `context가 null이면 basePrompt를 그대로 반환한다`
  - `glossary가 비어 있고 sessionContext가 null이면 basePrompt를 그대로 반환한다`
  - `glossary 항목이 있으면 "용어 교정 가이드" 섹션을 추가한다`
  - `sessionContext.participants가 있으면 "회의 참석자" 섹션을 추가한다`
  - `sessionContext.topic이 있으면 "회의 주제" 섹션을 추가한다`
  - `sessionContext.keywords가 있으면 "이번 회의 키워드" 섹션을 추가한다`
  - `공백만 있는 sessionContext 필드는 무시한다`
  - `glossary + sessionContext 모두 있으면 모든 섹션이 포함된다`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/meeting-minutes/prompts.ts`
- `buildSystemPromptWithContext(basePrompt: string, context: MeetingContext | null): string` 함수 추가
- 기존 상수 3개(`MEETING_MINUTES_SINGLE_SYSTEM`, `MEETING_MINUTES_MAP_SYSTEM`, `MEETING_MINUTES_REDUCE_SYSTEM`)는 변경하지 않음

**REFACTOR** — 코드 개선

- MeetingContext import를 `../glossary/types`에서 가져오도록 정리

---

### Step 3: map-reduce에 context 파라미터 추가

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/meeting-minutes/__tests__/map-reduce.test.ts`
- 테스트 케이스 (기존 테스트에 추가):
  - `context가 주어지면 단일 청크 시스템 메시지에 용어 교정 가이드가 포함된다`
  - `context가 주어지면 map 단계 시스템 메시지에 용어 교정 가이드가 포함된다`
  - `context가 주어져도 reduce 단계 시스템 메시지에는 컨텍스트가 포함되지 않는다`
  - `context가 없으면(undefined) 기존 동작과 동일하다`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/meeting-minutes/map-reduce.ts`
- `generateMeetingMinutes` 시그니처에 `context?: MeetingContext | null` 추가
- 단일 청크: `buildSystemPromptWithContext(MEETING_MINUTES_SINGLE_SYSTEM, context ?? null)` 사용
- map 단계: `buildSystemPromptWithContext(MEETING_MINUTES_MAP_SYSTEM, context ?? null)` 사용
- reduce 단계: `MEETING_MINUTES_REDUCE_SYSTEM` 그대로 유지

**REFACTOR** — 코드 개선

- 기존 4개 테스트가 깨지지 않는지 확인 (context 미전달 시 기존 동작 유지)

---

### Step 4: API Route에 glossary/sessionContext 검증 및 전달

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/app/api/meeting-minutes/__tests__/route.test.ts`
- 테스트 케이스 (기존 테스트에 추가):
  - `glossary가 배열이 아니면 400 반환`
  - `glossary 항목이 200개를 초과하면 400 반환`
  - `glossary 항목 중 string이 아닌 것이 있으면 400 반환`
  - `sessionContext.participants가 2000자를 초과하면 400 반환`
  - `sessionContext.topic이 2000자를 초과하면 400 반환`
  - `sessionContext.keywords가 2000자를 초과하면 400 반환`
  - `유효한 glossary와 sessionContext가 generateMeetingMinutes에 context로 전달된다`
  - `glossary/sessionContext가 없으면 기존 동작과 동일하다 (context 없이 호출)`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/app/api/meeting-minutes/route.ts`
- body에서 `glossary?`, `sessionContext?` 파싱
- 검증 로직: `glossary`는 `string[]` && `.length <= 200`, `sessionContext` 각 필드는 `string` && `.length <= 2000`
- `generateMeetingMinutes` 호출 시 `context: { glossary, sessionContext }` 전달
- 검증 상수는 `src/lib/api/meeting-minutes-api-constants.ts`에 추가

**REFACTOR** — 코드 개선

- 검증 로직을 헬퍼 함수 `validateGlossary`, `validateSessionContext`로 분리 검토

---

### Step 5: 전역 용어 사전 Context (localStorage + Provider)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/glossary/__tests__/context.test.tsx`
- 테스트 케이스 (기존 `settings/context.test.tsx` 패턴 준수):
  - `Provider 없이 useGlossary 호출하면 에러`
  - `마운트 후 기본값은 빈 terms 배열`
  - `localStorage에 유효 JSON이면 저장된 terms 표시`
  - `updateGlossary 호출 후 terms 반영 및 localStorage 직렬화`
  - `손상된 JSON은 기본값으로 폴백`
  - `빈 문자열은 기본값으로 폴백`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/glossary/context.tsx`
- 스토리지 키: `whirr:global-glossary`
- `GlossaryProvider`: localStorage 읽기 (마운트 후) → React 상태 동기화
- `useGlossary()`: `{ glossary: GlobalGlossary, updateGlossary: (terms: string[]) => void }`
- 기존 `SettingsProvider` 패턴과 동일한 SSR-safe 구조

**REFACTOR** — 코드 개선

- `GLOSSARY_STORAGE_KEY` 상수 export하여 테스트에서 참조 가능하게 정리

---

### Step 6: 파이프라인 입력 확장 + completedSessionId 노출

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/post-recording-pipeline/__tests__/meeting-minutes-fetch.test.tsx`
- 테스트 케이스 (기존 테스트에 추가):
  - `enqueue에 glossary와 sessionContext를 전달하면 fetch body에 포함된다`
  - `phase가 done이 되면 completedSessionId가 설정된다`
  - `phase가 idle로 리셋되면 completedSessionId가 null이 된다`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/post-recording-pipeline/context.tsx`
- `PostRecordingPipelineEnqueueInput`에 `glossary?: string[]`, `sessionContext?: SessionContext | null` 추가
- fetch body에 `glossary`, `sessionContext` 포함
- `PostRecordingPipelineContextValue`에 `completedSessionId: string | null` 추가
- `setPhase("done")` 시점에 `setCompletedSessionId(input.sessionId)`, idle 리셋 시 `null`

**REFACTOR** — 코드 개선

- `useMemo` value에 `completedSessionId` 포함
- Session DB 저장 시 context도 함께 저장하도록 `updateSession` 호출부 정리

---

### Step 7: fetch-meeting-minutes-client 일관성

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/meeting-minutes/__tests__/fetch-meeting-minutes-client.test.ts`
- 테스트 케이스 (기존 테스트에 추가):
  - `glossary와 sessionContext가 주어지면 fetch body에 포함된다`
  - `glossary와 sessionContext가 없으면 기존 body와 동일하다`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/meeting-minutes/fetch-meeting-minutes-client.ts`
- 시그니처에 optional `options?: { glossary?: string[]; sessionContext?: SessionContext | null }` 추가
- `body: JSON.stringify({ text, model, ...options })` 로 전달

**REFACTOR** — 코드 개선

- 기존 2개 테스트가 깨지지 않는지 확인 (options 미전달 시 기존 동작 유지)

---

### Step 8: Session DB 타입에 context 필드 추가

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/__tests__/db.test.ts`
- 테스트 케이스 (기존 테스트에 추가):
  - `Session에 context 필드 없이 저장/조회해도 정상 동작한다`
  - `SessionUpdate에 context를 포함하여 updateSession하면 저장된다`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/db.ts`
- `Session` 타입에 `context?: MeetingContext` 추가
- `SessionUpdate`에 `context` 추가 (`Partial<Pick<Session, "text" | "summary" | "status" | "context">>`)
- DB 버전 업그레이드 불필요 (IndexedDB는 optional 필드 자유 추가 가능)

**REFACTOR** — 코드 개선

- `MeetingContext` import 경로 정리

---

### Step 9: SessionContextInput 컴포넌트

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/session-context-input.test.tsx`
- 테스트 케이스:
  - `참석자, 주제, 키워드 입력 필드가 렌더링된다`
  - `값 입력 시 onChange 콜백이 호출된다`
  - `disabled=true이면 모든 입력이 비활성화된다`
  - `disabled=true이면 "회의록 생성 중에는 수정할 수 없습니다" 안내가 표시된다`
  - `접기/펼치기 토글이 동작한다`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/session-context-input.tsx`
- Props: `value: SessionContext`, `onChange: (ctx: SessionContext) => void`, `disabled?: boolean`
- 3개 필드: 참석자(`textarea`), 주제(`input`), 키워드(`input`)
- 접을 수 있는 섹션 (기본 펼침)
- disabled 시 잠금 안내 표시

**REFACTOR** — 코드 개선

- 기존 프로젝트 UI 패턴 (rounded-xl, border, shadow-sm 등)과 일관된 스타일 정리

---

### Step 10: 설정 패널에 전역 용어 사전 textarea 추가

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/settings-panel.test.tsx`
- 테스트 케이스 (기존 테스트에 추가):
  - `전역 용어 사전 textarea가 렌더링된다`
  - `textarea에 입력하면 updateGlossary가 호출된다`
  - `녹음 중이면 textarea가 disabled이다`
  - `기존 glossary terms가 줄바꿈 구분으로 표시된다`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/settings-panel.tsx`
- 위치: 회의록 모델 선택 (`meeting-minutes-model-select`) 아래, 언어 설정 위
- `useGlossary()` 훅으로 상태 읽기/쓰기
- textarea: 한 줄에 하나씩 입력, placeholder `"Kubernetes\n김지호\nOKR\nVercel"`
- `onChange`에서 줄바꿈 split → 빈 줄 필터 → `updateGlossary` 호출

**REFACTOR** — 코드 개선

- 기존 설정 패널 스타일 패턴과 일관성 유지

---

### Step 11: sonner 설치 + Toaster 마운트

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/app/__tests__/layout-toaster.test.tsx`
- 테스트 케이스:
  - `layout.tsx에서 Toaster 컴포넌트가 마운트된다` (import 존재 확인 또는 렌더 테스트)

**GREEN** — 테스트를 통과하는 최소 구현

- 의존성: `npm install sonner`
- 구현 파일: `src/app/layout.tsx`
- `<body>` 안에 `<Toaster />` 추가 (sonner에서 import)
- `richColors` 등 기본 설정 적용

**REFACTOR** — 코드 개선

- Toaster 위치가 전역인지, SPA 내비게이션 후에도 유지되는지 확인

---

### Step 12: PipelineToastNotifier 컴포넌트

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/pipeline-toast-notifier.test.tsx`
- 테스트 케이스:
  - `phase가 done으로 전환되고 completedSessionId가 있으면 toast.success가 호출된다`
  - `phase가 처음부터 done이면 (마운트 시) 토스트가 호출되지 않는다`
  - `completedSessionId가 null이면 토스트가 호출되지 않는다`
  - `토스트 action 클릭 시 router.push가 /sessions/{id}로 호출된다`
  - `컴포넌트는 null을 렌더링한다`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/pipeline-toast-notifier.tsx`
- `"use client"` 지시자
- `usePostRecordingPipeline()`에서 `phase`, `completedSessionId` 구독
- `useRef(phase)`로 이전 phase 추적, useEffect에서 전환 감지
- `toast.success("회의록이 완성되었습니다", { action: { label: "바로 보기", onClick: router.push }, duration: 8000 })`
- `return null`

**REFACTOR** — 코드 개선

- `useRouter` import를 `next/navigation`에서 가져오도록 확인

---

### Step 13: Recorder 통합 + Provider 배선

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-batch.test.tsx` (기존 파일에 추가)
- 테스트 케이스:
  - `녹음 중지 시 enqueue에 glossary와 sessionContext가 포함된다`
  - `SessionContextInput이 렌더링된다`
  - `pipeline.isBusy일 때 SessionContextInput이 disabled이다`

- 테스트 파일: `src/components/__tests__/main-app-providers.test.tsx` (신규)
- 테스트 케이스:
  - `GlossaryProvider가 children을 감싼다`
  - `PipelineToastNotifier가 PostRecordingPipelineProvider 안에서 렌더링된다`

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder.tsx`
  - `useGlossary()`로 전역 용어 읽기
  - `useState<SessionContext>`로 세션 컨텍스트 상태 관리
  - `<SessionContextInput>` 렌더링 (녹음 영역 아래, transcript 위)
  - `stop()` → `enqueuePipeline()` 호출 시 `glossary: glossary.terms`, `sessionContext` 포함
  - batch/streaming 두 경로 모두 적용

- 구현 파일: `src/components/providers/main-app-providers.tsx`
  - `GlossaryProvider`를 `SettingsProvider` 안쪽에 추가
  - `PipelineToastNotifier`를 `PostRecordingPipelineProvider` 안쪽 children 위에 추가

**REFACTOR** — 코드 개선

- recorder.tsx의 `stop` 콜백 deps 배열에 glossary, sessionContext 추가
- import 정리 (파일 상단으로 통합)

## 파일 변경 계획

| 파일                                                                       | 변경 유형 | 설명                                                                  |
| -------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------- |
| **신규** `src/lib/glossary/types.ts`                                       | 생성      | GlossaryEntry, GlobalGlossary, SessionContext, MeetingContext 타입    |
| **신규** `src/lib/glossary/context.tsx`                                    | 생성      | GlossaryProvider + useGlossary (localStorage)                         |
| **신규** `src/lib/glossary/__tests__/types.test.ts`                        | 생성      | 타입 검증 테스트                                                      |
| **신규** `src/lib/glossary/__tests__/context.test.tsx`                     | 생성      | GlossaryProvider 테스트                                               |
| `src/lib/meeting-minutes/prompts.ts`                                       | 수정      | buildSystemPromptWithContext 함수 추가                                |
| **신규** `src/lib/meeting-minutes/__tests__/prompts.test.ts`               | 생성      | 프롬프트 빌더 테스트                                                  |
| `src/lib/meeting-minutes/map-reduce.ts`                                    | 수정      | context 파라미터 추가, 빌더 호출                                      |
| `src/lib/meeting-minutes/__tests__/map-reduce.test.ts`                     | 수정      | context 전달 테스트 추가                                              |
| `src/app/api/meeting-minutes/route.ts`                                     | 수정      | glossary/sessionContext 파싱, 검증, 전달                              |
| `src/app/api/meeting-minutes/__tests__/route.test.ts`                      | 수정      | 검증 로직 테스트 추가                                                 |
| `src/lib/api/meeting-minutes-api-constants.ts`                             | 수정      | 검증 상수 추가 (MAX_GLOSSARY_ITEMS, MAX_SESSION_CONTEXT_FIELD_LENGTH) |
| `src/lib/post-recording-pipeline/context.tsx`                              | 수정      | enqueue 입력 확장, completedSessionId 노출, fetch body 확장           |
| `src/lib/post-recording-pipeline/__tests__/meeting-minutes-fetch.test.tsx` | 수정      | context 전달/completedSessionId 테스트 추가                           |
| `src/lib/meeting-minutes/fetch-meeting-minutes-client.ts`                  | 수정      | options 파라미터로 glossary/sessionContext 전달                       |
| `src/lib/meeting-minutes/__tests__/fetch-meeting-minutes-client.test.ts`   | 수정      | context 전달 테스트 추가                                              |
| `src/lib/db.ts`                                                            | 수정      | Session 타입에 context? 추가, SessionUpdate 확장                      |
| `src/lib/__tests__/db.test.ts`                                             | 수정      | context 필드 저장/조회 테스트 추가                                    |
| **신규** `src/components/session-context-input.tsx`                        | 생성      | 세션 컨텍스트 입력 UI                                                 |
| **신규** `src/components/__tests__/session-context-input.test.tsx`         | 생성      | SessionContextInput 테스트                                            |
| `src/components/settings-panel.tsx`                                        | 수정      | 전역 용어 사전 textarea 섹션 추가                                     |
| `src/components/__tests__/settings-panel.test.tsx`                         | 수정      | glossary textarea 테스트 추가                                         |
| `src/app/layout.tsx`                                                       | 수정      | `<Toaster />` 마운트                                                  |
| **신규** `src/components/pipeline-toast-notifier.tsx`                      | 생성      | 파이프라인 완료 토스트 알림                                           |
| **신규** `src/components/__tests__/pipeline-toast-notifier.test.tsx`       | 생성      | PipelineToastNotifier 테스트                                          |
| `src/components/recorder.tsx`                                              | 수정      | glossary/sessionContext 읽기, SessionContextInput 배치, enqueue 전달  |
| `src/components/__tests__/recorder-batch.test.tsx`                         | 수정      | context 전달 테스트 추가                                              |
| `src/components/providers/main-app-providers.tsx`                          | 수정      | GlossaryProvider + PipelineToastNotifier 연결                         |
| `package.json`                                                             | 수정      | sonner 의존성 추가                                                    |

## 완료 조건

1. **모든 기존 테스트 통과** — `npm run test` 전체 green
2. **신규 테스트 통과** — 각 Step의 RED→GREEN 테스트 모두 통과
3. **타입 검사 통과** — TypeScript 컴파일 에러 없음
4. **린트 통과** — `npm run lint` 에러 없음
5. **기능 동작 확인**:
   - 설정 패널에서 전역 용어 사전을 편집하면 localStorage에 저장/복원됨
   - 녹음 화면에서 참석자/주제/키워드를 입력할 수 있음
   - 녹음 후 회의록 생성 시 용어 사전과 세션 컨텍스트가 LLM 프롬프트에 주입됨
   - 회의록 생성 완료 시 sonner 토스트가 표시되고 "바로 보기" 클릭으로 세션 페이지로 이동
   - 파이프라인 진행 중 SessionContextInput이 disabled됨
6. **API 검증**:
   - glossary 200개 초과 시 400
   - sessionContext 필드 2000자 초과 시 400
   - 유효하지 않은 타입 전달 시 400
7. **하위 호환성** — glossary/sessionContext 미전달 시 기존 동작과 동일

## 테스트 전략

### 단위 테스트 (Vitest)

| 대상                                        | 환경                  | 핵심 검증                                                  |
| ------------------------------------------- | --------------------- | ---------------------------------------------------------- |
| `types.ts`                                  | Node                  | 타입 할당 호환성                                           |
| `prompts.ts` (buildSystemPromptWithContext) | Node                  | 섹션 주입 로직, null/빈 값 처리                            |
| `map-reduce.ts`                             | Node                  | context 전달 → 시스템 메시지 반영, reduce 미적용           |
| `route.ts`                                  | Node                  | 검증 로직 (400/413), context → generateMeetingMinutes 전달 |
| `glossary/context.tsx`                      | happy-dom             | localStorage 동기화, Provider/hook 동작                    |
| `pipeline/context.tsx`                      | happy-dom             | enqueue input 확장, completedSessionId 상태 전이           |
| `fetch-meeting-minutes-client.ts`           | Node                  | body에 context 필드 포함                                   |
| `db.ts`                                     | Node + fake-indexeddb | context 필드 저장/조회                                     |
| `session-context-input.tsx`                 | happy-dom             | 입력/disabled/접기 동작                                    |
| `settings-panel.tsx`                        | happy-dom             | glossary textarea 렌더링/입력                              |
| `pipeline-toast-notifier.tsx`               | happy-dom             | phase 전환 → toast 호출, router.push                       |
| `recorder.tsx`                              | happy-dom             | enqueue에 context 포함                                     |

### 테스트 격리 원칙

- 각 테스트 afterEach에서 `cleanup()`, `localStorage.clear()`, `vi.restoreAllMocks()` 호출
- globalThis.fetch 모킹 시 afterEach에서 원본 복원
- DB 테스트는 fake-indexeddb 사용, 테스트 간 DB 초기화

### 테스트 실행

```bash
npm run test          # 전체 1회 실행
npm run test:watch    # 개발 중 감시 모드
```
