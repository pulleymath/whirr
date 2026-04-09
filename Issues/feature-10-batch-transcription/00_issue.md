# Feature 10: 녹음 후 일괄 전사 (Batch Transcription)

## 1. 개요

실시간 전사의 인식률이 기대에 못 미치는 상황에서, **녹음을 먼저 완료한 뒤 한꺼번에 전사하는 방식**을 추가한다. OpenAI Whisper REST API(`POST /v1/audio/transcriptions`)를 사용하며, 녹음에는 브라우저 `MediaRecorder` API로 압축된 webm/opus 오디오를 생성한다.

기존 실시간 전사 코드는 **제거하지 않고 그대로 유지**한다. 사용자가 Feature 9(설정 UI)에서 `녹음 후 전사` 모드를 선택하면 이 기능이 활성화된다.

### 배경

- OpenAI Realtime Transcription API의 실시간 인식률이 회의 환경(다화자, 원거리 마이크, 배경 소음)에서 안정적이지 않은 경우가 있다.
- Whisper REST API는 전체 오디오를 한 번에 처리하므로, **인식 정확도가 실시간 대비 높다**.
- 녹음 후 전사는 실시간 미리보기를 포기하는 대신, **최종 결과물의 품질을 우선**하는 트레이드오프다.
- 기존 아키텍처에서 오디오는 영구 저장 대상이 아니었으나, 배치 모드에서는 녹음 종료까지 **임시로 메모리에 보관**한 뒤 전사가 끝나면 즉시 폐기한다.

### 참고 자료

