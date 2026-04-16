---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "feature-16-ai-meeting-minutes"
---

# AI 회의록 생성 — 개발 계획서

## 개발 범위

녹음 완료 후 전사 텍스트를 바탕으로 **AI 회의록**을 생성한다. 기존 `summary` 필드를 회의록 용도로 사용하되 UI 레이블을 "요약"에서 "회의록"으로 전환한다. 긴 전사에도 내용 누락이 없도록 **map-reduce 청크 전략**을 적용하며, API 키는 서버 라우트에서만 사용한다.

### 변경 요약

| 영역            | 변경 내용                                                                |
| --------------- | ------------------------------------------------------------------------ |
| 설정 타입       | `meetingMinutesModel` 필드 추가 (기본값 `gpt-5.4-nano`)                  |
| 설정 UI         | 회의록 모델 선택 드롭다운 추가                                           |
| 청크 유틸       | `src/lib/meeting-minutes/chunk-text.ts` — 텍스트를 토큰 기반 청크로 분할 |
| map-reduce 유틸 | `src/lib/meeting-minutes/map-reduce.ts` — 청크별 요약 → 최종 합성        |
| API 라우트      | `src/app/api/meeting-minutes/route.ts` — OpenAI Chat Completions 호출    |
| 파이프라인      | `/api/summarize` 대신 `/api/meeting-minutes` 호출, 길이 상한 제거        |
| UI 레이블       | "요약" → "회의록" (탭명, 안내 문구, aria-label 등)                       |

## 기술적 접근 방식

### 1. Map-Reduce 회의록 생성 전략

단일 프롬프트에 전체 전사를 넣으면 모델의 컨텍스트 윈도우를 초과하거나 중간 내용이 누락될 수 있다. 이를 방지하기 위해 **2단계 map-reduce** 패턴을 사용한다.

```
전사 텍스트 (길이 무제한)
  ↓ chunk-text.ts: 문단·문장 경계 기준으로 N글자 청크로 분할
  ↓
[청크 1] [청크 2] … [청크 K]
  ↓ MAP: 각 청크 → "이 구간의 핵심 내용을 구조화된 회의록 형태로 정리"
[부분 회의록 1] [부분 회의록 2] … [부분 회의록 K]
  ↓ REDUCE: 모든 부분 회의록을 하나로 합성
최종 회의록
```

- **청크 크기**: `CHUNK_CHAR_LIMIT = 12_000`자 (한국어 기준 약 4,000토큰). 오버랩 200자로 맥락 유지.
- **짧은 전사 최적화**: 전체 길이가 `CHUNK_CHAR_LIMIT` 이하이면 map 단계를 건너뛰고 단일 프롬프트로 회의록 생성 (불필요한 API 호출 절감).
- **API 병렬 호출**: map 단계에서 `Promise.allSettled`로 청크를 동시 처리하되, 하나라도 실패하면 전체를 에러로 처리.

### 2. 서버 라우트 설계

`src/app/api/meeting-minutes/route.ts`에서 OpenAI Chat Completions를 호출한다.

- 환경변수: `OPENAI_API_KEY` (서버 전용)
- 요청 body: `{ text: string; model?: string }`
- map-reduce 로직은 서버에서 실행 — 클라이언트는 단일 POST만 발행
- dev 환경에서 `OPENAI_API_KEY` 미설정 시 mock 응답 반환 (기존 `/api/summarize` 패턴 유지)

### 3. 설정 확장

`TranscriptionSettings`에 `meetingMinutesModel` 필드를 추가한다. 기존 `batchModel`과 동일한 패턴(타입 선언 → 기본값 → `parseTranscriptionSettings` 파싱 → localStorage 저장)을 그대로 따른다.

### 4. 파이프라인 연동

`PostRecordingPipelineContext`에서:

- `SUMMARIZE_MAX_TEXT_LENGTH` 길이 검사를 제거 (서버의 map-reduce가 긴 텍스트 처리)
- `fetch("/api/summarize")` → `fetch("/api/meeting-minutes")` 로 교체
- 요청 body에 `model` 필드 추가 (설정에서 읽은 `meetingMinutesModel`)
- phase 이름 `"summarizing"`은 유지 (내부 상태, UI에만 "회의록" 반영)

### 5. UI 레이블 전환

"요약"이 사용자에게 보이는 모든 곳을 "회의록"으로 변경한다. 코드 내부 변수명(`summary`, `summaryText`, `SummaryTabPanel` 등)은 그대로 유지하여 diff를 최소화한다.

## TDD 구현 순서

