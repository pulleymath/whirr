---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "fix-audio-segment-save"
  review_kind: implementation
---

## Summary

`recorder.tsx` 배치 정지 경로에서 `getFullAudioBlob()`로 만든 단일 Blob을 우선 저장하던 분기가 제거되고, `stopBatchTranscribe()`가 돌려준 `segments`만 `saveSessionAudio`에 넘기도록 바뀌어 계획의 핵심 동작과 일치합니다. 세션 상세 다운로드는 새 테스트로 “세그먼트 배열 전체가 `downloadRecordingSegments`에 그대로 전달된다”는 점이 의미 있게 고정됩니다. 다만 계획 **완료 조건** 중 “5분 초과·다회 회전 시 저장 세그먼트 개수”를 직접 검증하는 테스트는 이번 diff에 없어, 완료 조건을 테스트 관점에서만 보면 일부 미충족에 가깝습니다.

## Plan Compliance

| 계획 항목                                                                                  | 상태      | 비고                                                                                                        |
| ------------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------- |
| 배치 정지 시 합본 Blob만 IndexedDB에 저장하던 동작 제거                                    | 충족      | `getFullAudioBlob` 호출 및 `[fullAudio]` 대체 로직 제거됨                                                   |
| `stopBatchTranscribe`의 `segments`를 그대로 `saveSessionAudio`에 저장                      | 충족      | `segments.length > 0`일 때 `saveSessionAudio(id, segments)`                                                 |
| 세션 상세 다운로드 시 세그먼트 전체가 `downloadRecordingSegments`에 전달됨을 테스트로 고정 | 충족      | 두 개 Blob으로 클릭 후 호출 인자 검증                                                                       |
| 완료 조건: 5분 초과 시 세그먼트 수 = 회전 횟수 + 마지막 구간, 합본 1개로 덮어쓰지 않음     | 부분      | 구현은 세그먼트 배열 저장으로 목적에 부합하나, **다회 회전·복수 세그먼트 저장 개수**를 단언하는 테스트 없음 |
| 관련 단위 테스트 통과                                                                      | 검증 필요 | 변경 테스트는 논리상 일관됨                                                                                 |

## Findings

### [HIGH] 완료 조건(다회 회전 후 세그먼트 개수)에 대한 테스트 부재

- Location: `src/components/__tests__/recorder-batch.test.tsx`
- Description: 정지 시 `saveSessionAudio`에 넘긴 배열 길이가 1이고 첫 Blob만 검증한다. `getFullAudioBlob` mock이 `"combined-full"`을 반환해도 저장 내용이 합본이 아님을 간접적으로 막아 주어 단일 구간·합본 오동작 회귀에는 유효하나, **2개 이상 세그먼트** 시나리오 검증이 없다.
- Suggestion: 회전이 여러 번 발생한 뒤 `saveSessionAudio` 두 번째 인자 `length`와 각 구간 식별을 검증하는 케이스 추가.

### [LOW] `getFullAudioBlob` mock

- Location: `src/components/__tests__/recorder-batch.test.tsx`
- Description: 구현에서 더 이상 호출되지 않으면 불필요한 노이즈.
- Suggestion: 제거하거나 실제 호출 계약이 있는 테스트로 이동.

## Test Coverage Assessment

- 배치: Blob `.text()`로 저장 내용이 `"final-segment"`인지 확인해 세그먼트 경로를 실질적으로 검증함.
- 상세: 두 세그먼트 배열 참조 동일성까지 `toHaveBeenCalledWith`로 검증해 의도가 분명함.
- `getFullAudioBlob`는 현재 구현과 무관한 모킹으로 약간 과함.

## Verdict

**PASS_WITH_NOTES** — 구현은 계획된 저장 경로 수정과 일치하고, 세션 상세 다운로드 테스트는 계획한 “전체 세그먼트 전달”을 잘 고정합니다. 다회 회전 후 `saveSessionAudio` 세그먼트 개수·식별 검증 테스트 추가를 권장합니다.
