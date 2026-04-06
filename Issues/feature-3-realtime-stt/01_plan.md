# Feature 3: AssemblyAI 실시간 STT — 개발 계획서

## 개발 범위

- **서버**: `POST /api/stt/token` 라우트에서 AssemblyAI `POST https://api.assemblyai.com/v2/realtime/token` 호출 후 `{ token: string }` JSON만 클라이언트에 반환. `ASSEMBLYAI_API_KEY`는 서버 환경 변수에만 두고 브라우저로 노출하지 않음.
- **클라이언트 제공자**: `src/lib/stt/assemblyai.ts`에 `TranscriptionProvider` 구현 — `wss://api.assemblyai.com/v2/realtime/ws?token=...` 연결, PCM 청크를 Base64로 `{"audio_data": "<base64>"}` 전송, 메시지 타입 `PartialTranscript`·`FinalTranscript`·`SessionTerminated`(및 오류) 처리, 종료 시 `{"terminate_session": true}` 전송.
- **훅**: `src/hooks/use-transcription.ts`에서 토큰 획득 → 제공자 `connect` / `sendAudio` / `stop`·`disconnect`와 연동, partial·final 텍스트 상태 관리 및 오류 표면화.
- **UI**: `src/components/transcript-view.tsx`에서 “진행 중 한 줄(partial)” + “확정 구간 누적(final 목록)” 표시.
- **통합**: 기존 `useRecorder`의 `onPcmChunk`로 PCM을 훅/제공자에 넘기고, `Recorder` 또는 `page`에서 전사 뷰를 함께 배치.

범위 밖(이번 이슈에서 다루지 않음): 화자 분리, 커스텀 모델, 녹음 파일 업로드 후 비동기 전사, 토큰 캐시/다중 세션 풀.

## 기술적 접근 방식

- **토큰 분리**: 브라우저는 `/api/stt/token`만 호출하고, AssemblyAI Realtime 토큰은 항상 서버가 발급. 라우트에서 API 키 누락·업스트림 4xx/5xx 시 적절한 HTTP 상태와 본문(민감 정보 없음)으로 실패 처리.
- **WebSocket**: `assemblyai.ts`는 `TranscriptionProvider` 계약(`connect` 콜백 시그니처, `sendAudio(ArrayBuffer)`, `stop`/`disconnect`)을 지키고, JSON 파싱 실패·연결 끊김·`SessionTerminated`는 `onError` 또는 정리 플로우로 일관되게 처리.
- **오디오 파이프라인**: `useRecorder`에 이미 있는 `OnPcmChunk` 콜백으로 `ArrayBuffer`를 받아 Base64 인코딩 후 전송(샘플레이트/채널은 기존 `startPcmRecording` 계약에 맞춤; AssemblyAI Realtime 요구사항과 불일치 시 변환은 이 단계에서 최소로 추가).
- **테스트**: Node/Vitest에서는 `global.fetch` 및 `WebSocket`을 모의(mock)하여 라우트 핸들러·제공자를 단위 테스트. 통합은 훅/컴포넌트는 `@testing-library/react` 또는 제공자 주입으로 결정력 있게 검증.

## TDD 구현 순서