### Step 1: 설정 타입에 `meetingMinutesModel` 추가

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/settings/__tests__/types.test.ts`
- 테스트 케이스:
  - `parseTranscriptionSettings(undefined)`의 반환값에 `meetingMinutesModel: "gpt-5.4-nano"` 포함
  - `parseTranscriptionSettings({ meetingMinutesModel: "gpt-4o" })`가 올바르게 파싱됨
  - 빈 문자열 `meetingMinutesModel`은 기본값으로 폴백

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/settings/types.ts`
- `TranscriptionSettings` 타입에 `meetingMinutesModel: string` 추가
- `DEFAULT_TRANSCRIPTION_SETTINGS`에 `meetingMinutesModel: "gpt-5.4-nano"` 추가
- `parseTranscriptionSettings`에 `meetingMinutesModel` 파싱 로직 추가

**REFACTOR** — 코드 개선

- 기본 모델 상수를 `DEFAULT_MEETING_MINUTES_MODEL`로 추출하여 라우트·설정에서 공유

### Step 2: 텍스트 청크 분할 유틸리티

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/meeting-minutes/__tests__/chunk-text.test.ts`
- 테스트 케이스:
  - 짧은 텍스트(< `CHUNK_CHAR_LIMIT`)는 단일 청크 배열 반환
  - 긴 텍스트는 `CHUNK_CHAR_LIMIT` 이하의 여러 청크로 분할
  - 각 청크 사이에 오버랩(200자)이 존재
  - 빈 문자열 입력 시 빈 배열 반환
  - 문장 경계(마침표·물음표·느낌표·줄바꿈)에서 분할되어 문장 중간이 잘리지 않음

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/meeting-minutes/chunk-text.ts`
- `chunkText(text: string, options?: { chunkSize?: number; overlap?: number }): string[]`
- 문장 경계를 찾아 분할, 경계를 못 찾으면 `chunkSize`에서 강제 절단

**REFACTOR** — 코드 개선

- 상수(`CHUNK_CHAR_LIMIT`, `CHUNK_OVERLAP`)를 named export로 분리하여 테스트·라우트에서 참조 가능하게

### Step 3: Map-Reduce 회의록 생성 로직

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/meeting-minutes/__tests__/map-reduce.test.ts`
- 테스트 케이스:
  - 단일 청크 입력 시 reduce 없이 단일 API 호출 결과 반환
  - 다수 청크 입력 시 map(N회) + reduce(1회) 호출 확인 (OpenAI 클라이언트 mock)
  - map 단계에서 하나의 청크가 실패하면 전체 에러 throw
  - 최종 결과가 문자열로 반환됨

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/meeting-minutes/map-reduce.ts`
- 의존성: `openai` npm 패키지 (Chat Completions API)
- `generateMeetingMinutes(text: string, opts: { apiKey: string; model: string }): Promise<string>`
  - 내부적으로 `chunkText` → map(각 청크에 대해 chat completion) → reduce(부분 회의록 합성)
  - map 프롬프트: 시스템 역할 "회의록 작성 보조. 이 구간의 핵심 논의·결정·액션 아이템을 구조화하라."
  - reduce 프롬프트: "여러 구간의 부분 회의록을 하나의 완성된 회의록으로 합성하라. 중복 제거, 시간순 정렬."

**REFACTOR** — 코드 개선

- map/reduce 프롬프트를 상수로 추출 (`src/lib/meeting-minutes/prompts.ts`)
- OpenAI 클라이언트 생성을 헬퍼로 분리하여 테스트 시 DI 가능하게

### Step 4: API 라우트 핸들러

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/app/api/meeting-minutes/__tests__/route.test.ts`
- 테스트 케이스:
  - body 없으면 400
  - `text`가 빈 문자열이면 400
  - 비 JSON body이면 400
  - 정상 요청 시 200 + `{ summary: string }` 반환 (기존 `SummarizeResponseBody` 형태 유지)
  - `OPENAI_API_KEY` 미설정(dev) 시 mock 회의록 반환
  - `model` 필드 전달 시 해당 모델로 호출 확인

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/app/api/meeting-minutes/route.ts`
- `POST` 핸들러: body 파싱 → validation → `generateMeetingMinutes` 호출 → `{ summary }` 반환
- dev fallback: `!process.env.OPENAI_API_KEY` 시 `[Mock 회의록] ...` 반환
- 응답 body 키를 `summary`로 유지하여 클라이언트 파이프라인 호환성 보장

**REFACTOR** — 코드 개선

