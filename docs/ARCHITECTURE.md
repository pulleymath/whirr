# Whirr — Technical Architecture

> PRD.md의 요구사항을 기술적으로 구현하기 위한 아키텍처 문서.

---

## 1. 시스템 전체 구조

```
┌──────────────────────────────────────────────────┐
│                Browser (Desktop)                  │
│                                                   │
│  ┌──────────────┐  ┌────────────┐  ┌──────────┐ │
│  │   녹음 UI    │  │ STT Provider│  │세션 목록 │ │
│  │              │  │ (추상화 계층) │  │  UI      │ │
│  │ getUserMedia │  │             │  │          │ │
│  │ + AudioWorklet  │  │             │  │IndexedDB │ │
│  └──────┬───────┘  └──────┬──────┘  └──────────┘ │
│         │ PCM audio       │ WebSocket              │
└─────────┼─────────────────┼────────────────────────┘
          │                 │
          └────────┬────────┘
                   │ WSS (직접 연결)
                   ▼
          ┌────────────────────┐
          │  STT API           │
          │  (AssemblyAI 등)   │
          │                    │
          │  오디오 수신 →       │
          │  실시간 전사 →       │
          │  결과 push          │
          └────────────────────┘

          ┌────────────────────┐
          │  Next.js API Route │
          │  (Vercel)          │
          │                    │
          │  역할: 임시 토큰     │
          │  발급만 담당         │
          └────────────────────┘
```

**핵심 변경**: 별도의 백엔드 서버를 두지 않는다. 브라우저가 STT API에 **직접** WebSocket 연결을 맺고, Next.js API Route는 **임시 토큰 발급**만 담당한다.

---

## 2. STT Provider 추상화

추후 STT 엔진을 교체(Deepgram, Google Cloud STT, 자체 호스팅 등)할 수 있도록 프론트엔드에 **Provider 추상화 계층**을 둔다.

### 2.1. 인터페이스

```typescript
interface TranscriptionProvider {
  connect(
    onPartial: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (error: Error) => void
  ): Promise<void>;
  sendAudio(pcmData: ArrayBuffer): void;
  stop(): Promise<void>;
  disconnect(): void;
}
```

모든 STT Provider는 이 인터페이스를 구현한다. UI 코드는 Provider 구현체를 직접 참조하지 않고, 이 인터페이스를 통해서만 상호작용한다.

### 2.2. 초기 구현: AssemblyAI

```
AssemblyAIProvider implements TranscriptionProvider
  │
  ├── connect()  → API Route에서 임시 토큰 발급 → AssemblyAI WSS 연결
  ├── sendAudio() → WebSocket으로 PCM 청크 전송
  ├── stop()     → 세션 종료 메시지, final transcript 수신 대기
  └── disconnect() → WebSocket 정리
```

### 2.3. 향후 확장 예시

| Provider             | 연결 방식                    | 변경 범위                             |
| -------------------- | ---------------------------- | ------------------------------------- |
| `DeepgramProvider`   | 브라우저 → Deepgram WSS 직접 | Provider 파일 1개 추가                |
| `SelfHostedProvider` | 브라우저 → 자체 서버 WSS     | Provider 파일 + 별도 백엔드 서버 구축 |

Provider 교체 시 UI 코드 변경은 **없다**. 설정(환경 변수 등)으로 어떤 Provider를 사용할지 결정한다.

---

## 3. 프론트엔드

### 3.1. 기술 스택

| 항목       | 선택                     | 비고               |
| ---------- | ------------------------ | ------------------ |
| 프레임워크 | **Next.js** (App Router) | Vercel 배포 최적화 |
| 언어       | **TypeScript**           |                    |
| 스타일링   | 미정 (Tailwind CSS 권장) |                    |

### 3.2. 역할

| 책임        | 설명                                                    |
| ----------- | ------------------------------------------------------- |
| 마이크 캡처 | `getUserMedia` → `AudioWorklet`으로 PCM 16kHz mono 변환 |
| 오디오 전송 | STT Provider를 통해 WebSocket으로 PCM 청크 스트리밍     |
| 실시간 표시 | Provider에서 push된 부분 전사 텍스트를 UI에 반영        |
| 세션 저장   | 녹음 종료 시 확정 텍스트를 IndexedDB에 저장             |
| 세션 열람   | IndexedDB에서 세션 목록 조회·상세 보기                  |

