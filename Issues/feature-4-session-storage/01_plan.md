---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "feature-4-session-storage"
---

# Feature 4 — IndexedDB 세션 저장소 — 개발 계획서

## 개발 범위

- **`idb` 기반 IndexedDB 계층**: DB 이름 `whirr-db`, 오브젝트 스토어 `sessions`, 필드 `id`(string, UUID), `createdAt`(number, ms 타임스탬프), `text`(string). `createdAt` 인덱스로 정렬·그룹화 가능하게 구성.
- **CRUD 유틸**: `saveSession(text: string): Promise<string>`, `getAllSessions(): Promise<Session[]>`, `getSessionById(id: string): Promise<Session | undefined>`. **오디오·PCM·ArrayBuffer는 저장하지 않음** — 텍스트와 메타만.
- **녹음 중지 시 자동 저장**: 녹음이 끝날 때 전사 문자열이 비어 있지 않으면 `saveSession` 호출로 새 레코드 생성.
- **텍스트 결정 규칙**: `use-transcription`은 `finals`(확정 세그먼트 배열)와 `partial`(진행 중 텍스트)을 노출하고, `finalizeStreaming`이 끝나면 `setPartial("")`로 partial을 비움. 따라서 **저장용 문자열은 `finalizeStreaming` 호출 직전**에 `finals`와 `partial`을 합쳐 구성한다(예: 확정 구간은 공백으로 `join`, 마지막에 `partial.trim()`이 있으면 추가). 이렇게 하면 중지 시점까지 화면에 보이던 내용과 일치하고, "확정만 저장"보다 데이터 유실이 적다.
- **통합 위치**: `src/app/page.tsx`는 `Recorder`만 렌더하므로, 실제 연동은 **`src/components/recorder.tsx`의 `stop` 콜백**에서 수행한다(`stopRecording` → 스냅샷 → `finalizeStreaming` 순서 권장: 스냅샷은 finalize 직전, 저장은 finalize 이후 비동기 호출로 UI 블로킹 최소화 가능. 단, 스냅샷은 반드시 finalize **전**에 고정).

## 기술적 접근 방식

- **의존성**: `npm install idb`로 `idb` 추가(현재 `package.json`에 없음).
- **`src/lib/db.ts`**: `openDB`로 버전·스토어·`createdAt` 인덱스 마이그레이션 정의. `Session` 타입을 동일 파일 또는 `src/lib/db/types.ts`로 export해 테스트·UI에서 재사용.
- **ID 생성**: 브라우저에서는 `crypto.randomUUID()` 사용. Node/Vitest에서는 `vi.stubGlobal("crypto", { randomUUID: () => "고정-uuid" })` 등으로 대체.
- **전사 텍스트 헬퍼(권장)**: `src/lib/build-session-text.ts` 같은 순수 함수로 `buildSessionText(finals: string[], partial: string): string` 분리 — 훅/컴포넌트와 DB 테스트가 동일 규칙을 공유.
- **`Recorder`의 `stop`**: `useCallback` 의존성에 `partial`, `finals`, `finalizeStreaming`, `stopRecording` 및 `saveSession`(또는 래퍼) 포함해 클로저가 최신 전사 상태를 참조하도록 한다.
- **에러 처리**: IndexedDB 실패 시 사용자에게는 기존 STT 에러 패턴과 구분되는 짧은 로그 또는(후속 이슈) 토스트로 확장 가능; 본 이슈에서는 **저장 실패가 녹음 중지 자체를 깨지 않도록** `try/catch`로 삼키고 `console.error` 정도로 시작해도 됨(완료 조건에 맞게 동작 검증 위주).
- **테스트 환경**: happy-dom만으로는 IndexedDB가 불완전하거나 없을 수 있어, **`fake-indexeddb`**(예: `import "fake-indexeddb/auto"`를 DB 관련 테스트 파일 또는 `src/__tests__/setup`에 조건부 적용) 권장. DB 단위 테스트는 실제 `idb` + fake IndexedDB 조합으로 통과시키고, `Recorder` 통합 테스트는 `vi.mock("@/lib/db")` 또는 `saveSession` 스파이로 호출 여부·인자 검증.

## TDD 구현 순서

### Step 1: 세션 텍스트 조합 규칙

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/__tests__/build-session-text.test.ts`
- 테스트 케이스 목록:
  - `finals`만 있을 때 공백으로 이어붙인 문자열 반환
  - `partial`만 비어 있지 않을 때 해당 문자열만 반환
  - `finals`와 `partial` 모두 있을 때 확정 구간 join 후 partial trim 추가
  - 양쪽 모두 공백/빈 배열이면 빈 문자열

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/build-session-text.ts`
- 핵심 구현 내용: `finals.map((s) => s.trim()).filter(Boolean)` 후 `join(" ")`, `partial.trim()`이 있으면 한 칸 간격으로 결합

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: 구분자(공백 vs 줄바꿈)를 상수로 두어 이후 제품 요구 시 변경 용이