- 입력 validation 로직을 기존 `/api/summarize/route.ts`와 공유 가능한 헬퍼로 추출 검토 (크기가 작으면 인라인 유지)

### Step 5: 파이프라인 연동 수정

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-batch.test.tsx` (기존 파이프라인 통합 테스트에 케이스 추가)
- 테스트 케이스:
  - 파이프라인이 `/api/meeting-minutes`를 호출하는지 확인 (fetch mock)
  - 요청 body에 `model` 필드가 포함되는지 확인
  - `SUMMARIZE_MAX_TEXT_LENGTH` 초과 텍스트도 에러 없이 요청이 전달되는지 확인

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/post-recording-pipeline/context.tsx`
- 변경 사항:
  - `SUMMARIZE_MAX_TEXT_LENGTH` 길이 검사 블록 제거
  - `fetch("/api/summarize", ...)` → `fetch("/api/meeting-minutes", ...)`
  - body에 `model` 필드 추가: `JSON.stringify({ text: fullText, model })`
  - `PostRecordingPipelineEnqueueInput`에 `meetingMinutesModel: string` 추가
  - 에러 메시지 "요약을 생성하지 못했습니다" → "회의록을 생성하지 못했습니다"

**REFACTOR** — 코드 개선

- `SUMMARIZE_MAX_TEXT_LENGTH` import 및 `summarize-constants.ts` 참조 제거 (더 이상 파이프라인에서 불필요)
- 에러 메시지 문자열을 일관되게 "회의록" 용어로 통일

### Step 6: 설정 UI에 회의록 모델 선택 추가

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/settings-panel.test.tsx` (기존 파일에 케이스 추가)
- 테스트 케이스:
  - 설정 패널에 "회의록 모델" 셀렉트가 렌더링됨
  - 기본값이 `gpt-5.4-nano`
  - 모델 변경 시 `updateSettings({ meetingMinutesModel: ... })` 호출

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/settings-panel.tsx`
- `MEETING_MINUTES_MODEL_OPTIONS` 배열 추가: `gpt-5.4-nano`, `gpt-4o`, `gpt-4o-mini`
- `batchModel` 셀렉트와 동일한 패턴으로 회의록 모델 `<select>` 추가
- 전사 모드와 무관하게 항상 표시 (회의록은 모든 모드에서 생성)

**REFACTOR** — 코드 개선

- 셀렉트 컴포넌트 반복 패턴이 3회 이상이면 공통 `SettingsSelect` 컴포넌트 추출 검토

