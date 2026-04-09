---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  feature: "feature-11-web-speech-api"
  review_kind: security
---

# Security & Performance Review

## Summary

서버·토큰 노출이나 XSS 직접 경로는 보이지 않으며, UI에는 대체로 정규화된 한국어 메시지가 쓰입니다. 다만 **Web Speech(특히 Chrome)의 벤더 클라우드 전송**, **PCM용 마이크와 Web Speech 내장 캡처의 이중 사용**은 프라이버시·성능 측면에서 사용자 고지가 중요합니다. `recognition.start()` 실패 시 인스턴스를 정리하지 않으면 핸들러·객체가 남을 수 있습니다.

## Security Findings

### [HIGH] Web Speech를 통한 제3자(브라우저 벤더) 음성 처리

- Location: `src/lib/stt/web-speech.ts`, `src/components/recorder.tsx` (webSpeechApi 분기)
- Risk: 오디오가 브라우저 구현(예: Chrome의 Google STT)으로 전송될 수 있음.
- Remediation: 설정 힌트/문서에 클라우드 전사 가능성 명시.

### [MEDIUM] 이중 마이크 캡처(PCM 미터링 + Web Speech)

- Location: `recorder.tsx` webSpeech 경로 + `useRecorder` PCM
- Remediation: 설정 설명에 짧게 고지.

### [MEDIUM] `recognition.start()` 예외 시 인스턴스 정리 누락 가능

- Location: `src/lib/stt/web-speech.ts` `connect` 내 `start()` try/catch
- Remediation: `catch`에서 핸들러 해제 및 `abort`/`stop` 후 참조 정리.

### [LOW] `console.error`에 원시 에러 로깅

- Location: `src/hooks/use-transcription.ts`

### [LOW] Web Speech 경로 `userFacingSttError` 폴백

- Remediation: 접두 없을 때도 안전한 폴백 유지.

## Performance Findings

### [HIGH] 장시간 세션에서 `onend` → `start()` 반복

- Location: `web-speech.ts` `onend`
- Suggestion: 재시작 간격·백오프는 후속 검토.

### [MEDIUM] PCM 스트림과 Web Speech 동시 사용

### [LOW] `tokenlessProvider` 참조 안정성 (Recorder는 `useMemo`로 완화)

### [LOW] 설정 패널 Web Speech 지원 여부 초기값 `true` → 깜빡임

## Verdict

**PASS_WITH_NOTES** — 문서화 및 `start()` 실패 시 정리 보강 권장.
