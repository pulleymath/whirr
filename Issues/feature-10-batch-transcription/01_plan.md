---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "feature-10-batch-transcription"
---

# Feature 10: 녹음 후 일괄 전사 — 개발 계획서

## 개발 범위

- **`src/lib/audio.ts`**: 기존 `startPcmRecording`은 유지. `BlobRecordingSession`과 `startBlobRecording()` 추가 — `MediaRecorder`로 webm/opus(폴백 `audio/webm`), `stop()` 시 청크 결합 `Blob` 반환, 입력 레벨용 `AnalyserNode` 동시 제공(기존 `useRecorder`와 동일한 `AnalyserNode` 사용 패턴).
- **`src/app/api/stt/transcribe/route.ts`**: `POST` `multipart/form-data` → OpenAI `POST https://api.openai.com/v1/audio/transcriptions` 프록시, JSON `{ text: string }` 반환.
- **`src/hooks/use-batch-transcription.ts`**: 배치 녹음·전사 상태 머신(`idle` | `recording` | `transcribing` | `done` | `error`), `settings.batchModel`·`settings.language`와 연동할 옵션.
- **`src/components/recorder.tsx`**: `useSettings().mode === "batch"`일 때 실시간 STT 경로(`prepareStreaming` / `sendPcm` / `finalizeStreaming`)와 `useRecorder` PCM 경로 대신 배치 훅 사용. 녹음 중/전사 중/완료 UI 분기, 전사 텍스트를 `TranscriptView`에 반영 후 기존과 동일하게 `saveSession`·요약 탭 플로우 유지.
- **배치 전용**: 55분 경고, 60분 자동 중지 후 `stopAndTranscribe`에 준하는 흐름(자동 전사 시작).
- **보안·운영**: `src/lib/api/stt-token-rate-limit.ts`의 `getClientKeyFromRequest` + `isSttTokenRateLimited` 재사용(토큰 라우트와 동일 정책). 파일 크기 상한 25MB, 허용 MIME 화이트리스트. `OPENAI_API_KEY` 없으면 503, 업스트림 실패 시 502 + 내부 로그, 클라이언트에는 `src/lib/stt/user-facing-error.ts` 패턴에 맞는 메시지(필요 시 새 `error` 코드 문자열 추가).
- **배포**: 루트에 `vercel.json` 없음, `next.config.ts` 기본. 멀티파트 본문 크기·함수 타임아웃은 Vercel/Next App Router 한도를 구현 전 확인하고, 부족 시 `route` 세그먼트의 `maxDuration` 등으로 보완(문서에 한도 명시).
- **문서·이슈 트래킹**: 이슈 본문 §2.7 및 `docs/README.md` 인덱스에 맞춰 `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/PRD.md`, `Issues/STATUS.md` 갱신(구현 완료 단계에서 수행).

## 기술적 접근 방식

