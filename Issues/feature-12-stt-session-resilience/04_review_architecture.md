---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "feature-12-stt-session-resilience"
  review_kind: architecture
---

# Architecture & Code Style Review

## Summary

STT 어댑터·훅·UI의 책임 분리는 `docs/ARCHITECTURE.md`의 “프로바이더는 알림, 토큰 경로는 훅에서 오케스트레이션” 방향과 잘 맞는다. 다만 프로바이더가 `user-facing-error` 모듈에 의존해 **프로토콜 신호와 사용자 문구 레이어가 한 파일에 섞였고**, 55분 상수·WS 목 테스트가 중복되어 유지보수 부담이 생긴다.

## Architecture Findings

### [MEDIUM] STT 어댑터 → `user-facing-error` 의존(레이어 혼합)

- Location: `src/lib/stt/openai-realtime.ts`, `src/lib/stt/assemblyai.ts` → `import … from "./user-facing-error"`
- Category: coupling / structure
- Description: 어댑터는 “UI 이벤트로 정규화” 계층인데, 세션 신호 상수(`SESSION_*`, `OPENAI_REALTIME_SESSION_MAX_DURATION_MESSAGE`)를 사용자 문구·`userFacingSttError`와 같은 모듈에서 가져온다. 신뢰 경계(브라우저 STT 채널) 자체는 유지되지만, **도메인 신호와 프레젠테이션 매핑의 경계가 흐려진다**.
- Suggestion: `stt/session-codes.ts`(또는 `stt/errors.ts`)처럼 **기계용 상수·분류만** 두고, `user-facing-error.ts`는 그 상수를 import해 문구로만 매핑하도록 분리한다.

### [MEDIUM] 55분 선제 간격의 이중 정의

- Location: `OPENAI_PROACTIVE_RENEWAL_AFTER_MS` in `src/lib/stt/openai-realtime.ts` vs `STREAMING_SESSION_SOFT_MS` in `src/components/recorder.tsx`
- Category: coupling / structure
- Description: 동일 정책(55분)이 프로바이더와 UI에 각각 하드코딩되어, 정책 변경 시 두 곳을 동기화해야 한다.
- Suggestion: `openai-realtime`에서 export한 상수(또는 공용 `stt/session-policy.ts`의 `STREAMING_SOFT_LIMIT_MS`)를 recorder가 import해 **단일 출처**로 맞춘다.

### [MEDIUM] `prepareStreaming` 내부의 큰 비동기 에러 핸들러

- Location: `src/hooks/use-transcription.ts` (`handleTokenPathError`가 `prepareStreaming` 콜백 안에 중첩 정의)
- Category: solid / readability
- Description: 재연결 루프·토큰 재발급·`disconnect`·`connect`가 한 블록에 묶여 `prepareStreaming`의 책임이 “초기 스트리밍 준비”를 넘어선다. ref 동기화(`fetchTokenRef` 등)는 타당하나, **읽기·테스트 단위 분리**가 어려워진다.
- Suggestion: 모듈 스코프 또는 `useCallback`으로 `handleTokenPathError`를 분리하고, `prepareStreaming`은 등록·호출만 담당하도록 정리한다(동작 동일, 구조만 슬림하게).

### [LOW] 플랜 대비 테스트 파일 배치 차이

- Location: `src/hooks/__tests__/use-batch-transcription.test.tsx` (플랜은 `use-batch-transcription-retry.test.ts` 신설)
- Category: structure
- Description: 기능은 한 훅에 모였으므로 **한 파일에 통합한 것은 합리적**이다. 다만 플랜의 “파일 변경 계획”과 이름이 달라 이후 이슈 추적 시 혼동 여지가 있다.
- Suggestion: 플랜/이슈 문서만 “실제 파일명”으로 맞추거나, `describe("retry …")` 블록으로 섹션을 명시해 의도를 드러낸다.

### [LOW] WebSocket 목 구현 중복

- Location: `src/lib/stt/__tests__/assemblyai-onclose.test.ts`, `src/lib/stt/__tests__/openai-realtime-reconnect.test.ts`
- Category: coupling / structure
- Description: `MockWebSocket` 패턴이 거의 동일하게 복제되어 있다(플랜에서도 복제 허용). 변경 시 두 파일을 같이 고쳐야 한다.
- Suggestion: 중복이 커지면 `src/lib/stt/__tests__/mock-websocket.ts` 등으로 **최소 공통 목**만 추출한다.

### [LOW] 플랜 Step 7 Recorder 전용 테스트 미반영(diff 기준)

- Location: `src/components/__tests__/recorder-*.test.tsx` (본 브랜치 diff에 추가·수정 없음)
- Category: structure
- Description: `01_plan.md`는 경과 시간·55분 문구·배치 «다시 시도»에 대한 recorder 레벨 테스트 확장을 명시한다. 구현은 `recorder.tsx`에 반영되어 있으나, **해당 레이어의 회귀 락**이 같은 diff에 없다.
- Suggestion: `recorder-stt-integration.test.tsx` 확장 또는 `recorder-session-resilience.test.tsx` 추가로 UI·훅 연결을 고정한다(아키텍처상 “경계별 테스트” 완결).

## Code Style Findings

### [MEDIUM] `reconnectToast` 명명 vs 실제 UI 패턴

- Location: `use-transcription.ts` (`reconnectToast`), `recorder.tsx` (`<p role="status">`)
- Category: naming / readability
- Description: 상태 이름은 “토스트”인데 렌더는 일반 문단이다. 동작(훅의 `setTimeout`으로 사라짐)은 토스트에 가깝지만, **이름과 컴포넌트 계층이 어긋난다**.
- Suggestion: `reconnectStatusMessage` 등으로 바꾸거나, 실제 토스트/라이브 리전 패턴으로 올린다.

### [LOW] `userFacingSttError`에 `SESSION_PROACTIVE_RENEW` 분기

- Location: `src/lib/stt/user-facing-error.ts`
- Category: typescript / readability
- Description: 선제 갱신은 토스트 경로(`userFacingSttReconnectToast`)가 주이고, 동일 코드가 `userFacingSttError`에도 들어가 **두 경로에서 문구가 겹칠 수 있다**. 의도적이면 괜찮으나, “영구 에러 vs 일시 안내” 구분이 타입/함수 수준에서 더 명확하면 읽기 쉽다.
- Suggestion: `SESSION_PROACTIVE_RENEW`는 토스트 전용으로만 노출할지 문서화하거나, `userFacingSttError`에서는 `default`로 흘리지 않도록 정책을 한 줄 주석으로 고정한다.

### [LOW] 배치 재시도 루프의 백오프 인덱싱

- Location: `src/hooks/use-batch-transcription.ts` (`runTranscribeWithRetries` 내 `attempt - 1` 및 fallback)
- Category: readability
- Description: `BATCH_TRANSCRIBE_RETRY_BACKOFF_MS` 길이와 시도 횟수가 맞물리는 방식은 동작상 안전해 보이나, 가독성은 `for (let attempt = 1; attempt <= MAX; attempt++)` + 명시적 `delays[attempt - 1]` 패턴이 더 직관적일 수 있다.
- Suggestion: 리팩터 시 루프를 단순화해 **시도 번호·지연 배열 매핑**을 한눈에 보이게 한다.

## Verdict

PASS_WITH_NOTES