---

### Step 2: IndexedDB 스키마 및 `saveSession` / 조회 API

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/__tests__/db.test.ts`
  - 파일 상단 또는 `beforeEach`에서 `fake-indexeddb/auto` 로드 및 필요 시 `indexedDB` 초기화
- 테스트 케이스 목록:
  - `saveSession` 호출 후 반환 ID가 UUID 형식(또는 mock UUID)
  - 같은 프로세스에서 `getSessionById`로 `text`, `createdAt`, `id` 일치
  - `getAllSessions`가 `createdAt` 인덱스 기준 정렬(오름/내림 — 이슈는 "날짜별 정렬"이므로 계획서에서 한 방향으로 고정, 예: 최신 우선 내림차순)
  - 빈 문자열 저장 시 이슈 정책에 맞게 **저장하지 않거나** 거부 — 본 기능은 "비어 있지 않으면 저장"이므로 `saveSession`은 호출부에서 가드하고, DB는 선택적으로 빈 문자열 거부 테스트 추가 가능

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/db.ts`
- 핵심 구현 내용: `openDB<...>("whirr-db", 1, { upgrade })`에서 `sessions` 스토어 및 `createdAt` 인덱스 생성; `saveSession`에서 `crypto.randomUUID()`, `Date.now()`, `text`로 put 후 id 반환; `getAllSessions`/`getSessionById`는 `idb` API 사용

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: DB 이름·스토어 이름·버전 상수화; upgrade와 런타임 타입을 한곳에서 관리

---

### Step 3: 녹음 중지 시 `saveSession` 연동

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-session-storage.test.tsx`(기존 `recorder-stt-integration.test.tsx` 패턴 재사용)
- 테스트 케이스 목록:
  - 모의 `useTranscription`이 `finals`/`partial`을 제공하고, 중지 클릭 시 `saveSession`이 **기대 문자열**로 1회 호출
  - `finals`와 `partial`이 모두 비어 있으면 `saveSession` 미호출
  - `finalizeStreaming` 호출 순서: 기존 통합 테스트와 같이 `stopRecording` 후 `finalizeStreaming` 유지; 저장은 스냅샷 기준이므로 mock이 스냅샷 시점 값과 일치하는지 검증

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder.tsx`
- 핵심 구현 내용: `stop` 내부에서 `buildSessionText(finals, partial)`로 `snapshot` 생성 → `try/finally`로 `stopRecording` 및 `finalizeStreaming` 유지 → `snapshot.trim()`이 있으면 `void saveSession(snapshot)`(또는 await — UX 정책에 따라 선택)

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향: 저장 로직을 `useCallback`으로 분리하거나 작은 훅 `usePersistSessionOnStop`으로 빼기는 선택 사항(과도한 추상화는 이슈 범위 밖이면 보류)

---

## 파일 변경 계획

| 구분 | 경로                                                                            |
| ---- | ------------------------------------------------------------------------------- |
| 신규 | `src/lib/build-session-text.ts`                                                 |
| 신규 | `src/lib/db.ts`                                                                 |
| 신규 | `src/lib/__tests__/build-session-text.test.ts`                                  |
| 신규 | `src/lib/__tests__/db.test.ts`                                                  |
| 신규 | `src/components/__tests__/recorder-session-storage.test.tsx`                    |
| 수정 | `src/components/recorder.tsx` — `stop`에서 텍스트 스냅샷 및 `saveSession`       |
| 수정 | `package.json` / lock — `idb`, dev `fake-indexeddb`                             |
| 선택 | `src/__tests__/setup.ts` 또는 Vitest `setupFiles` — IndexedDB 폴리필 한 곳 집중 |

## 완료 조건

- 브라우저에서 `whirr-db`와 `sessions` 스토어·`createdAt` 인덱스가 생성된다.
- 녹음 중지 시 전사 텍스트(스냅샷 기준)가 비어 있지 않으면 새 세션이 `sessions`에 추가된다.
- 각 레코드에 고유 `id`, `createdAt`, `text`가 저장된다.
- PCM·오디오 버퍼 등은 IndexedDB에 저장되지 않는다.
- `npm test` 및 `npm run build`가 통과한다.

## 테스트 전략

- **단위**: `build-session-text`는 순수 함수만 검증.
- **DB**: `fake-indexeddb` + 실제 `idb`로 열기·저장·조회·정렬을 검증; `crypto.randomUUID`는 Vitest에서 고정값으로 스텁해 결정적 단언.
- **컴포넌트**: `use-transcription`/`use-recorder`를 vi.mock으로 고정해 **저장 호출과 인자**에 집중; 기존 `recorder-stt-integration.test.tsx`와 동일하게 `/** @vitest-environment happy-dom */` 사용.
- **수동 검증(선택)**: Chrome DevTools → Application → IndexedDB에서 `whirr-db` / `sessions` 레코드 확인.
