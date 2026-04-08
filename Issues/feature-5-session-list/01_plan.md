---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  subagent_model: "claude-4.6-opus-max-thinking"
  feature: "feature-5-session-list"
---

# Feature 5: 과거 세션 목록 및 상세 보기 UI — 개발 계획서

## 개발 범위

- **데이터 계층**: `Session` 배열을 로컬 날짜(타임존) 기준으로 그룹화하고, 그룹·세션 모두 최신순을 유지하는 순수 함수 추가. `getAllSessions()`는 이미 `createdAt` 내림차순이므로 그룹 내부 정렬은 입력 순서를 그대로 쓰면 된다.
- **UI**: `src/components/session-list.tsx`에서 날짜 헤더 + 항목(시각, 텍스트 미리보기 N자) 렌더링, `Link`로 상세 경로 연결.
- **상세**: App Router 동적 라우트 `src/app/sessions/[id]/page.tsx`에서 클라이언트 하위 컴포넌트가 `getSessionById`로 본문 로드, 없으면 404 안내, 뒤로가기(`router.back` 또는 홈 링크).
- **메인 연동**: `src/app/page.tsx`에서 녹음 영역과 목록을 함께 배치. 저장 직후 목록이 갱신되도록 `Recorder`에 선택적 콜백(예: `onSessionSaved`)을 추가하고, 상위 클라이언트 래퍼에서 `SessionList`의 `refresh` 트리거(카운터·키·콜백)로 연결.

## 기술적 접근 방식

- **상세는 페이지 라우트 우선**: URL 공유·북마크·브라우저 뒤로가기·새로고침 시에도 동일 세션을 열 수 있고, 모달에 비해 전역 상태·포커스 트랩·스크롤 잠금을 추가할 필요가 적다. 모달은 동일 레이아웃 내 빠른 미리보기가 필요할 때만 보조로 고려한다.
- **IndexedDB는 클라이언트 전용**: `getAllSessions` / `getSessionById`는 브라우저에서만 호출한다. 상세 `page.tsx`는 서버에서 DB를 읽지 않고, `"use client"` 세션 상세 컴포넌트를 자식으로 두어 `useParams`·`useEffect`로 로드한다(또는 작은 클라이언트 래퍼만 두고 기본 `page`는 얇게 유지).
- **날짜 그룹 키**: `createdAt`을 `Date`로 변환 후 `YYYY-MM-DD`(로컬) 등 정렬 가능한 문자열 키로 묶고, 그룹 배열은 키 내림차순(최신 날짜 먼저)으로 정렬한다.
- **시각 표시**: `toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true })` 등으로 기획안의 “오후 2:30” 형태에 맞춘다.
- **테스트**: 순수 유틸은 Node/happy-dom 무관 Vitest; 컴포넌트·페이지는 `@vitest-environment happy-dom`, `next/navigation`·`idb`는 기존 `db.test.ts`·`recorder-session-storage.test.tsx` 패턴에 맞춰 모킹.

## TDD 구현 순서

### Step 1: 날짜 그룹화·미리보기 유틸

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/__tests__/group-sessions-by-date.test.ts`(및 필요 시 `src/lib/__tests__/session-preview.test.ts`)
- 테스트 케이스 목록
  - 같은 로컬 날짜의 세션 여러 개가 한 그룹으로 묶인다.
  - 서로 다른 날짜는 별도 그룹이며, 그룹 순서는 날짜 최신순이다.
  - 그룹 내 세션 순서는 `getAllSessions()` 결과(이미 최신 먼저)와 동일하다.
  - `previewSessionText(text, maxLen)`(또는 동등 함수)이 공백 trim, 길이 초과 시 말줄임(말줄임 규칙 명시: 예: `…` 접미)을 만족한다.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/group-sessions-by-date.ts`, `src/lib/session-preview.ts`(또는 단일 파일로 합쳐도 됨)
- 핵심 구현 내용
  - `groupSessionsByDate(sessions: Session[]): { dateKey: string; label: string; sessions: Session[] }[]` 형태(또는 동등)로 반환.
  - `previewSessionText`로 목록용 미리보기 문자열 생성.

**REFACTOR** — 코드 개선

- 날짜 라벨(섹션 제목) 생성을 별도 헬퍼로 분리해 테스트와 컴포넌트가 동일 규칙을 쓰게 한다.
- 경계(자정 직전·직후, 빈 텍스트) 처리 일관화.

### Step 2: SessionList 컴포넌트

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/session-list.test.tsx`
- 테스트 케이스 목록
  - `getAllSessions`를 모킹해 그룹 헤더와 항목 수가 기대와 같다.
  - 각 항목에 미리보기와 시간이 보인다.
  - 항목이 `href="/sessions/{id}"`인 링크로 렌더된다(또는 `Link`의 `href` 검증).
  - `refreshTrigger`(또는 `reloadKey`) prop 변경 시 `getAllSessions`가 다시 호출된다.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/session-list.tsx`
- 핵심 구현 내용
  - `"use client"`, `useEffect`에서 `getAllSessions` 호출, 상태에 그룹화 결과 저장.
  - 로딩·빈 목록 UI 최소 처리.

**REFACTOR** — 코드 개선