### Step 1: STT 토큰 API (`POST /api/stt/token`)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/app/api/stt/token/__tests__/route.test.ts` (또는 프로젝트 관례에 맞는 `src/app/api/stt/token/route.test.ts`)
- 테스트 케이스 목록
  - `ASSEMBLYAI_API_KEY`가 없을 때 503(또는 500)과 JSON 에러 형태.
  - `fetch`가 AssemblyAI에 `Authorization` 헤더와 올바른 URL/메서드로 호출되는지(모의 `fetch`로 검증).
  - 업스트림이 `{ token: "t" }`를 주면 라우트가 200과 `{ token: "t" }` 반환.
  - 업스트림이 토큰 없이 실패하면 502 등으로 매핑.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/app/api/stt/token/route.ts`
- 핵심 구현 내용: `POST`에서 `process.env.ASSEMBLYAI_API_KEY` 읽기 → `fetch("https://api.assemblyai.com/v2/realtime/token", …)` → 응답 JSON에서 `token` 추출 후 `{ token }` 반환.

**REFACTOR** — 코드 개선

- AssemblyAI URL·에러 매핑을 작은 헬퍼로 분리, 로깅은 PII/키 미포함으로만.

---

### Step 2: `AssemblyAIRealtimeProvider` (`TranscriptionProvider`)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/stt/__tests__/assemblyai.test.ts`
- 테스트 케이스 목록
  - `connect` 시 `WebSocket` 생성 URL에 토큰 쿼리 포함(모의 `WebSocket`).
  - `open` 후 `sendAudio`가 Base64 `audio_data` JSON 한 번 전송.
  - 수신 메시지 `PartialTranscript` → `onPartial` 호출.
  - `FinalTranscript` → `onFinal` 호출.
  - `SessionTerminated` → 연결 정리 또는 `onError`/완료 정책에 맞는 동작.
  - `stop`이 `{"terminate_session": true}` 전송 후 close 흐름.
  - `disconnect`가 소켓을 닫음.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/stt/assemblyai.ts`
- 핵심 구현 내용: 클래스 또는 팩토리로 `TranscriptionProvider` 구현, `btoa`/Buffer 기반 Base64, 메시지 타입 분기, 재진입 방지.

**REFACTOR** — 코드 개선

- 메시지 파싱·타입 가드 분리, `send` 큐(OPEN 전 버퍼링) 필요 시 추가.

---

### Step 3: `useTranscription` 훅

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/hooks/__tests__/use-transcription.test.tsx`
- 테스트 케이스 목록
  - 마운트 후 토큰 fetch 실패 시 에러 상태.
  - 모의 제공자로 `connect` 성공 시 “연결됨” 또는 전송 가능 상태.
  - 제공자가 partial/final 콜백을 호출하면 훅 state가 갱신됨.
  - `sendPcm`(또는 동일 역할 함수)이 제공자 `sendAudio`로 위임.
  - 언마운트/리셋 시 `disconnect` 호출.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/hooks/use-transcription.ts`
- 핵심 구현 내용: `/api/stt/token` fetch → `AssemblyAIRealtimeProvider`(또는 주입된 `createProvider(token)`) 생성 → `partialLine`·`finalLines`(또는 단일 문자열 누적) state, 정리용 `useEffect`.

**REFACTOR** — 코드 개선

- 토큰/제공자 생성을 옵션으로 분리해 테스트 용이성 확보.

---

### Step 4: `TranscriptView` UI

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/transcript-view.test.tsx`
- 테스트 케이스 목록
  - partial만 있을 때 라이브 한 줄 표시.
  - final이 여러 개일 때 누적 영역에 순서대로 표시.
  - partial 없고 final만 있을 때 레이아웃·접근성(라이브 영역 `aria-live` 등) 검증.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/transcript-view.tsx`
- 핵심 구현 내용: props로 `partial`, `finals` 받아 상단(또는 별도 블록)에 partial, 하단에 final 리스트.

**REFACTOR** — 코드 개선

- 스타일은 `Recorder`와 동일한 zinc/다크 모드 톤 맞춤, 빈 상태 문구.

---

### Step 5: 페이지·`Recorder` 통합

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-stt-integration.test.tsx` 또는 `src/app/__tests__/page.test.tsx`
- 테스트 케이스 목록
  - 녹음 시작 시 PCM 콜백이 전사 훅으로 전달되는지(모의).
  - 중지 시 `stop`/`disconnect` 순서가 호출되는지.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder.tsx`, 필요 시 `src/app/page.tsx`
- 핵심 구현 내용: `useTranscription`과 `useRecorder(onPcmChunk)`를 같은 클라이언트 경계에서 조합, `TranscriptView`에 state 연결, 녹음 시작 전 토큰/연결 준비 정책(시작 버튼 시 connect 등) 확정.

**REFACTOR** — 코드 개선

- 관심사 분리: 전사 전용 래퍼 컴포넌트(`RecordingWithTranscript`)로 분리 여부 검토.

---

### Step 6: 공개 API·타입 정리

**RED** — 실패하는 테스트 작성

- 테스트 파일: 기존 `src/lib/stt/__tests__/types.test.ts` 보강 또는 `index` re-export 스모크 테스트
- 테스트 케이스 목록
  - `@/lib/stt`에서 `AssemblyAIRealtimeProvider` 또는 팩토리 타입 export가 기대와 일치.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/stt/index.ts`
