# Feature 9: 설정(Settings) 인프라 및 UI — 작업 요약

## 구현된 기능

- `TranscriptionSettings` 타입·기본값·`parseTranscriptionSettings`로 `localStorage` JSON 안전 병합.
- `SettingsProvider` / `useSettings`: 마운트 후 저장소 로드, `updateSettings` 시 영속화.
- `(main)/layout`에서 `MainAppProviders`(Settings + `RecordingActivityProvider`)로 전역 주입.
- `MainShell` 헤더 우측 설정(기어) 버튼, 녹음 중 비활성화, `SettingsPanel` 오버레이·다이얼로그.
- 패널: 전사 모드, 조건부 실시간 엔진·일괄 모델·언어(`auto`는 batch에서만).
- `Recorder`: `realtime`일 때만 `prepareStreaming` 후 녹음; `batch`/`webSpeechApi`는 안내 문구; `realtimeEngine`에 따라 OpenAI vs AssemblyAI `useTranscription` 옵션.

## 주요 기술적 결정

- 녹음 중 설정 변경 차단을 위해 `RecordingActivityProvider`로 `isRecording`을 `Recorder`→`MainShell`에 전달.
- SSR 요구에 맞춰 저장소 읽기는 `useEffect`에서만 수행(린트 예외 주석).
- 문서에 설정 저장 키·신뢰 경계·후속 피처(10/11) 연동을 명시.

## 테스트 커버리지

- `src/lib/settings/__tests__/types.test.ts`, `context.test.tsx`
- `src/components/__tests__/settings-panel.test.tsx`, `main-shell-settings.test.tsx`, `recorder-settings.test.tsx`
- 기존 홈·Recorder·MainShell 관련 테스트에 `MainAppProviders` 래핑 추가.

## 파일 변경 목록

- 신규: `src/lib/settings/*`, `src/lib/recording-activity/context.tsx`, `src/components/providers/main-app-providers.tsx`, `src/components/settings-panel.tsx`, 위 테스트 파일, `Issues/feature-9-settings-ui/*` 산출물.
- 수정: `main-shell.tsx`, `recorder.tsx`, `app/(main)/layout.tsx`, 다수 테스트·포맷 정리, `openai-realtime.ts` prompt, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `Issues/STATUS.md`.

## 알려진 제한 사항

- `language`·`batchModel`은 UI·저장만 하며 실시간 OpenAI 세션 필드와는 아직 연동하지 않음(Feature 10/11·후속).
- 설정 패널은 키보드 포커스 트랩 등 고급 모달 패턴은 미적용.

## 다음 단계 (해당 시)

- Feature 10: batch 전사 파이프라인 및 API 사용 시 `batchModel`/`language` 서버측 검증.
- Feature 11: Web Speech API 모드 구현.
- 선택: `webSpeechApi` 스텁 테스트, 설정 모달 a11y 강화.
