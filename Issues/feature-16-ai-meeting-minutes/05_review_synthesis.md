---
issue_driven_dev:
  source: subagent
  phase: synthesis
  subagent_type: generalPurpose
  feature: "feature-16-ai-meeting-minutes"
---

# Review Synthesis

## Overall Quality Score

**B** — 도메인 분리·서버 전용 키·UI·API 골격은 양호하나, 공개 API의 인증·입력·동시성 경계가 비어 있고 계획 대비 통합 테스트·문서 정합성이 뒤처져 출시 전 보완이 필요합니다.

## Executive Summary

구현 리뷰는 기능과 계획이 대체로 맞지만 Step 5 파이프라인 통합 테스트와 chunk 문장 경계 검증이 빠져 TDD·계획 준수 측면에서 갭이 있습니다. 보안 리뷰는 키 비노출과 사용자-facing 오류 일반화는 긍정적으로 보았으나, 인증·레이트 리밋·입력/병렬 상한·모델 화이트리스트 부재를 프로덕션 리스크로 지적했습니다. 아키텍처 리뷰는 `docs/ARCHITECTURE.md`가 여전히 `/api/summarize`를 서술하는 등 문서–구현 불일치와 `fetch` 대 SDK 선택의 명시적 합의 필요성을 제기했습니다. 세 관점을 합치면 **코어 기능은 통과 수준이나, 보안·문서·핵심 테스트를 정리한 뒤 배포하는 것이 안전**합니다.

## Consolidated Findings

### Immediate Fixes Required (CRITICAL/HIGH)

| #   | Finding                                                                        | Source         | Severity | Category               |
| --- | ------------------------------------------------------------------------------ | -------------- | -------- | ---------------------- |
| 1   | 공개 `POST /api/meeting-minutes`에 인증·레이트 리밋 없음 → 키 남용·크레딧 소진 | security       | HIGH     | auth / abuse           |
| 2   | 입력 길이·청크 수·map 단계 병렬 호출 상한 없음 → DoS·비용·레이트리밋·부하      | security       | HIGH     | input-validation / DoS |
| 3   | Step 5: 파이프라인→`/api/meeting-minutes` 계약 미검증                          | implementation | HIGH     | testing                |
| 4   | `docs/ARCHITECTURE.md`가 녹음 후 파이프라인을 구 API `/api/summarize`로 기술   | architecture   | HIGH     | documentation          |

### Recommended Improvements (MEDIUM)

| #   | Finding                                               | Source                        | Category          |
| --- | ----------------------------------------------------- | ----------------------------- | ----------------- |
| 5   | `model` 파라미터 무검증                               | security                      | input-validation  |
| 6   | chunk-text: 문장 경계 분할 단언 부족                  | implementation                | testing           |
| 7   | map-reduce: map N·reduce 1회 호출 엄격 검증 부족      | implementation                | testing           |
| 8   | 계획서 `openai` SDK vs `fetch`, `allSettled` vs `all` | implementation + architecture | spec / dependency |
| 9   | 기본 모델 상수 이중 노출                              | architecture                  | coupling          |
| 10  | 요청 본문 전체 메모리 적재(명시적 상한)               | security                      | memory            |

### Optional Enhancements (LOW)

- 서버 로그 마스킹, mock 200ms 지연·스니펫, 프로덕 503 문서화, SummaryTabPanel 단언 보강, `TAB_SUMMARY` 주석, import 순서 등(세 리뷰 공통 LOW).

## Cross-Domain Observations

- **신뢰 경계**: “키는 서버에만”과 “누가 API를 호출하나”는 별 층의 문제.
- **길이 제한 제거**: 파이프라인에서 클라이언트 상한을 뺀 만큼 서버 측 상한·청크·동시성이 더 중요해짐.
- **문서 부채**: 계획 Step 5 테스트·`ARCHITECTURE.md`·SDK 표기가 동시에 어긋남.

## Deduplicated Items

- 무제한 병렬 map·입력 상한: 보안 “입력” + perf “병렬” → 단일 HIGH로 정리.
- `fetch` vs SDK / `Promise.all`: implementation + architecture → MEDIUM 항목으로 통합 언급.

## Conflicts Resolved

| Topic                 | Resolution                                                          |
| --------------------- | ------------------------------------------------------------------- |
| 클라이언트 길이 제거  | 보안·입력 검증 우선: 서버에서 상한·동시성 통제.                     |
| `all` vs `allSettled` | 구현 유지, 문서·계획 표기를 `Promise.all`에 맞추거나 주석으로 명시. |

## Final Verdict

**FIX_THEN_SHIP**

### Rationale

기능·모듈 구조는 수용 가능하나, 보안 HIGH(공개 POST·입력·병렬), 아키텍처 HIGH(ARCHITECTURE 불일치), 구현 HIGH(Step 5 통합 테스트)가 **선행 수정** 대상이다. 본 턴에서 상당 부분을 코드·문서·테스트로 반영한다.
