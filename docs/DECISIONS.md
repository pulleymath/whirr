# Whirr — Technical Decisions

> 프로젝트의 기술 결정 사항과 그 근거를 기록한다.

---

## D1. STT 엔진 — AssemblyAI (외부 API)

**결정**: AssemblyAI Whisper Streaming 모델을 사용한다.

**검토한 선택지**:

| 선택지                               | 장점                                                              | 단점                                                                      |
| ------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 자체 호스팅 (Whisper/faster-whisper) | 비용 통제, 데이터 외부 유출 없음                                  | GPU 서버 운영 필요 (월 $30+), 스트리밍 전사 직접 구현, 인프라 복잡도 높음 |
| Deepgram                             | WebSocket 네이티브, 문서 우수                                     | $0.0077/분, 한국어 WER ~12.8%                                             |
| Google Cloud STT                     | 한국어 품질 최우수                                                | $0.016/분, gRPC 전용 (브라우저 직접 연결 불가), 구현 복잡                 |
| **AssemblyAI**                       | **$0.0025/분 (최저가)**, 무료 333시간, WebSocket 네이티브, JS SDK | 한국어는 Whisper 모델 경유                                                |

**근거**:

- 개인 프로젝트 기준 **비용이 가장 낮고** 무료 크레딧이 넉넉하다 (333시간)
- 브라우저에서 WebSocket으로 직접 연결 가능하여 별도 백엔드 서버가 필요 없다
- 추후 교체 가능하도록 Provider 추상화 계층을 두므로, 초기 선택의 lock-in 위험이 낮다

---

## D2. 프론트엔드 프레임워크 — Next.js (App Router)

**결정**: Next.js App Router를 사용한다.

**근거**:

- Vercel 배포와 최고의 호환성
- API Route를 통해 서버 로직(토큰 발급)을 별도 서버 없이 처리 가능
- App Router의 Server Components로 초기 로딩 최적화 가능
- TypeScript, 파일 기반 라우팅 등 DX 우수

---

## D3. 별도 백엔드 서버 — 없음

**결정**: Express, FastAPI 등의 별도 백엔드 서버를 두지 않는다.

**근거**:

- OpenAI Realtime Transcription이 브라우저 WebSocket(에피메랄 토큰)을 지원하므로, 백엔드가 오디오를 중계할 필요가 없다
- 서버가 필요한 유일한 작업(API 키 보호를 위한 임시 토큰 발급)은 Next.js API Route로 충분하다
- 운영할 인프라가 줄어들어 복잡도와 비용이 낮아진다

**향후 변경 가능성**: 자체 호스팅 STT로 전환 시 별도 백엔드 서버(FastAPI + GPU) 추가 필요. ARCHITECTURE.md §9 참조.

---

## D4. 배포 환경 — Vercel

**결정**: Next.js 앱 전체(프론트엔드 + API Route)를 Vercel에 배포한다.

**근거**:

- Next.js 공식 배포 플랫폼으로 zero-config 배포 가능
- API Route가 Serverless Function으로 자동 배포됨
- 무료 티어로 개인 프로젝트에 충분
- 별도 백엔드 서버가 없으므로 Vercel 단일 플랫폼으로 완결

---

## D5. 백엔드 언어 — 해당 없음 (별도 백엔드 없음)

**결정**: 초기 논의에서 Express(Node.js)를 검토했으나, D3의 결정에 따라 별도 백엔드 자체가 불필요하게 되었다.

**참고**: Python(FastAPI)이 STT 모델 생태계와의 호환성이 높다는 점은 확인됨. 향후 자체 호스팅 전환 시 FastAPI + faster-whisper 조합을 우선 검토한다.

---

## D6. STT Provider 추상화 도입

**결정**: 프론트엔드에 `TranscriptionProvider` 인터페이스를 두고, 구체적인 STT 서비스 구현은 이 인터페이스 뒤에 캡슐화한다.

**근거**:

- 사용자가 향후 모델 교체 또는 자체 서버 구축 가능성을 명시함
- Provider 교체 시 UI 코드 변경을 0으로 만들기 위함
- 환경 변수 하나로 Provider 전환 가능하도록 설계

---

## D7. STT 토큰 API — 인메모리 레이트 리밋

**결정**: `POST /api/stt/token`에 `x-forwarded-for` / `x-real-ip` 기준 클라이언트 키별 요청 횟수 제한을 둔다. 기본값은 10분(600_000ms) 창에 최대 60회이며, `STT_TOKEN_RATE_LIMIT_MAX`·`STT_TOKEN_RATE_LIMIT_WINDOW_MS`로 조정한다.

**근거**:

- 로그인 전 MVP에서도 무제한 토큰 발급으로 인한 과금·남용 위험을 줄이기 위함.
- 별도 Redis 없이 Next.js 단일 리포에서 동작하도록 한다.

**한계**: 서버리스/다중 인스턴스에서는 인스턴스마다 메모리가 분리되어 전역 한도가 아니다. 트래픽이 커지면 Edge Config·Redis·Vercel Firewall 등으로 이전하는 것이 바람직하다.

---

## D8. STT UI 오류 메시지 — 사용자용 문구 정규화

**결정**: 업스트림·WebSocket의 원문 오류는 UI에 직접 노출하지 않고 `userFacingSttError`로 고정 한국어 메시지에 매핑한다. AssemblyAI JSON의 `error` 필드는 내부 코드 `STT_PROVIDER_ERROR`로만 전달한다.

**근거**: 내부 구현 단서 노출 완화 및 일관된 UX.

---

## D9. 기본 STT 엔진 — OpenAI Realtime Transcription (`gpt-4o-mini-transcribe-2025-12-15`)

**결정**: 기본 실시간 전사는 OpenAI Realtime API transcription 모드로 수행한다. 전사 모델 ID는 **`gpt-4o-mini-transcribe-2025-12-15`** 를 사용한다. 서버는 `POST /v1/realtime/transcription_sessions`로 에피메랄 `client_secret`을 발급하고, 브라우저는 `wss://api.openai.com/v1/realtime?intent=transcription`에 서브프로토콜로 인증한다.

**근거**:

- AssemblyAI Whisper Streaming 경로가 안정적으로 동작하지 않아 교체가 필요했음 (Feature 6).
- OpenAI 측 `pcm16` 입력은 **24kHz** mono s16le이므로, 앱의 16kHz Worklet 출력은 Provider에서 리샘플링한다.
- `AssemblyAIRealtimeProvider`는 코드베이스에 유지하여 필요 시 훅 옵션으로 재사용 가능.

**한계**: 에피메랄 토큰 TTL이 짧다(약 1분). 장시간 녹음 시 토큰 재발급 전략이 필요할 수 있다.
