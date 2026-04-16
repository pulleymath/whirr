---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "feature-16-ai-meeting-minutes"
  review_kind: implementation
---

# Implementation & Test Review

## Summary

기능 구현(설정·청크·map-reduce·API·파이프라인·UI 레이블)은 계획서의 핵심 요구와 대체로 일치합니다. 다만 **Step 5 TDD에서 명시한 파이프라인 통합 테스트**(fetch URL·`model` body·장문 전사)가 diff 상 누락되어 있고, **chunk-text RED**에 있던 **문장 경계** 검증 테스트가 빠져 있어 테스트 품질·계획 준수 측면에서 보완이 필요합니다.

## Plan Compliance

| Plan Item                                             | Status                          | Notes                                                                                                                                                                                                                 |
| ----------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 1: `meetingMinutesModel` 타입·기본값·파싱·테스트 | PASS                            | `types.ts` + `types.test.ts`에 기본값·파싱·빈 문자열 폴백 반영                                                                                                                                                        |
| Step 2: `chunkText` + 청크/오버랩/빈 입력 테스트      | PARTIAL                         | 구현·일부 테스트 있음. 계획의 **문장 경계 분할** 단언 테스트 없음. 상수는 `constants.ts`로 분리(계획의 named export 의도와 유사)                                                                                      |
| Step 3: map-reduce + 프롬프트 분리 + DI               | PASS (부분 편차)                | `prompts.ts`, `completeChat` 주입, 단일/다중 청크·실패·빈 텍스트 테스트 있음. 계획은 `openai` 패키지·`Promise.allSettled`였으나 실제는 **fetch 기반**·`Promise.all`(기능상 실패 전파는 유사)                          |
| Step 4: `/api/meeting-minutes` + 검증·mock·모델       | PASS (확장)                     | 400·mock·모델 전달·기본 모델 테스트 있음. 계획에 없던 **프로덕션에서 키 없음 → 503** 추가                                                                                                                             |
| Step 5: 파이프라인 엔드포인트·body·길이 제한 제거     | PASS (구현) / **FAIL (테스트)** | `context.tsx`에서 `/api/meeting-minutes`·`model`·`SUMMARIZE_MAX_TEXT_LENGTH` 제거·에러 문구 반영. **`recorder-batch.test.tsx`에 fetch mock으로 URL/body/장문 검증 없음**(enqueue 인자에 `meetingMinutesModel`만 추가) |
| Step 6: 설정 UI 회의록 모델                           | PASS                            | 옵션·기본값·저장 테스트                                                                                                                                                                                               |
| Step 7: UI "요약"→"회의록" + 테스트                   | PARTIAL                         | 컴포넌트·탭·세션 상세 반영. `SummaryTabPanel` idle은 기존 정규식으로만 검증, 계획의 **idle·제목 "회의록"** 등 일부 케이스는 약함                                                                                      |
| 완료 조건: `npm test` / `tsc` / `eslint` / `build`    | N/A (증거 없음)                 | diff만으로는 통과 여부 확인 불가                                                                                                                                                                                      |
| 완료 조건: 12k+ map-reduce 동작                       | PASS                            | `map-reduce.test.ts`에서 긴 텍스트로 다중 청크 경로 검증                                                                                                                                                              |
| 완료 조건: `/api/summarize` 유지                      | PASS                            | 파이프라인에서 호출 제거, 라우트는 리포지토리에 잔존(별도 확인)                                                                                                                                                       |

## Findings

### [HIGH] Step 5 RED 테스트 누락 — fetch URL·`model`·장문 전사

