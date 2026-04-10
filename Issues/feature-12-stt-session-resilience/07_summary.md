# Feature 12: STT 세션 장시간 사용 시 안정성 개선 — 작업 요약

## 구현된 기능

- **OpenAI Realtime**: 연결 후 약 55분 선제 `stop` 경로 및 `SESSION_PROACTIVE_RENEW`로 훅 재연결을 유도. 비정상 `onclose` 시 `SESSION_EXPIRED_OR_DISCONNECTED` 보고.
- **AssemblyAI**: 사용자/클라이언트 주도 종료가 아닌 `onclose`에서 동일 비정상 신호 보고. `onerror` 후 이중 `onError` 방지.
- **`useTranscription`**: 복구 가능 메시지에 한해 최대 3회 재연결, `finals` 유지, `reconnectToast` 안내.
- **사용자 문구**: 세션 만료·끊김·한도 초과·선제 갱신에 대한 한국어 매핑 및 토스트용 짧은 문구.
- **Web Speech**: `start()` 실패 시 `onError`, 연속 실패 3회 중단, 포그라운드 복귀 재시도 1회.
- **배치 전사**: 실패 시 Blob 유지, 5xx/네트워크에 2·4초 백오프 자동 재시도(총 3회 시도), «다시 시도» 버튼.
- **Recorder**: 실시간 모드 경과 시간·55분 안내·재연결 안내·배치 재시도 UI.
- **문서**: `DECISIONS.md`, `ARCHITECTURE.md`, `TROUBLESHOOTING.md`에 복원력 정책 반영.

## 주요 기술적 결정

- 토큰 재발급은 훅에만 두고, 프로바이더는 상수 메시지로 재연결 트리거를 올린다.
- 재연결 시도 카운터는 `prepareStreaming` 시작 시에만 초기화하고, 연결 성공 시에는 리셋하지 않아 «한 녹음 세션당 최대 3회 시도»에 가깝게 동작한다.
- 배치 Blob은 새 녹음 시작·전사 성공 시에만 해제한다.

## 테스트 커버리지

- `user-facing-error-session`, `assemblyai-onclose`, `openai-realtime-reconnect`, `web-speech-restart-failure`, `use-transcription`(재연결·토스트), `use-batch-transcription`(5xx·4xx·reject·retry), `recorder-session-resilience` 등.

## 파일 변경 목록

- STT: `openai-realtime.ts`, `assemblyai.ts`, `web-speech.ts`, `user-facing-error.ts` 및 대응 `__tests__`
- 훅: `use-transcription.ts`, `use-batch-transcription.ts` 및 테스트
- UI: `recorder.tsx`, `recorder-session-resilience.test.tsx`
- 이슈·리뷰 산출물: `Issues/feature-12-stt-session-resilience/*`, `Issues/STATUS.md`
- 문서: `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/TROUBLESHOOTING.md`

## 알려진 제한 사항

- AssemblyAI에 OpenAI와 동일한 55분 선제 타이머는 두지 않았다(비정상 종료·서버 에러·훅 재연결에 의존).
- 프로덕션 콘솔 로깅·토큰 오류 문자열 하드닝은 후속 작업으로 남길 수 있다.

## 다음 단계 (해당 시)

- `stt/session-codes.ts`로 프로바이더·문구 레이어 분리 리팩터링.
- `handleTokenPathError` 분리로 `use-transcription` 가독성 개선.
