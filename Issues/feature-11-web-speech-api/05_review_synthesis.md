---
issue_driven_dev:
  source: subagent
  phase: synthesis
  subagent_type: generalPurpose
  feature: "feature-11-web-speech-api"
---

## Overall Quality Score

**B+** — 구현·구조는 통과 수준이나, 고지·테스트·예외 경로 정리 등 후속 조치가 남는다.

## Executive Summary

Web Speech 통합은 구현·아키텍처 관점에서 머지 가능한 수준이다. 다만 **벤더·클라우드 STT 가능성에 대한 사용자 고지**, **`resultIndex` 루프 자동화 테스트**, **`recognition.start()` 실패 시 리소스 정리**, **`onend` 재시작의 이벤트 루프 부담 완화(경량)** 가 권장된다. `tokenlessProvider`의 Web Speech 특화는 JSDoc으로 의도를 고정하는 것이 좋다.

## Consolidated Findings

### Immediate Fixes Required (CRITICAL/HIGH)

| #   | Finding                                           | Source         | Severity | Action                             |
| --- | ------------------------------------------------- | -------------- | -------- | ---------------------------------- |
| 1   | 벤더·클라우드 STT 가능성 고지 부족                | security       | HIGH     | 설정 힌트·문서에 짧게 명시         |
| 2   | `resultIndex`~`length` 루프 테스트 부재           | implementation | HIGH     | 단위 테스트 추가                   |
| 3   | `onend`→`start()` 즉시 재호출의 핫 루프·스택 부담 | security/perf  | HIGH     | `queueMicrotask` 등으로 한 틱 유예 |

### Recommended Improvements (MEDIUM)

| #   | Finding                                      | Action                             |
| --- | -------------------------------------------- | ---------------------------------- |
| 1   | 이중 마이크(PCM 미터 + Web Speech)           | 설정 힌트에 병행 캡처 가능성 언급  |
| 2   | `start()` 실패 시 recognition 정리 누락      | `catch`에서 핸들러 해제·abort/stop |
| 3   | `tokenlessProvider`가 Web Speech 규약에 묶임 | JSDoc으로 범위 명시                |

### Optional (LOW)

- `parseWebSpeechProviderError` 등 보조 함수 단위 테스트
- `recognitionFactory` throw 테스트

## Cross-Domain Observations

고지 문구 한 줄로 보안(전송 경로)·성능(이중 캡처) 이슈를 함께 완화할 수 있다.

## Deduplicated Items

듀얼 캡처 고지는 보안·성능 리뷰에서 동일 현상으로 중복 지적됨 → 설정 `hint` 통합 반영.

## Final Verdict

**SHIP_WITH_FOLLOWUPS** — 본 브랜치에서 HIGH 항목을 즉시 반영한 뒤 머지하는 것을 권장한다.
