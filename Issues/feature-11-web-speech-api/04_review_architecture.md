---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "feature-11-web-speech-api"
  review_kind: architecture
---

# Architecture & Code Style Review

## Summary

Web Speech를 `TranscriptionProvider`로 구현하고 `tokenlessProvider` 분기를 둔 구조는 경계가 명확하고 계획·아키텍처 문서와 정합합니다. `tokenlessProvider`라는 일반 이름과 Web Speech 전용 에러 파이프라인(`WEB_SPEECH:`)의 불일치는 향후 다른 토큰 없는 공급자 추가 시 리팩터 압력이 될 수 있어 JSDoc 등으로 의도를 고정하는 것이 좋습니다.

## Architecture Assessment

- `web-speech.ts`의 `TranscriptionProvider` 구현, 팩토리 주입, `use-transcription` 분기는 계획과 일치.
- `settings-panel` → `@/lib/stt`의 `isWebSpeechApiSupported` 의존은 실용적; 엄격 분리 시 capability 모듈 분리 가능.
- `index.ts`에서 `WebSpeechProvider` 클래스 미노출은 테스트가 직접 `./web-speech`를 쓰면 충분.

## Code Style Findings

| Severity | 내용                                                         | 조치                                  |
| -------- | ------------------------------------------------------------ | ------------------------------------- |
| MEDIUM   | `tokenlessProvider` 에러 처리가 Web Speech 규약에 고정       | JSDoc으로 “현재 Web Speech 전용” 명시 |
| LOW      | `use-transcription`이 `@/lib/stt`와 `user-facing-error` 혼용 | 선택: 바럴 re-export로 통일           |

## Verdict

**조건부 통과** — 현재 제품 범위에는 구조가 충분하며, JSDoc으로 의도 고정 권장.