- [OpenAI Audio Transcriptions API](https://platform.openai.com/docs/api-reference/audio/createTranscription)
- [MediaRecorder Web API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)

### 선행 작업

- Feature 9 (설정 인프라 및 UI) — 설정 Context와 모드 선택 UI가 구현되어 있어야 한다.

## 2. 상세 기획 (Detailed Plan)

### 2.1 MediaRecorder 기반 녹음 유틸

**파일**: `src/lib/audio.ts` (기존 파일에 추가)

기존 `startPcmRecording` 함수와 별개로, 압축된 오디오 Blob을 생성하는 녹음 함수를 추가한다.

```ts
interface BlobRecordingSession {
  stop: () => Promise<Blob>;
  analyser: AnalyserNode;
}

function startBlobRecording(): Promise<BlobRecordingSession>;
```

- **코덱**: `audio/webm;codecs=opus` 우선. 미지원 브라우저는 `audio/webm` 폴백.
- **내부 동작**:
  1. `navigator.mediaDevices.getUserMedia({ audio: ... })` 으로 마이크 스트림 획득.
  2. `MediaRecorder` 인스턴스를 생성하고, `ondataavailable`에서 청크를 배열에 축적.
  3. `stop()` 호출 시 MediaRecorder를 중지하고, 축적된 청크를 하나의 `Blob`으로 결합하여 반환.
  4. `AnalyserNode`를 함께 반환해, 기존 `Recorder` 컴포넌트의 입력 레벨 미터가 동일하게 동작하도록 한다.
- **기존 코드 영향**: `startPcmRecording`은 수정하지 않는다. 두 함수가 공존한다.

#### 파일 크기 및 제한 사항

| 코덱      | 예상 비트레이트 | 1분     | 30분   | 1시간  |
| --------- | --------------- | ------- | ------ | ------ |
| webm/opus | ~48–64 kbps     | ~0.4 MB | ~12 MB | ~24 MB |

- Whisper API 파일 크기 제한: **25 MB**
- 약 1시간 녹음까지는 단일 파일로 커버 가능. 초과 시 청크 분할 전략이 필요하나, **MVP에서는 1시간 제한을 명시**하고, 초과 시 사용자에게 안내한다.

### 2.2 서버 API Route — Whisper 전사 프록시

**파일**: `src/app/api/stt/transcribe/route.ts` (신규)

클라이언트에서 오디오 Blob을 받아 OpenAI Whisper API에 프록시하는 API Route.

- **메서드**: `POST`
- **요청**: `multipart/form-data`
  - `file`: 오디오 Blob (webm)
  - `model`: 사용할 모델 ID (`whisper-1`, `gpt-4o-transcribe` 등)
  - `language`: 언어 코드 (생략 시 자동 감지)
- **서버 처리**:
  1. `OPENAI_API_KEY` 환경 변수로 인증.
  2. `FormData`를 구성하여 `POST https://api.openai.com/v1/audio/transcriptions`에 전달.
  3. 응답에서 `text` 필드를 추출하여 `{ text: "..." }` 형태로 클라이언트에 반환.
- **보안**:
  - 기존 `stt-token-rate-limit`과 동일한 레이트 리밋 적용.
  - 파일 크기 상한 검증 (25 MB 초과 시 413 응답).
  - 허용 MIME 타입 검증 (`audio/webm`, `audio/wav`, `audio/mp4` 등).
- **에러 처리**:
  - OpenAI 업스트림 오류 시 502 + 사용자 친화적 에러 메시지.
  - API 키 미설정 시 503.

```ts
// 응답 예시
{ "text": "안녕하세요, 오늘 회의 안건은..." }
```

#### Vercel Functions 고려사항

- **요청 본문 크기**: Vercel Serverless Functions는 기본적으로 요청 본문 크기 제한이 있다. `vercel.json` (또는 `next.config`)에서 해당 API route의 `bodyParser` 설정을 조정해야 할 수 있다.
- **함수 타임아웃**: Whisper API 응답 시간은 오디오 길이에 비례한다. 30분 오디오 기준 약 30–60초 예상. Vercel Functions 기본 타임아웃(300초)으로 충분하다.

### 2.3 배치 전사 훅

**파일**: `src/hooks/use-batch-transcription.ts` (신규)

녹음 후 일괄 전사의 상태 관리를 담당하는 훅.

```ts
type BatchTranscriptionStatus =
  | "idle" // 대기
  | "recording" // 녹음 중 (전사는 아직 시작하지 않음)
  | "transcribing" // 녹음 종료, 전사 API 호출 중
  | "done" // 전사 완료
  | "error"; // 에러 발생

interface UseBatchTranscriptionReturn {
  status: BatchTranscriptionStatus;
  transcript: string | null;
  errorMessage: string | null;
  /** 녹음 + 전사를 위한 API. Recorder가 호출한다. */
  startRecording: () => Promise<void>;
  stopAndTranscribe: () => Promise<void>;
}

function useBatchTranscription(options?: {
  model?: string;
  language?: string;
}): UseBatchTranscriptionReturn;
```

- **녹음 시작**: `startBlobRecording()`을 호출하여 MediaRecorder 세션을 시작한다.
- **녹음 중지 + 전사**: MediaRecorder를 중지해 Blob을 받고, 즉시 `POST /api/stt/transcribe`에 전송한다.
  - 전송 중 `status`는 `'transcribing'`.
  - 성공 시 `transcript`에 전사 텍스트를 저장하고 `status`를 `'done'`으로 변경.
  - 실패 시 `errorMessage`를 설정하고 `status`를 `'error'`로 변경.
- **메모리 관리**: Blob은 전사 완료 후 참조를 해제하여 GC 대상이 되도록 한다.

### 2.4 Recorder 컴포넌트 배치 모드 통합

**파일**: `src/components/recorder.tsx`

Feature 9에서 추가한 `useSettings()`로 현재 모드를 읽고, `mode === 'batch'`일 때 배치 전사 흐름을 사용한다.

#### 녹음 중 UI 변경

- **실시간 모드**: 기존과 동일. 녹음 중 `TranscriptView`에 부분 결과(partial)와 확정 결과(finals)가 표시된다.
- **배치 모드**: 녹음 중 `TranscriptView` 영역에 "녹음 중입니다. 녹음을 종료하면 전사가 시작됩니다." 안내 메시지를 표시한다. 타이머와 입력 레벨 미터는 동일하게 동작한다.

#### 녹음 종료 후 UI 변경

- **배치 모드 전사 중**: "전사 중..." 로딩 인디케이터 + 프로그레스 바 또는 스피너.
- **전사 완료**: 전사 결과를 `TranscriptView`에 표시하고, 세션을 저장한다.
- **에러**: 사용자 친화적 에러 메시지 표시.

#### 코드 구조

```
start 버튼 클릭
├── mode === 'realtime'
│   └── prepareStreaming() → startRecording(sendPcm) → (실시간 전사)
├── mode === 'batch'
│   └── batchTranscription.startRecording() → (녹음만 진행)
└── mode === 'webSpeechApi'
    └── (Feature 11에서 구현)

stop 버튼 클릭
├── mode === 'realtime'
│   └── stopRecording() → finalizeStreaming() → saveSession()
├── mode === 'batch'
│   └── batchTranscription.stopAndTranscribe() → (전사 완료 후) saveSession()
└── mode === 'webSpeechApi'
    └── (Feature 11에서 구현)
```

### 2.5 녹음 시간 제한 및 안내

- **1시간 소프트 리밋**: 녹음 시간이 55분을 초과하면 "녹음 가능 시간이 5분 남았습니다" 토스트/알림 표시.
- **1시간 하드 리밋**: 60분 도달 시 자동으로 녹음을 중지하고 전사를 시작한다.
- 이 제한은 배치 모드에서만 적용한다 (실시간 모드는 스트리밍이므로 파일 크기 제한이 없음).

### 2.6 테스트

- `src/lib/__tests__/audio-blob-recording.test.ts`: `startBlobRecording` 단위 테스트
  - MediaRecorder Mock으로 녹음 시작/중지/Blob 반환 검증
- `src/app/api/stt/transcribe/__tests__/route.test.ts`: API Route 단위 테스트
  - 정상 전사 응답 반환
  - 파일 크기 초과 시 413 반환
  - MIME 타입 검증
  - API 키 미설정 시 503 반환
  - 레이트 리밋 초과 시 429 반환
- `src/hooks/__tests__/use-batch-transcription.test.ts`: 배치 전사 훅 테스트
  - status 전이: idle → recording → transcribing → done
  - 에러 시 status 전이: → error
- `src/components/__tests__/recorder-batch.test.tsx`: Recorder 배치 모드 통합 테스트
  - 배치 모드에서 녹음 중 안내 메시지 표시
  - 전사 중 로딩 상태 표시
  - 전사 완료 후 세션 저장

### 2.7 문서 업데이트

- `docs/DECISIONS.md`: 배치 전사 방식 결정 기록 (MediaRecorder + Whisper REST API, 1시간 제한 사유)
- `docs/ARCHITECTURE.md`: 배치 전사 데이터 흐름 추가 (마이크 → MediaRecorder → Blob → API Route → Whisper API → 텍스트)
- `docs/PRD.md`: 전사 방식에 "녹음 후 일괄 전사" 옵션 추가
- `Issues/STATUS.md`: Feature 10 항목 추가

## 3. 완료 조건 (Done Criteria)

- [ ] `startBlobRecording()` 함수가 `MediaRecorder`로 webm/opus 오디오를 녹음하고, `stop()` 호출 시 `Blob`을 반환한다.
- [ ] `POST /api/stt/transcribe` API Route가 오디오 Blob을 받아 OpenAI Whisper API에 전달하고, 전사 텍스트를 반환한다.
- [ ] API Route에 레이트 리밋, 파일 크기 검증, MIME 타입 검증이 적용되어 있다.
- [ ] `useBatchTranscription` 훅이 녹음 시작 → 녹음 중지 → 전사 → 완료의 전체 흐름을 관리한다.
- [ ] 설정에서 `녹음 후 전사` 모드 선택 시, `Recorder`가 배치 전사 흐름으로 동작한다.
- [ ] 배치 모드 녹음 중 "녹음 중입니다..." 안내가 표시되고, 전사 중 로딩 인디케이터가 표시된다.
- [ ] 전사 완료 후 결과 텍스트가 `TranscriptView`에 표시되고, 세션이 IndexedDB에 저장된다.
- [ ] 1시간 녹음 시간 제한이 동작한다 (55분 경고 + 60분 자동 중지).
- [ ] 기존 실시간 전사(OpenAI Realtime) 코드가 수정되지 않고 정상 동작한다.
- [ ] 모든 단위 테스트·통합 테스트가 통과한다.