- **실시간 경로 보존**: `useTranscription` + `useRecorder(sendPcm)` + OpenAI Realtime / AssemblyAI는 `mode === "realtime"`에서 현행 그대로. `mode === "webSpeechApi"`는 Feature 11 영역으로, 배치 구현 시 기존처럼 “미지원” 분기만 유지하거나 동일 패턴으로 확장 가능한 경계만 둔다.
- **Blob 녹음**: `getUserMedia` 스트림을 `MediaRecorder`와(별도) 레벨 미터용 `AudioContext` + `createMediaStreamSource` + `AnalyserNode`에 연결. `startPcmRecording`과 달리 Worklet 없음. `MediaRecorder.isTypeSupported`로 `audio/webm;codecs=opus` → `audio/webm` 순 폴백.
- **타이머·레벨**: `useRecorder`는 `startPcmRecording`에 종속되어 있어 배치 모드에서는 (a) `useBatchTranscription` 내부에서 `startBlobRecording` 반환 `analyser`로 `useRecorder`와 동일한 RAF·interval 패턴을 복제하거나, (b) 공통 유틸(예: `subscribeMicLevel`, `useRecordingClock`)로 추출한다. 계획상 **최소 구현은 (a)**, **REFACTOR에서 (b) 검토**.
- **전사 결과 → UI**: `TranscriptView`는 `finals: string[]`, `partial: string`만 받는다. 배치 완료 후 전체 문자열은 `finals: [text]`, `partial: ""`처럼 한 덩어리로 넣어 기존 컴포넌트 수정 없이 표시 가능(필요 시 `aria-label` 문구만 배치 모드에서 덜 오해스럽게 조정하는 옵션 prop은 REFACTOR).
- **세션 저장**: `buildSessionText`는 배치에서 `finals` 한 줄·`partial` 공백이면 그대로 저장 문자열이 된다. `stop` 핸들러에서 실시간은 기존 스냅샷, 배치는 `transcript` 문자열 trim 후 `saveSession` 호출로 통일.
- **API 요청**: 클라이언트에서 `FormData`에 `file`(Blob, `audio/webm` 등), `model`, 선택 `language` 필드명은 OpenAI API 스펙에 맞춤(`language`는 `auto`일 때 필드 생략 등 정책을 훅에서 결정).
- **레이트 리밋**: `resetSttTokenRateLimitForTests()`는 기존 테스트와 동일하게 `beforeEach`/`afterEach`에서 호출해 transcribe 라우트 테스트가 토큰 라우트와 버킷을 공유해도 결정적이게 유지.

## TDD 구현 순서