- 접근성: 목록 `nav`/`region` 레이블, 링크에 읽기 쉬운 이름.
- 스타일은 기존 `page.tsx`·`recorder.tsx`의 zinc/다크 모드 클래스와 맞춘다.

### Step 3: 세션 상세 페이지

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/app/sessions/[id]/__tests__/session-detail-page.test.tsx`(또는 `src/components/__tests__/session-detail.test.tsx`에 `SessionDetail`만 검증)
- 테스트 케이스 목록
  - 유효한 id면 `getSessionById`로 받은 전체 `text`가 화면에 나온다.
  - 없는 id면 “찾을 수 없음” 등 안내와 홈으로 가는 링크가 있다.
  - 뒤로/닫기 동작: `router.back` 모킹 시 호출되거나, 고정 링크로 홈 복귀가 보인다.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/app/sessions/[id]/page.tsx`, `src/components/session-detail.tsx`(클라이언트 로직 분리 시)
- 핵심 구현 내용
  - `params.id`로 클라이언트에서 `getSessionById` 호출, 로딩·에러·미존재 분기.
  - 상단에 제목·뒤로 버튼, 본문은 `whitespace-pre-wrap` 등으로 전사 가독성 유지.

**REFACTOR** — 코드 개선

- 중복 로딩 UI 제거, `Session` 타입은 `@/lib/db`에서 import.

### Step 4: 메인 화면 연동 및 저장 후 갱신

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-session-storage.test.tsx` 확장 또는 `src/app/__tests__/home-session-list.test.tsx`
- 테스트 케이스 목록
  - `Recorder`에 `onSessionSaved`를 넘기면 `saveSession` 성공 후 해당 콜백이 호출된다(기존 모킹된 `saveSession`에 `mockImplementation`으로 연동).
  - (선택) 홈 래퍼에서 콜백으로 `SessionList`의 트리거가 바뀌어 목록 fetch가 한 번 더 일어난다는 통합 테스트.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder.tsx`(선적 `onSessionSaved?: () => void` 또는 `(id: string) => void`), `src/app/page.tsx` 및 신규 `src/components/home-content.tsx`(또는 동일 역할의 클라이언트 컴포넌트)
- 핵심 구현 내용
  - `stop` 흐름에서 `saveSession` 성공 직후 `onSessionSaved?.(id)` 호출.
  - 홈은 클라이언트 래퍼에서 `refreshKey` state를 올리고 `SessionList`에 전달.

**REFACTOR** — 코드 개선

- `Recorder` 공개 props 타입만 최소 확장; 불필요한 리렌더는 `useCallback`으로 상위에서 안정화.

## 파일 변경 계획

| 구분 | 경로                                                                                          |
| ---- | --------------------------------------------------------------------------------------------- |
| 신규 | `src/lib/group-sessions-by-date.ts`                                                           |
| 신규 | `src/lib/session-preview.ts`(또는 그룹 파일에 병합)                                           |
| 신규 | `src/lib/__tests__/group-sessions-by-date.test.ts`                                            |
| 신규 | `src/components/session-list.tsx`                                                             |
| 신규 | `src/components/__tests__/session-list.test.tsx`                                              |
| 신규 | `src/app/sessions/[id]/page.tsx`                                                              |
| 신규 | `src/components/session-detail.tsx`(선택, 로직 분리 시)                                       |
| 신규 | 세션 상세 관련 테스트 파일(위 Step 3와 동일 위치)                                             |
| 신규 | `src/components/home-content.tsx`(또는 유사 이름의 클라이언트 홈 조합)                        |
| 수정 | `src/components/recorder.tsx` — `onSessionSaved` 선택 prop                                    |
| 수정 | `src/app/page.tsx` — `HomeContent` 등으로 `Recorder`+`SessionList` 배치                       |
| 수정 | `src/components/__tests__/recorder-session-storage.test.tsx` — 콜백 동작 테스트 추가(필요 시) |

## 완료 조건

- IndexedDB의 세션이 로컬 날짜별로 그룹화되어 표시되고, 그룹·항목 모두 최신순이다.
- 각 행에 시간(예: 오후 2:30)과 텍스트 미리보기(N자 규칙이 테스트와 UI에 일치)가 보인다.
- 행 클릭 시 `/sessions/[id]`에서 전체 전사를 읽을 수 있고, 뒤로/홈으로 돌아갈 수 있다.
- 녹음 종료 후 저장이 끝나면 전체 페이지 새로고침 없이 목록이 갱신된다.
- `npm test` 및 `npm run build`가 통과한다.

## 테스트 전략

- **단위**: 그룹화·미리보기는 입력 배열만으로 결정적이므로 빠른 순수 테스트.
- **컴포넌트**: RTL + happy-dom; IndexedDB는 실제 호출 대신 `getAllSessions`/`getSessionById` 모킹으로 UI·라우팅만 검증.
- **통합(얕게)**: `Recorder` 저장 콜백이 한 번 호출되는지로 “저장 후 갱신 신호”를 보장; 필요 시 `SessionList`와 같은 트리에서 모킹된 DB로 스모크.
- **수동**: 로컬에서 연속 녹음·저장 후 목록·상세·뒤로가기·다크 모드 확인.

## Issue context (full issue)

(원문은 `00_issue.md` 참고)
