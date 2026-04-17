---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "recorder-recording-phased-ui"
  review_kind: implementation
---

# Implementation & Test Review

## Summary

핵심 가시성·래핑·Vitest 전체 통과는 확인되었으나, 계획서에 적힌 TDD 케이스·Step 6 파일 수정이 일부 누락되었고 `showTranscript`가 계획의 “첫 스크립트” 범위를 넘어 전사 오류만 있을 때도 열리도록 확장되어 있습니다.

## Plan Compliance

| Plan Item                                                           | Status  | Notes                                                             |
| ------------------------------------------------------------------- | ------- | ----------------------------------------------------------------- |
| Step 1: idle에서 SessionContext·Transcript 숨김, RecordingCard 표시 | PASS    | `aria-hidden` + `reveal-*` 테스트로 검증                          |
| Step 2: 녹음 중 context 표시, 스크립트 없으면 transcript 숨김       | PASS    | 스트리밍·배치 각각 커버                                           |
| Step 3: 실시간 partial → transcript 표시                            | PASS    | partial 케이스만 테스트됨                                         |
| Step 3: finals만 있는 경우                                          | PARTIAL | 구현은 `transcriptFinals` 기준으로 충족 가능하나 전용 테스트 없음 |
| Step 3: WebSpeech 동일 규칙                                         | PARTIAL | 계획의 전용 시나리오 테스트 없음(동일 훅 경로에 의존)             |
| Step 4: 배치 빈/비빈 transcript                                     | PASS    |                                                                   |
| Step 4: `pipeline.displayTranscript` 경로                           | PARTIAL | 로직상 반영되나 전용 회귀 테스트 없음                             |
| Step 5: RevealSection·transition·aria                               | PARTIAL | 보이는 래퍼의 duration/ease만 검사                                |
| Step 6: `recorder-ui.test.tsx` 갱신                                 | PARTIAL | diff에 없음                                                       |
| 완료 조건 1 가시성(스크립트 없이 transcript)                        | PARTIAL | `transcriptError`만으로 `showTranscript`가 true가 될 수 있음      |
| 완료 조건 2·5·6                                                     | PASS    | 전체 테스트 통과, 배치/스트리밍 경로 일부 신규 테스트 존재        |

## Findings

### [MEDIUM] 계획 대비 `showTranscript` 조건 확장(오류만 있을 때 노출)

- Location: `src/components/recorder.tsx`
- Description: 계획의 `showTranscript = recordingActive && hasTranscript`와 달리, `hasTranscriptScript`가 false여도 `transcriptError`가 있으면 래퍼가 열립니다.
- Suggestion: 제품 의도가 오류 노출이면 계획·이슈 문서를 갱신하고 테스트로 명시. 의도가 아니면 `transcriptError` 항을 제거해 계획과 맞춥니다.

### [MEDIUM] 계획 Step 5·테스트 매트릭스 대비 테스트 공백

- Location: `src/components/__tests__/recorder-phased-ui.test.tsx`
- Description: `finals`만 존재, WebSpeech 모드, 배치 `displayTranscript` 전용 등이 빠져 있음.
- Suggestion: 계획 표의 케이스를 `it` 블록으로 추가.

### [LOW] `RevealSection` 숨김 클래스가 계획 문자열과 일부 불일치

- Location: `src/components/recorder.tsx`
- Description: 계획 예시와 구현 클래스 문자열이 1:1은 아님.
- Suggestion: 시각 QA 후 계획 또는 구현 중 하나에 맞춤.

## Test Coverage Assessment

`recorder-phased-ui.test.tsx`는 가시성을 실질적으로 검증합니다. 다만 계획 Step 3·4·5의 일부 RED 항목이 구현되지 않았습니다.

## Verdict

PASS_WITH_NOTES