### Step 7: UI 레이블 "요약" → "회의록" 전환

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/summary-tab-panel.test.tsx`, `src/components/__tests__/main-transcript-tabs.test.tsx`
- 테스트 케이스:
  - `SummaryTabPanel` idle 상태에서 "회의록" 관련 안내 문구 표시
  - `SummaryTabPanel` summarizing 상태에서 "회의록을 생성하는 중" 표시
  - `SummaryTabPanel` complete 상태에서 제목이 "회의록"
  - 탭 이름이 "회의록"으로 표시

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일:
  - `src/components/summary-tab-panel.tsx` — 사용자 노출 문자열 변경
  - `src/components/main-transcript-tabs.tsx` — `TAB_SUMMARY` 상수를 "회의록"으로 변경
  - `src/components/session-detail.tsx` — "요약" 레이블을 "회의록"으로 변경

**REFACTOR** — 코드 개선

- `aria-label` 값들도 "회의록"으로 일관 업데이트
- 파이프라인 에러 메시지 최종 점검

## 파일 변경 계획

| 파일                                                     | 변경 유형 | 설명                                        |
| -------------------------------------------------------- | --------- | ------------------------------------------- |
| `src/lib/settings/types.ts`                              | 수정      | `meetingMinutesModel` 필드·기본값·파싱 추가 |
| `src/lib/settings/__tests__/types.test.ts`               | 수정      | 새 필드 파싱 테스트 추가                    |
| `src/lib/meeting-minutes/chunk-text.ts`                  | **신규**  | 텍스트 청크 분할 유틸리티                   |
| `src/lib/meeting-minutes/__tests__/chunk-text.test.ts`   | **신규**  | 청크 분할 테스트                            |
| `src/lib/meeting-minutes/map-reduce.ts`                  | **신규**  | map-reduce 회의록 생성 로직                 |
| `src/lib/meeting-minutes/__tests__/map-reduce.test.ts`   | **신규**  | map-reduce 테스트 (OpenAI mock)             |
| `src/lib/meeting-minutes/prompts.ts`                     | **신규**  | map/reduce 시스템·유저 프롬프트 상수        |
| `src/app/api/meeting-minutes/route.ts`                   | **신규**  | 회의록 생성 API 라우트 핸들러               |
| `src/app/api/meeting-minutes/__tests__/route.test.ts`    | **신규**  | API 라우트 테스트                           |
| `src/lib/post-recording-pipeline/context.tsx`            | 수정      | 엔드포인트·body·길이 검사·에러 메시지 변경  |
| `src/components/settings-panel.tsx`                      | 수정      | 회의록 모델 셀렉트 추가                     |
| `src/components/__tests__/settings-panel.test.tsx`       | 수정      | 회의록 모델 셀렉트 테스트 추가              |
| `src/components/summary-tab-panel.tsx`                   | 수정      | UI 문자열 "요약" → "회의록"                 |
| `src/components/__tests__/summary-tab-panel.test.tsx`    | 수정      | 변경된 문자열에 맞게 테스트 수정            |
| `src/components/main-transcript-tabs.tsx`                | 수정      | 탭 레이블 "요약" → "회의록"                 |
| `src/components/__tests__/main-transcript-tabs.test.tsx` | 수정      | 탭 레이블 테스트 수정                       |
| `src/components/session-detail.tsx`                      | 수정      | 세션 상세의 "요약" → "회의록"               |
| `src/components/__tests__/recorder-batch.test.tsx`       | 수정      | 파이프라인 연동 테스트 추가                 |

## 완료 조건

- [ ] `npm test` 전체 통과 (신규 + 기존 테스트)
- [ ] `tsc --noEmit` 타입 에러 없음
- [ ] `eslint` 경고/에러 없음
- [ ] `npm run build` 성공
- [ ] 설정 패널에서 회의록 모델(기본 `gpt-5.4-nano`) 변경 가능
- [ ] 녹음 종료 후 전사 완료 시 `/api/meeting-minutes`가 호출되며 선택한 모델이 전달됨
- [ ] `OPENAI_API_KEY` 미설정 dev 환경에서 mock 회의록이 정상 반환됨
- [ ] 12,000자 초과 텍스트에 대해 map-reduce 청크 전략이 동작함 (단위 테스트 검증)
- [ ] UI에서 "요약" 레이블이 모두 "회의록"으로 전환됨
- [ ] 기존 `/api/summarize` 라우트는 하위 호환을 위해 유지 (호출하는 곳 없음을 확인 후 추후 제거)

## 테스트 전략

### 단위 테스트 (Vitest, Node 환경)

| 대상        | 테스트 파일                                            | 핵심 검증                              |
| ----------- | ------------------------------------------------------ | -------------------------------------- |
| 설정 파싱   | `src/lib/settings/__tests__/types.test.ts`             | `meetingMinutesModel` 기본값·파싱·폴백 |
| 텍스트 청크 | `src/lib/meeting-minutes/__tests__/chunk-text.test.ts` | 분할 크기·오버랩·경계·빈 입력          |
| map-reduce  | `src/lib/meeting-minutes/__tests__/map-reduce.test.ts` | 단일/다중 청크, 실패 전파, OpenAI mock |
| API 라우트  | `src/app/api/meeting-minutes/__tests__/route.test.ts`  | 400/200 응답, dev mock, 모델 전달      |

### 컴포넌트 테스트 (Vitest, happy-dom)

| 대상            | 테스트 파일                                              | 핵심 검증                    |
| --------------- | -------------------------------------------------------- | ---------------------------- |
| 설정 패널       | `src/components/__tests__/settings-panel.test.tsx`       | 회의록 모델 셀렉트 렌더·변경 |
| 탭 패널         | `src/components/__tests__/summary-tab-panel.test.tsx`    | "회의록" 문자열              |
| 탭 헤더         | `src/components/__tests__/main-transcript-tabs.test.tsx` | "회의록" 탭명                |
| 파이프라인 통합 | `src/components/__tests__/recorder-batch.test.tsx`       | 엔드포인트·body 검증         |

### mock 전략

- **OpenAI API**: `vi.mock("openai")` — `chat.completions.create`를 mock하여 고정 문자열 반환. map-reduce 호출 횟수를 `toHaveBeenCalledTimes`로 검증.
- **fetch (파이프라인)**: `vi.stubGlobal("fetch", ...)` — `/api/meeting-minutes` 호출을 가로채 응답 body 확인.
- **dev 환경**: `process.env.OPENAI_API_KEY`를 `undefined`로 설정하여 mock 분기 테스트.