- 핵심 구현 내용: `TranscriptionProvider` 타입 재export + `assemblyai` 구현체(또는 생성 함수) export.

**REFACTOR** — 코드 개선

- 내부 전용 심볼은 export하지 않음.

## 파일 변경 계획

| 구분 | 경로                                                | 변경 내용                                                 |
| ---- | --------------------------------------------------- | --------------------------------------------------------- |
| 신규 | `src/app/api/stt/token/route.ts`                    | 토큰 프록시 `POST` 핸들러                                 |
| 신규 | `src/app/api/stt/token/__tests__/route.test.ts`     | 라우트 단위 테스트(mock fetch)                            |
| 신규 | `src/lib/stt/assemblyai.ts`                         | `TranscriptionProvider` WebSocket 구현                    |
| 신규 | `src/lib/stt/__tests__/assemblyai.test.ts`          | 모의 WebSocket 단위 테스트                                |
| 수정 | `src/lib/stt/index.ts`                              | `assemblyai` export 추가                                  |
| 신규 | `src/hooks/use-transcription.ts`                    | 토큰 + 제공자 + state                                     |
| 신규 | `src/hooks/__tests__/use-transcription.test.tsx`    | 훅 테스트                                                 |
| 신규 | `src/components/transcript-view.tsx`                | partial + finals UI                                       |
| 신규 | `src/components/__tests__/transcript-view.test.tsx` | 컴포넌트 테스트                                           |
| 수정 | `src/components/recorder.tsx`                       | PCM → 전사 훅 연결, 필요 시 자식에 뷰 포함                |
| 수정 | `src/app/page.tsx`                                  | 레이아웃에 `TranscriptView` 배치(또는 Recorder 내부 통합) |
| 환경 | `.env.example` 등(프로젝트에 있을 경우)             | `ASSEMBLYAI_API_KEY` 문서화                               |

## 완료 조건

- `POST /api/stt/token`이 키가 설정된 환경에서 실제 AssemblyAI 토큰을 반환하고, 키 없음·업스트림 오류 시 안전하게 실패한다.
- `assemblyai.ts`가 계약된 `TranscriptionProvider` 순서와 콜백으로 partial/final을 전달하고, 세션 종료·terminate 규칙을 만족한다.
- 녹음 중 PCM이 실시간으로 전송되고 UI에 partial 한 줄 + 누적 final이 보인다.
- 관련 Vitest(및 프로젝트에 있는 E2E가 있다면 스모크)가 통과한다.
- API 키가 클라 번들·클라이언트 코드에 하드코딩되지 않는다.

## 테스트 전략

- **단위**: 토큰 라우트는 `fetch` 모킹으로 URL·헤더·응답 분기 검증. `assemblyai`는 `WebSocket` 클래스 모킹으로 메시지 송수신·terminate 검증.
- **훅/UI**: React Testing Library로 사용자 관점 상태(에러 문구, partial/final 텍스트) 검증; 제공자와 fetch는 주입 또는 모듈 모킹.
- **통합(수동)**: 로컬에서 마이크 허용 후 한국어/영어 짧은 발화로 partial 갱신과 final 누적 확인, 네트워크 끊김 시 복구·에러 메시지 확인.
- **회귀**: 기존 `useRecorder`·녹음 UI 테스트가 깨지지 않도록 PCM 콜백은 optional 경로 유지.
- **보안**: 스냅샷/로그에 토큰·API 키가 포함되지 않도록 테스트 fixture 설계.
