# Feature 2: 웹 오디오 녹음 및 마이크 캡처

## 1. 개요

브라우저의 `getUserMedia`와 `AudioWorklet`을 사용하여 마이크 오디오를 캡처하고, 이를 STT API로 전송하기 적합한 PCM 16kHz mono 형식으로 변환하는 기능을 구현합니다.

## 2. 상세 기획 (Detailed Plan)

- **마이크 권한 요청 및 스트림 캡처 로직**: `src/lib/audio.ts` 파일에 `getUserMedia`를 래핑하여 권한을 요청하고 오디오 스트림을 가져오는 함수를 작성합니다.
- **AudioWorkletProcessor 구현**: `public/audio-processor.js` (별도 파일 필수)에 오디오 데이터를 PCM 16-bit 16kHz mono로 변환하는 워클릿 프로세서를 구현합니다.
- **녹음 상태 관리 훅 구현**: `src/hooks/use-recorder.ts` 커스텀 훅을 작성하여 녹음 시작/중지 상태, 권한 에러 상태, 경과 시간 타이머 로직을 관리합니다.
- **녹음 제어 UI 컴포넌트 구현**: `src/components/recorder.tsx`
  - 녹음 시작/중지 버튼 UI
  - 경과 시간 표시 타이머
  - 오디오 레벨 시각화 (웨이브폼 또는 레벨 바) 컴포넌트 개발

## 3. 완료 조건 (Done Criteria)

- [ ] 사용자가 마이크 권한을 허용/거부할 수 있으며, 거부 시 적절한 에러 메시지가 표시된다.
- [ ] 녹음 시작 시 타이머가 작동하고, 마이크 입력에 따라 오디오 레벨이 시각적으로 변화한다.
- [ ] `AudioWorklet`을 통해 오디오 데이터가 정상적으로 PCM 청크로 변환되어 콜백으로 전달된다.
- [ ] 녹음 중지 버튼 클릭 시 마이크 캡처가 중단되고 타이머가 멈춘다.