### 3.3. IndexedDB 스키마

**Database**: `whirr-db`

**Object Store**: `sessions`

| 필드        | 타입                  | 설명               |
| ----------- | --------------------- | ------------------ |
| `id`        | string (UUID)         | Primary key        |
| `createdAt` | number (timestamp ms) | 세션 생성 시각     |
| `text`      | string                | 확정된 전사 텍스트 |

인덱스: `createdAt` (날짜별 정렬·그룹화 용도)

---

## 4. Next.js API Route

별도 백엔드 서버 없이, Next.js의 **Route Handler**로 최소한의 서버 로직을 처리한다.

### 4.1. 엔드포인트

| 경로             | 메서드 | 역할                      | 응답                 |
| ---------------- | ------ | ------------------------- | -------------------- |
| `/api/stt/token` | POST   | AssemblyAI 임시 토큰 발급 | `{ "token": "..." }` |

### 4.2. 토큰 발급 흐름

```
Browser                    Next.js API Route            AssemblyAI
  │                              │                          │
  │── POST /api/stt/token ──────→│                          │
  │                              │── POST /v2/realtime/token│
  │                              │   (API Key in header)───→│
  │                              │←── { "token": "..." } ──│
  │←── { "token": "..." } ──────│                          │
  │                              │                          │
  │── WSS 직접 연결 (token 사용) ─────────────────────────────→│
```

API Key는 **서버 환경 변수**에만 존재하며, 클라이언트에 노출되지 않는다.

---

## 5. 실시간 전사 프로토콜

### 5.1. AssemblyAI WebSocket 프로토콜 (현재 Provider)

**연결**: `wss://api.assemblyai.com/v2/realtime/ws?token={temp_token}`

#### 브라우저 → AssemblyAI

| 메시지        | 형식                               | 설명                     |
| ------------- | ---------------------------------- | ------------------------ |
| 오디오 데이터 | JSON `{"audio_data": "<base64>"}`  | base64 인코딩된 PCM 청크 |
| 세션 종료     | JSON `{"terminate_session": true}` | 전사 종료 신호           |

#### AssemblyAI → 브라우저

| 메시지 타입         | 형식                                                   | 설명             |
| ------------------- | ------------------------------------------------------ | ---------------- |
| `PartialTranscript` | `{"message_type": "PartialTranscript", "text": "..."}` | 중간 전사 결과   |
| `FinalTranscript`   | `{"message_type": "FinalTranscript", "text": "..."}`   | 확정된 전사 결과 |
| `SessionTerminated` | `{"message_type": "SessionTerminated"}`                | 세션 종료 확인   |

### 5.2. 앱 내부 이벤트 (Provider 추상화 후)

UI 코드가 받는 이벤트는 Provider에 의해 정규화된다:

| 콜백              | 의미                            | 사용                      |
| ----------------- | ------------------------------- | ------------------------- |
| `onPartial(text)` | 현재 발화 중인 문장의 중간 결과 | UI에 실시간 표시 (교체형) |
| `onFinal(text)`   | 확정된 문장                     | 누적 텍스트에 append      |
| `onError(error)`  | 에러 발생                       | UI에 에러 표시            |

### 5.3. 시퀀스 다이어그램

```
Browser                         AssemblyAI
  │                                │
  │── POST /api/stt/token ────→ (Next.js API Route)
  │←── { token } ──────────────────│
  │                                │
  │── WSS 연결 (token) ───────────→│
  │                                │
  │── {"audio_data": "..."} ─────→│
  │←── PartialTranscript ─────────│
  │                                │
  │── {"audio_data": "..."} ─────→│
  │←── FinalTranscript ───────────│
  │                                │
  │── {"terminate_session": true}─→│
  │←── SessionTerminated ─────────│
  │                                │
  │── WSS 종료 ───────────────────→│
```

---

## 6. 데이터 흐름 요약

```
[마이크]
   │
   ▼
[AudioWorklet] ─ PCM 16kHz mono
   │
   ▼
[STT Provider] ─ base64 인코딩 ─→ [AssemblyAI WSS]
                                        │
                      부분/확정 텍스트 ←──┘
                          │
                          ▼
                    [UI 실시간 표시]
                          │
                     녹음 종료 시
                          │
                          ▼
                    [IndexedDB 저장]
                    (텍스트만, 오디오 없음)
```

