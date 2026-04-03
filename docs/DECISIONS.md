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

- AssemblyAI가 브라우저 직접 연결(WebSocket)을 지원하므로, 백엔드가 오디오를 중계할 필요가 없다
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