### Step 1: `startBlobRecording` (MediaRecorder + Analyser)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/__tests__/audio-blob-recording.test.ts`(신규; `docs/TESTING.md`의 lib `__tests__/` 패턴에 맞춤. 대안으로 `src/lib/audio.test.ts`에 `describe("startBlobRecording")` 블록 추가도 가능하나, 이슈 명세와 신규 시나리오 분리를 위해 별도 파일 권장)
- 테스트 환경: 파일 상단 `/** @vitest-environment happy-dom */`(브라우저 API 목 필요)
- 테스트 케이스 목록
  - `MediaRecorder` 생성 시 우선 `audio/webm;codecs=opus` mime을 시도하고, 미지원이면 폴백 mime으로 생성되는지( `isTypeSupported` 스텁)
  - `startBlobRecording()` 성공 시 `{ stop, analyser }` 반환, `analyser.getByteTimeDomainData` 호출 가능
  - `dataavailable` 청크가 쌓인 뒤 `stop()`이 **단일 Blob**을 resolve하고, 트랙 `stop` 및 `AudioContext` 정리가 이루어지는지
  - `getUserMedia` 또는 `MediaRecorder` 시작 실패 시 `mapMediaErrorToMessage`와 일관된 에러 처리(거부 시 reject)
  - (선택) 녹음 중 `stop` 호출 전 취소/빠른 stop 등 경계

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/audio.ts`
- 핵심 구현 내용: `BlobRecordingSession` 타입 export, `startBlobRecording(): Promise<BlobRecordingSession>`, 청크 배열·`MediaRecorder`·`AudioContext`+`AnalyserNode` 생명주기

**REFACTOR** — 코드 개선

- `mime` 선택 로직을 작은 순수 함수로 분리해 테스트 중복 감소
- PCM 경로와 공통인 `getUserMedia` 오디오 제약 옵션(echoCancellation 등) 정렬

### Step 2: `POST /api/stt/transcribe`

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/app/api/stt/transcribe/__tests__/route.test.ts`
- 테스트 케이스 목록(패턴은 `src/app/api/stt/token/__tests__/route.test.ts`와 동일: `vi.stubEnv`, `globalThis.fetch` 목, `resetSttTokenRateLimitForTests`)
  - `OPENAI_API_KEY` 없음 → 503, 본문 `error` 키
  - 정상 multipart → `fetch`가 `https://api.openai.com/v1/audio/transcriptions`로 `FormData`/multipart 전달되고, 업스트림 JSON `{ text: "..." }`에서 200 + `{ text }` 반환
  - 파일 필드 없음 / 빈 파일 → 400
  - 크기 \> 25MB → 413
  - 비허용 MIME → 415 또는 400(프로젝트에서 하나로 통일)
  - `isSttTokenRateLimited` true → 429, 본문은 토큰 라우트와 동일 또는 transcribe용 메시지(일관성 유지)
  - 업스트림 non-OK → 502
  - 잘못된 JSON 응답 → 502

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/app/api/stt/transcribe/route.ts`
- 핵심 구현 내용: `request.formData()` 파싱, 필드 검증, 바이트 길이 계산, OpenAI로 프록시 `fetch`, 환경 변수 검사

**REFACTOR** — 코드 개선

- 허용 MIME·최대 크기를 `src/lib/api/` 또는 `src/lib/stt/` 상수로 추출
- `userFacingSttError`용 서버 `error` 문자열 상수화(토큰·전사 공통 레이트 리밋 메시지 정리)

### Step 3: `useBatchTranscription`

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/hooks/__tests__/use-batch-transcription.test.tsx`(`use-transcription.test.tsx`와 동일하게 React + `renderHook` 또는 래퍼 컴포넌트)
- 테스트 케이스 목록
  - `startRecording` 성공 시 `status`: `idle` → `recording`
  - `stopAndTranscribe` 시 `fetch("/api/stt/transcribe", …)` 호출( `vi.fn` ), 성공 응답 → `transcribing` 경유 `done`, `transcript` 설정
  - HTTP 에러/네트워크 에러 → `error`, `errorMessage` 설정
  - `startBlobRecording` 목: resolve/reject에 따른 상태 전이
  - Blob 참조 해제는 직접 검증 어렵으나, 성공 후 재 `startRecording` 시 이전 세션 오염 없음 정도로 간접 검증

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/hooks/use-batch-transcription.ts`
- 핵심 구현 내용: 세션 ref, `FormData` 구성(`file` Blob, `model`, `language`), `settings`와의 연동은 props 또는 훅 인자로 `batchModel`/`language` 주입(Recorder에서 전달)

**REFACTOR** — 코드 개선

- `fetch` 래퍼 또는 공통 API 클라이언트가 있으면 재사용
- 상태 전이를 `useReducer`로 묶을지 여부 판단

### Step 4: `Recorder` 배치 모드 통합 및 시간 제한

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-batch.test.tsx`(신규). `MainAppProviders` + `localStorage`에 `mode: "batch"` 패치(`recorder-settings.test.tsx`, `recorder-session-storage.test.tsx` 패턴).
- 테스트 케이스 목록
  - 배치 모드에서 녹음 시작 시 **더 이상** “아직 지원되지 않는 모드”가 아니라, 녹음 중 안내 문구(이슈: “녹음 중입니다. 녹음을 종료하면 전사가 시작됩니다.”)가 보이는지
  - `stop` 클릭 후 전사 중 로딩/스피너(또는 `role="status"`) 표시
  - 목 `useBatchTranscription` 또는 `fetch`로 전사 완료 시 `saveSession`이 **전사 텍스트**로 호출되고 `onSessionSaved`가 호출되는지(`vi.mock("@/lib/db")` 재사용)
  - `mode: "realtime"` 기존 테스트는 `recorder-settings.test.tsx`의 batch 케이스를 **이 파일로 이전·갱신**하거나, 배치 구현 후 해당 테스트를 “배치 녹음 시작 가능”으로 수정
  - (시간 제한) `vi.useFakeTimers()`로 경과 시간을 돌려 55분 시점 경고(토스트/문구), 60분 시 자동 `stopAndTranscribe` 유사 동작이 한 번만 일어나는지 — 훅/Recorder 중 타이머를 둔 곳에 맞춰 단위 테스트 배치

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder.tsx` (필요 시 `src/hooks/use-batch-transcription.ts`에 타이머)
- 핵심 구현 내용: `settings.mode` 분기, 배치 시 `TranscriptView`에 안내/로딩/결과(`finals`/`partial`) 반영, `stop`에서 실시간과 동일한 `saveSession`·요약 탭 후처리, 55/60분 배치 전용 타이머

**REFACTOR** — 코드 개선

- `start`/`stop` 콜백 분기가 비대해지면 `useRecorderController` 등 소규모 훅으로 분리 여부 검토
- `TranscriptView` 접근성 문구 배치 모드 대응

### Step 5: 문서·상태 파일(비기능 완료)

**RED** — (문서는 TDD 대상에서 제외하고 체크리스트로 검증)

**GREEN**

- `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/PRD.md`, `Issues/STATUS.md`에 이슈 §2.7 반영

**REFACTOR**

- `docs/CODEMAP.md`에 신규 API·훅 한 줄 추가 여부 확인

## 파일 변경 계획

| 경로                                                                                                    | 변경                                              |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `src/lib/audio.ts`                                                                                      | `BlobRecordingSession`, `startBlobRecording` 추가 |
| `src/lib/__tests__/audio-blob-recording.test.ts`                                                        | 신규                                              |
| `src/app/api/stt/transcribe/route.ts`                                                                   | 신규                                              |
| `src/app/api/stt/transcribe/__tests__/route.test.ts`                                                    | 신규                                              |
| `src/hooks/use-batch-transcription.ts`                                                                  | 신규                                              |
| `src/hooks/__tests__/use-batch-transcription.test.tsx`                                                  | 신규                                              |
| `src/components/recorder.tsx`                                                                           | batch 분기·UI·저장·타이머                         |
| `src/components/__tests__/recorder-batch.test.tsx`                                                      | 신규                                              |
| `src/components/__tests__/recorder-settings.test.tsx`                                                   | batch “미지원” 기대값 제거 또는 시나리오 이동     |
| `src/lib/stt/user-facing-error.ts`                                                                      | 전사·레이트리밋 관련 문자열 매핑 추가(필요 시)    |
| `next.config.ts` 또는 라우트 `export const maxDuration`                                                 | 타임아웃·본문 한도 확인 후 필요 시만              |
| `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/PRD.md`, `Issues/STATUS.md`, `docs/CODEMAP.md`(선택) | 이슈 §2.7                                         |

## 완료 조건

이슈 `00_issue.md` §3 완료 조건 체크리스트를 그대로 만족:

- `startBlobRecording()`이 webm/opus(폴백 포함)로 녹음하고 `stop()`에서 `Blob` 반환
- `POST /api/stt/transcribe`가 Whisper(또는 설정 모델)로 프록시하고 `{ text }` 반환
- 레이트 리밋·25MB·MIME 검증 적용
- `useBatchTranscription`이 녹음→중지→전사→완료/에러 흐름 관리
- 설정 `녹음 후 전사`(batch)에서 Recorder가 배치 흐름으로 동작
- 배치 UI 안내·전사 중 로딩·완료 후 `TranscriptView` + IndexedDB 저장
- 55분 경고·60분 자동 중지·자동 전사(배치만)
- 실시간 STT 코드 경로 회귀 없음
- `npm run test` 전부 통과

## 테스트 전략

- **러너**: Vitest, 기본 Node; DOM/React는 `happy-dom` 파일 지시자(`docs/TESTING.md`).
- **모킹**: `globalThis.fetch`, `MediaRecorder`, `navigator.mediaDevices.getUserMedia`, `AudioContext`(필요 시 `audio.test.ts`의 PCM 테스트 패턴 참고), `saveSession`, 기존 Recorder 통합 테스트처럼 `use-transcription`/`use-recorder` 선택적 목.
- **격리**: `resetSttTokenRateLimitForTests()`를 transcribe·token API 테스트에서 공통 정리.
- **회귀**: `recorder-stt-integration.test.tsx`, `recorder-session-storage.test.tsx`, `recorder-settings.test.tsx`를 배치 도입 후 한 번 전체 실행해 realtime 경로 깨짐 방지.
- **수동**: 로컬에서 긴 녹음·25MB 근접 파일은 비용·시간 이슈로 자동화는 선택; 최소한 짧은 클립으로 E2E 수준은 수동 스모크.