- Location: `src/components/__tests__/recorder-batch.test.tsx` (계획 대비), `src/lib/post-recording-pipeline/context.tsx` (구현은 반영됨)
- Description: 계획 Step 5는 `recorder-batch.test.tsx`에 **fetch mock으로 `/api/meeting-minutes` 호출**, **body의 `model`**, **`SUMMARIZE_MAX_TEXT_LENGTH` 초과 텍스트도 요청 전달**을 검증하도록 되어 있습니다. 현재 diff는 `mockEnqueue`에 `meetingMinutesModel`이 포함되는지만 확인하며, **실제 파이프라인 Provider의 `fetch` 동작은 모킹/검증되지 않습니다.**
- Suggestion: `PostRecordingPipelineProvider`를 쓰는 통합 테스트를 추가하거나, `fetch`를 stub 한 뒤 파이프라인 한 사이클에서 URL·`JSON.parse(body)`의 `model`·장문 문자열을 단언합니다.

### [MEDIUM] chunk-text: 문장 경계 분할 RED 케이스 미구현

- Location: `src/lib/meeting-minutes/__tests__/chunk-text.test.ts`
- Description: 계획은 "문장 경계(마침표·물음표·느낌표·줄바꿈)에서 분할되어 문장 중간이 잘리지 않음"을 명시했으나, 테스트는 길이·오버랩 위주이고 **경계 보존**을 직접 검증하지 않습니다.
- Suggestion: 의도적으로 긴 문장 경계가 있는 입력을 넣고, 청크 경계 근처가 문장 끝에 가깝게 떨어지는지(또는 `findLastSentenceBreak` 동작)를 단언하는 케이스 추가.

### [MEDIUM] map-reduce 다중 청크 테스트가 호출 횟수를 엄격히 검증하지 않음

- Location: `src/lib/meeting-minutes/__tests__/map-reduce.test.ts`
- Description: 계획은 "map(N회) + reduce(1회) 호출 확인"인데, 테스트는 `completeChat` 호출 수가 `>= 3` 수준으로 느슨하고, mock이 메시지 내용에 따라 분기합니다.
- Suggestion: 청크 개수를 알 수 있는 고정 입력으로 `map` 호출 횟수 = 청크 수, `reduce` = 1회를 `toHaveBeenCalledTimes` 또는 호출 순서로 검증.

### [LOW] 계획과 구현 세부 불일치 (기능 영향 작음)

- Location: `src/lib/meeting-minutes/map-reduce.ts`
- Description: 계획 문구는 `Promise.allSettled`와 `openai` npm 패키지 사용이었으나, 구현은 `Promise.all`과 **직접 `fetch`**. 단일 청크 실패 시 전체 실패라는 목적은 대체로 동일합니다.
- Suggestion: 계획서를 현재 구현에 맞게 갱신하거나, 의도한 `allSettled`(모든 청크 완료 후 실패 집계)가 필요하면 로직 조정.

### [LOW] SummaryTabPanel idle/complete에서 "회의록" 노출 단언 부족

- Location: `src/components/__tests__/summary-tab-panel.test.tsx`
- Description: UI는 "회의록"으로 바뀌었으나, idle 테스트는 여전히 `/녹음을 시작하면 전사가 쌓이고/`만 매칭하고 **"회의록" 문자열·complete 시 제목 "회의록"**을 계획 수준으로 단언하지 않습니다.
- Suggestion: `getByText(/회의록/)` 또는 역할/레이블로 제목·안내 문구를 추가 단언.

## Test Coverage Assessment

- **강점**: 설정 파싱, API 라우트(400·mock·모델·기본 모델), map-reduce 핵심 경로, 설정 패널·탭 레이블 일부가 테스트로 고정됨.
- **약점**: **파이프라인→`/api/meeting-minutes` 계약**이 계획서 Step 5와 불일치(테스트 부재). chunk **문장 경계**·SummaryTabPanel **레이블 전면** 검증이 계획 대비 약함. CI 완료 조건(`npm test`, `tsc`, `eslint`, `build`)은 본 리뷰에서 실행 증거 없음.

## Verdict

**PASS_WITH_NOTES** — 구현은 기능 범위에 가깝게 맞으나, **Step 5 통합 테스트와 chunk-text 문장 경계 테스트**가 계획서 TDD·완료 기준에 비해 미흡하여 메모와 함께 보완을 권장합니다.
