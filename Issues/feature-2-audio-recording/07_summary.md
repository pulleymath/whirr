# Feature 2: 웹 오디오 녹음 및 마이크 캡처 — 작업 요약

## 구현된 기능

- `public/audio-processor.js`: `AudioWorkletProcessor`로 다운믹스(mono)·16kHz 선형 보간 리샘플링·`Int16Array` PCM 청크 `postMessage`.
- `src/lib/audio.ts`: `getUserMedia`, `AudioContext`, `/audio-processor.js` 로드, `pcm-capture` 워클릿 노드, 무음 모니터링 게인, `AnalyserNode` 분기, `stop` 정리, `mapMediaErrorToMessage`.
- `src/hooks/use-recorder.ts`: 녹음 상태·경과 시간·레벨·에러, PCM 콜백 옵션, 중복 시작/취소 가드, 레벨 UI 스로틀.
- `src/components/recorder.tsx`: 시작/중지, `formatElapsed` 표시, 레벨 미터(`role="meter"`), 에러 `role="alert"`.
- `src/app/page.tsx`: `Recorder` 통합.

## 주요 기술적 결정

- Vitest는 Node 위주 + `happy-dom` + 파일 상단 `@vitest-environment happy-dom`으로 훅 테스트(jsdom은 Node 24+ ESM 이슈로 제외).
- 워클릿은 반드시 `public/` 단일 JS로 제공(ARCHITECTURE 준수).
- 리뷰 반영: `startingRef`/`cancelledRef`, 레벨 `setState` 스로틀·버퍼 재사용.

## 테스트 커버리지

- 구조·워클릿 문자열 계약, `mapMediaErrorToMessage`, `startPcmRecording` 성공/`addModule` 실패/`getUserMedia` 거부, `useRecorder` 상태·타이머·stop·에러·중복 start.

## 파일 변경 목록

- 추가: `public/audio-processor.js`, `src/lib/audio.ts`, `src/lib/audio.test.ts`, `src/hooks/use-recorder.ts`, `src/hooks/use-recorder.test.ts`, `src/components/recorder.tsx`, `src/__tests__/audio-processor.contract.test.ts`, `Issues/feature-2-audio-recording/*`
- 수정: `src/__tests__/structure.test.ts`, `src/app/page.tsx`, `Issues/STATUS.md`, `package.json`, `package-lock.json`

## 알려진 제한 사항

- `Recorder`는 아직 `onPcmChunk`를 상위에 노출하지 않음(Feature 3 STT 연동 시 연결).
- 워클릿 내부 버퍼 할당은 긴 녹음 시 GC 부담이 있을 수 있음(후속 최적화).
- React Strict Mode 개발 빌드에서 이펙트 이중 실행 시 짧은 중지/시작이 발생할 수 있음(프로덕션과 동일 동작은 아님).

## 다음 단계

- Feature 3: `useRecorder(onPcmChunk)`를 Provider와 연결해 실시간 STT로 PCM 스트리밍.