**저장되는 데이터**: 세션 텍스트 (IndexedDB, 클라이언트만)
**저장되지 않는 데이터**: 오디오 원본 (클라이언트·API 서버 모두)

---

## 7. 프로젝트 구조

별도의 백엔드 서버가 없으므로, Next.js 프로젝트 단일 구조로 구성한다.

```
whirr/
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx               # 녹음 화면 (메인)
│   │   ├── sessions/
│   │   │   └── page.tsx           # 세션 목록 화면
│   │   └── api/
│   │       └── stt/
│   │           └── token/
│   │               └── route.ts   # 임시 토큰 발급 API
│   │
│   ├── components/                # UI 컴포넌트
│   │   ├── recorder.tsx           # 녹음 버튼, 오디오 레벨 표시
│   │   ├── transcript-view.tsx    # 실시간 전사 텍스트 표시
│   │   └── session-list.tsx       # 세션 목록
│   │
│   ├── hooks/                     # React Hooks
│   │   ├── use-recorder.ts        # 마이크 캡처 + AudioWorklet
│   │   └── use-transcription.ts   # STT Provider 연결 + 상태 관리
│   │
│   ├── lib/
│   │   ├── stt/                   # STT Provider 추상화
│   │   │   ├── types.ts           # TranscriptionProvider 인터페이스
│   │   │   ├── assemblyai.ts      # AssemblyAI 구현체
│   │   │   └── index.ts           # Provider factory (환경 변수 기반)
│   │   ├── audio.ts               # AudioWorklet, getUserMedia 래퍼
│   │   └── db.ts                  # IndexedDB CRUD
│   │
│   └── types/                     # 공용 타입 정의
│
├── public/
│   └── audio-processor.js         # AudioWorklet processor (별도 파일 필수)
│
├── .env.local                     # ASSEMBLYAI_API_KEY (서버 전용)
├── next.config.ts
├── package.json
├── tsconfig.json
├── PRD.md
├── ARCHITECTURE.md
└── DECISIONS.md
```

---

## 8. 배포

| 대상            | 플랫폼     | 비고                        |
| --------------- | ---------- | --------------------------- |
| Next.js 앱 전체 | **Vercel** | 프론트엔드 + API Route 포함 |

### 환경 변수

| 변수명               | 위치                         | 설명              |
| -------------------- | ---------------------------- | ----------------- |
| `ASSEMBLYAI_API_KEY` | Vercel 환경 변수 (서버 전용) | AssemblyAI API 키 |

`NEXT_PUBLIC_` 접두사를 사용하지 **않는다** — API 키가 클라이언트 번들에 포함되는 것을 방지.

로컬 개발 시 저장소 루트의 `.env.example`을 참고해 `.env.local`을 만들고, 동일한 키 이름으로 값을 채운다.

### Vercel 연동 절차

1. GitHub에 리포지토리를 만들고 이 프로젝트를 push한다.
2. [Vercel](https://vercel.com) 대시보드에서 **Add New… → Project**로 해당 리포지토리를 Import한다.
3. Framework Preset은 **Next.js**로 자동 감지되면 그대로 둔다.
4. **Environment Variables**에 `ASSEMBLYAI_API_KEY`를 추가한다(Production / Preview 필요 시 동일하게).
5. **Deploy** 후 발급된 URL로 프로덕션·프리뷰 배포가 정상인지 확인한다.

별도 `vercel.json`은 필수 아니다. Next.js 단일 앱은 Vercel이 기본 빌드·라우팅을 처리한다.

---

## 9. 향후 자체 호스팅 전환 시 변경 범위

AssemblyAI에서 자체 호스팅(Whisper/faster-whisper 등)으로 전환할 경우:

| 변경 대상               | 작업                                                 |
| ----------------------- | ---------------------------------------------------- |
| `lib/stt/selfhosted.ts` | 새 Provider 구현체 추가 (자체 서버 WSS 연결)         |
| 별도 백엔드 서버        | FastAPI(Python) + WebSocket + faster-whisper 구축    |
| 배포                    | 백엔드는 Fly.io 등 GPU 지원 플랫폼에 배포            |
| 환경 변수               | `STT_PROVIDER=selfhosted`, `STT_SERVER_URL=...` 추가 |
| **UI 코드**             | **변경 없음**                                        |

Provider 추상화 덕분에 프론트엔드 코드 수정 없이 전환 가능하다.
