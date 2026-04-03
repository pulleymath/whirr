# Feature 3: AssemblyAI 실시간 STT 연동

## 1. 개요

AssemblyAI WebSocket API를 연동하여 오디오 청크를 스트리밍하고, 실시간으로 전사된 텍스트를 화면에 표시합니다.

## 2. 상세 기획 (Detailed Plan)

- **임시 토큰 발급 API Route 구현**: `src/app/api/stt/token/route.ts`
  - 클라이언트에서 POST 요청 시 AssemblyAI의 `/v2/realtime/token` API를 호출하여 임시 토큰을 발급받아 반환합니다.
- **AssemblyAI Provider 구현**: `src/lib/stt/assemblyai.ts`
  - `TranscriptionProvider` 인터페이스를 구현합니다.
  - WebSocket 연결 (`wss://api.assemblyai.com/v2/realtime/ws?token={temp_token}`)
  - 오디오 청크 전송 (JSON `{"audio_data": "<base64>"}`)
  - `PartialTranscript`, `FinalTranscript`, `SessionTerminated` 이벤트 처리
- **STT 상태 관리 훅 구현**: `src/hooks/use-transcription.ts`
  - Provider 연결, 오디오 전송, 부분/최종 텍스트 상태 관리를 담당합니다.
- **실시간 전사 텍스트 UI 컴포넌트 구현**: `src/components/transcript-view.tsx`
  - 현재 발화 중인 문장의 중간 결과(`onPartial`)를 실시간으로 업데이트하여 표시합니다.
  - 확정된 문장(`onFinal`)을 누적 텍스트에 추가하여 렌더링합니다.

## 3. 완료 조건 (Done Criteria)

- [ ] API Route를 통해 AssemblyAI 임시 토큰이 정상적으로 발급된다.
- [ ] 녹음 중 오디오 청크가 WebSocket을 통해 전송되고, 부분 전사(Partial) 결과가 UI에 실시간으로 업데이트된다.
- [ ] 녹음 중지 시 최종 전사(Final) 결과가 확정되어 표시되며, WebSocket 연결이 정상적으로 종료된다.
- [ ] 에러 발생 시(예: 네트워크 단절, 토큰 만료) `onError` 콜백을 통해 UI에 에러 메시지가 표시된다.
