---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  subagent_model: "composer"
  feature: "feature-9-settings-ui"
  review_kind: security
---

# Security & Performance Review

## Summary

클라이언트 전용 설정·UI는 React 기본 이스케이프와 열거형 위주 입력으로 XSS 표면이 작고, STT 토큰·API 키는 서버에 유지됩니다. `batchModel`·`language`는 저장소 변조 시 임의 문자열이 될 수 있어 향후 API/URL에 넘길 때는 추가 검증이 필요합니다. 성능은 녹음 상태·설정 변경에 따른 리렌더와 설정 변경 시 `localStorage` 동기 기록 정도로 무난합니다.

## Security Findings

### [LOW] 저장소 변조로 허용되는 임의 `batchModel` / `language` 문자열

- Location: `src/lib/settings/types.ts` (`parseTranscriptionSettings` 내 `batchModel`, `language` 분기)
- Category: input-validation / data-handling
- Risk: `mode`·`realtimeEngine`은 화이트리스트인 반면, `batchModel`과 `language`는 비어 있지 않은 임의 문자열을 그대로 상태에 둡니다. 현재 diff 기준으로 Recorder는 `mode`·`realtimeEngine`만 사용하고, Settings UI는 `batchModel`을 `<select value>`에만 쓰며 `language`는 `ko`/`en`/`auto`와의 동등 비교뿐이라 **직접적인 DOM XSS는 낮음**입니다. 다만 이후 배치 전사·언어를 쿼리/본문에 넣을 때 검증·허용 목록 없이 쓰면 주입·오동작 위험이 커집니다.
- Remediation: API에 보내기 직전에 허용된 모델·언어 코드만 통과시키거나, 파서 단계에서 UI와 동일한 허용 집합으로 클램프합니다.

### [LOW] OpenAI 세션에 고정 `transcription.prompt` 전송

- Location: `src/lib/stt/openai-realtime.ts` (`openAiGaTranscriptionSession` → `prompt: OPENAI_REALTIME_TRANSCRIPTION_PROMPT`)
- Category: data-handling
- Risk: 사용자 입력이 아닌 **상수**이므로 주입 위험은 없습니다. 다만 제3자(OpenAI)로 정적 도메인 키워드가 전달되는 양이 늘어난 것이며, 제품 관점에서 “무엇을 외부에 보내는지”만 인지하면 됩니다.
- Remediation: 필요 시 프라이버시 문서/데이터 처리 설명에 반영; 기술적으로는 현 상태 유지 가능.

### [정보] localStorage 키 `whirr:transcription-settings`

- Location: `src/lib/settings/context.tsx` (`SETTINGS_STORAGE_KEY`)
- Category: data-handling
- Risk: 동일 출처의 다른 스크립트·XSS가 있으면 읽기/쓰기 가능(일반적인 localStorage 한계). 본 기능은 비밀값을 저장하지 않아 영향은 제한적입니다.
- Remediation: XSS 방어는 앱 전반 정책; 설정값에 민감정보를 넣지 않기.

## Performance Findings

### [LOW] 설정 변경마다 동기 `localStorage.setItem`

- Location: `src/lib/settings/context.tsx` (`updateSettings` 내부 `setSettings` 콜백)
- Category: storage
- Impact: 라디오/셀렉트 변경 한 번에 한 번 기록으로, 사용자 상호작용 빈도에서 부담은 작습니다. 다만 연속 토글 시 디스크 I/O가 누적될 수 있습니다.
- Suggestion: 문제가 되면 `requestIdleCallback`/`debounce`로 묶거나, 동일 값이면 쓰기 생략(얕은 비교)을 고려합니다.

### [정보] 컨텍스트 구독으로 인한 리렌더

- Location: `src/components/main-shell.tsx` (`useRecordingActivity`), `src/lib/recording-activity/context.tsx`, `src/lib/settings/context.tsx`
- Category: rendering
- Impact: `isRecording`·`settings` 변경 시 `MainShell`/`Recorder` 등 구독 컴포넌트가 갱신되는 것은 의도된 동작입니다. 현재 규모에서는 병목으로 보기 어렵습니다.
- Suggestion: 트리가 커지면 설정/녹음 상태를 분할 컨텍스트 또는 선택적 구독으로 나누는 방식을 검토합니다.

### [정보] Recorder의 `useMemo`로 엔진별 옵션 안정화

- Location: `src/components/recorder.tsx` (`transcriptionOptions`, `settings.realtimeEngine` 의존성)
- Category: rendering
- Impact: `useTranscription`에 불필요한 옵션 객체 재생성을 줄여 긍정적입니다.

## Verdict

**PASS_WITH_NOTES** — 치명적 보안·성능 결함은 없고, 저장소에서 온 자유 문자열 필드에 대한 향후 사용 시점의 검증만 미리 잡아 두면 좋습니다.
