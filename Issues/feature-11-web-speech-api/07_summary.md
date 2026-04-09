# Feature 11: Web Speech API — 작업 요약

## 구현된 기능

- `WebSpeechProvider`가 `TranscriptionProvider`를 구현하고, `continuous`/`interimResults`, `onend` 자동 재시작(`queueMicrotask`로 유예), `stop`/`disconnect` 시 중단, `sendAudio` no-op을 제공한다.
- `isWebSpeechApiSupported`, `createWebSpeechProvider`, `mapSettingsLanguageToWebSpeechLang`를 `src/lib/stt`에서 export한다.
- Web Speech 오류 코드 → 한국어 UI 문구, `no-speech` 3초 디바운스.
- `useTranscription`의 `tokenlessProvider`로 토큰 없이 연결; `Recorder`는 `webSpeechApi` 모드에서 이 경로와 기존 `useRecorder` PCM 미터를 병행한다.
- 설정 패널에서 미지원 브라우저일 때 Web Speech 라디오 비활성화 및 안내; 힌트에 클라우드·이중 캡처 가능성 고지.
- 문서: `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/PRD.md` 갱신.

## 주요 기술적 결정

- 토큰 없는 STT는 `tokenlessProvider` 단일 옵션으로 처리하며, 에러는 `WEB_SPEECH:` 접두로 구분해 훅에서 사용자 문구로 매핑한다.
- TS `lib.dom`에 SpeechRecognition 타입이 없어 `src/types/speech-recognition.d.ts`로 최소 선언을 추가했다.
- 설정 패널의 지원 여부는 `useSyncExternalStore`로 조회해 eslint `set-state-in-effect`를 피한다.

## 테스트 커버리지

- `web-speech.test.ts`, `user-facing-web-speech.test.ts`, `use-transcription.test.tsx` 확장, `settings-panel-web-speech.test.tsx`, `recorder-settings.test.tsx` Web Speech 시나리오.

## 파일 변경 목록

- 신규: `src/lib/stt/web-speech.ts`, `src/types/speech-recognition.d.ts`, 위 테스트·이슈 산출물.
- 수정: `user-facing-error.ts`, `index.ts`, `use-transcription.ts`, `recorder.tsx`, `settings-panel.tsx`, `tsconfig.json`, `docs/*`, `Issues/STATUS.md`.

## 알려진 제한 사항

- Chrome 등에서 음성이 벤더 클라우드로 전송될 수 있음(설정 힌트·DECISIONS 참고).
- PCM 미터와 Web Speech가 별도 캡처 경로를 쓸 수 있음.
- `continuous` 모드에서 브라우저가 세션을 끊을 때마다 재시작하며, 장시간 녹음 시 재시작 횟수가 많아질 수 있음.

## 다음 단계 (해당 시)

- onend 재시작에 백오프·최대 횟수 등 운영 완화 검토.
- 단일 오디오 스트림으로 미터+인식 통합(이슈 방안 B)은 별도 스코프.
