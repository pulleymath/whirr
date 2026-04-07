# Feature 6: OpenAI GPT-4o Realtime API 기반 STT 전환

## 1. 개요

AssemblyAI 기반 실시간 STT(Feature 3)가 정상 동작하지 않아, OpenAI의 Realtime Transcription API(`gpt-4o-mini-transcribe-2025-12-15`)로 STT 엔진을 교체합니다. 기존 Provider 추상화 계층(`TranscriptionProvider` 인터페이스)을 활용하여 UI 코드 변경 없이 새 Provider를 추가하고 기본값으로 전환합니다.

### 배경

- AssemblyAI Whisper Streaming(`whisper-rt`) 모델이 안정적으로 동작하지 않음
- OpenAI Realtime Transcription API는 WebSocket 기반 실시간 스트리밍을 지원하며, 서버 측 VAD(음성 감지)와 노이즈 리덕션을 내장
- 기존 아키텍처의 Provider 추상화(D6) 덕분에 UI 코드 수정 없이 Provider 교체 가능

### 참고 자료

- [OpenAI Speech to Text 가이드](https://developers.openai.com/api/docs/guides/speech-to-text)
- [OpenAI 모델 목록](https://developers.openai.com/api/docs/models/all)

## 2. 상세 기획 (Detailed Plan)

### 2.1 OpenAI Realtime Transcription Provider 구현

**파일**: `src/lib/stt/openai-realtime.ts`

`OpenAIRealtimeProvider implements TranscriptionProvider` 클래스를 새로 구현한다.

- **WebSocket 연결**: `wss://api.openai.com/v1/realtime?intent=transcription`
  - 에피메랄 토큰(client_secret)으로 인증 (브라우저 WebSocket은 커스텀 헤더를 지원하지 않으므로 서브프로토콜 방식 사용)
- **세션 설정**: 연결 후 `transcription_session.update` 메시지 전송
  ```json
  {
    "type": "transcription_session.update",
    "input_audio_format": "pcm16",
    "input_audio_transcription": {
      "model": "gpt-4o-mini-transcribe-2025-12-15",
      "language": "ko"
    },
    "turn_detection": {
      "type": "server_vad",
      "threshold": 0.5,
      "prefix_padding_ms": 300,
      "silence_duration_ms": 500
    },
    "input_audio_noise_reduction": {
      "type": "near_field"
    }
  }
  ```
- **오디오 전송**: `input_audio_buffer.append` 메시지로 base64 인코딩된 PCM 데이터 전송
  ```json
  { "type": "input_audio_buffer.append", "audio": "<base64>" }
  ```
- **수신 이벤트 매핑**:
  | OpenAI 이벤트 | Provider 콜백 |
  |---|---|
  | `conversation.item.input_audio_transcription.delta` | `onPartial(text)` |
  | `conversation.item.input_audio_transcription.completed` | `onFinal(text)` |
  | `error` | `onError(error)` |
- **종료**: `input_audio_buffer.commit` 후 WebSocket 종료

### 2.2 토큰 API Route 변경

**파일**: `src/app/api/stt/token/route.ts`

기존 AssemblyAI 토큰 발급 로직을 OpenAI 에피메랄 토큰 발급으로 교체한다.

- **업스트림 엔드포인트**: `POST https://api.openai.com/v1/realtime/transcription_sessions`
- **인증**: `Authorization: Bearer {OPENAI_API_KEY}` 헤더
- **요청 바디**: 세션 설정(모델, 오디오 포맷 등)
- **응답 파싱**: `client_secret.value`를 추출하여 `{ "token": "..." }` 형태로 클라이언트에 반환
- 기존 레이트 리밋 로직은 그대로 유지

### 2.3 Provider 팩토리 및 연결 변경

**파일**: `src/lib/stt/index.ts`

- `createOpenAiRealtimeProvider(token: string): TranscriptionProvider` 팩토리 함수 추가
- 기본 Provider를 `OpenAIRealtimeProvider`로 변경
- AssemblyAI Provider 코드는 제거하지 않고 유지 (향후 환경변수 기반 전환 가능성)

**파일**: `src/hooks/use-transcription.ts`

- 기본 `createProvider`를 `createOpenAiRealtimeProvider`로 변경
- AssemblyAI 전용 PCM 프레이밍 제약(50–1000ms)은 OpenAI에 맞게 조정
  - OpenAI Realtime API는 서버 측 VAD를 사용하므로 클라이언트 측 프레임 크기 제약이 덜 엄격함
  - 프레이밍 로직을 Provider 내부로 이동하거나 범용적으로 리팩터링

### 2.4 환경 변수 변경

**파일**: `.env.example`, `.env.local`

| 변수명               | 용도                      | 비고                       |
| -------------------- | ------------------------- | -------------------------- |
| `OPENAI_API_KEY`     | OpenAI API 키 (서버 전용) | 신규 추가                  |
| `ASSEMBLYAI_API_KEY` | AssemblyAI API 키         | 주석 처리 (향후 제거 가능) |

### 2.5 테스트 업데이트

- `src/lib/stt/__tests__/openai-realtime.test.ts` 신규 작성: Provider 단위 테스트 (Mock WebSocket)
- `src/hooks/__tests__/use-transcription.test.tsx` 업데이트: OpenAI Provider 기반으로 변경
- 기존 AssemblyAI 테스트(`assemblyai.test.ts`)는 유지

### 2.6 문서 업데이트

- `docs/DECISIONS.md`: D9 항목 추가 — STT 엔진 변경 결정 및 사유
- `docs/ARCHITECTURE.md`: STT Provider 초기 구현 섹션을 OpenAI로 변경, 프로토콜 섹션 업데이트
- `docs/PRD.md`: AssemblyAI 언급을 OpenAI로 변경
- `Issues/STATUS.md`: Feature 6 항목 추가

## 3. 완료 조건 (Done Criteria)

- [ ] `OpenAIRealtimeProvider`가 `TranscriptionProvider` 인터페이스를 정확히 구현한다.
- [ ] 녹음 시작 시 `POST /api/stt/token`이 OpenAI 에피메랄 토큰을 정상 발급한다.
- [ ] 브라우저에서 OpenAI Realtime WebSocket(`wss://api.openai.com/v1/realtime?intent=transcription`)에 정상 연결된다.
- [ ] 녹음 중 음성이 실시간으로 전사되어 화면에 표시된다 (부분 결과 → 확정 결과).
- [ ] 한국어 음성이 정상적으로 전사된다.
- [ ] 녹음 중지 시 잔여 오디오가 처리되고 최종 텍스트가 확정된다.
- [ ] 기존 UI 컴포넌트(`recorder.tsx`, `transcript-view.tsx`)는 변경 없이 정상 동작한다.
- [ ] Provider 단위 테스트가 통과한다.
- [ ] `use-transcription` 훅 테스트가 통과한다.
