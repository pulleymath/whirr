---
issue_driven_dev:
  source: subagent
  phase: synthesis
  subagent_type: generalPurpose
  feature: batch-retry-and-minutes-flow
---

# Review Synthesis

## Overall Quality Score

**B** — 단일 워커 큐, Recorder의 `persistBatchResult` 경로 재사용, `ARCHITECTURE.md`와의 신뢰 경계 정합성은 세 리뷰에서 공통으로 긍정됩니다. 다만 아키텍처 리뷰가 지적한 **`void runWorker()` 기반의 미처리 Promise rejection 가능성**은 신뢰성·옵저버빌리티 측면에서 즉시 다룰 가치가 있고, 구현·아키텍처 리뷰가 공통으로 본 **`recorder-batch.test.tsx` 등 Recorder 통합 테스트 공백**과 훅 단위 테스트의 계획 대비 미달은 “머지 전 보완”으로 묶입니다. 보안 리뷰는 치명적 취약점 없이 **PASS_WITH_NOTES**이므로 전체 품질은 **양호하나 출하 게이트 전 수정 권고** 수준으로 **B**에 둡니다.

## Executive Summary

배치 재시도·분 단위 흐름 변경은 **제품 방향과 아키텍처 경계에 대체로 부합**하며, 보안 리뷰도 **새로운 시크릿/XSS/인젝션 경로는 없다**고 판단했습니다. 반면 **(1) 워커를 `void`로 돌릴 때 하위 전사 경로의 throw가 미처리 rejection으로 새는 구조적 리스크**, **(2) 계획 Step 7·완료 조건에 맞는 Recorder 통합 테스트 및 훅 시나리오 테스트의 부족**은 구현 리뷰(**NEEDS_FIXES**)와 아키텍처 리뷰가 한목소리로 강조합니다. 성능·비용은 **무제한 재시도·큐 정렬·전체 transcript 재조합**이 스케일 시 부담이 될 수 있다는 **중·저위험 권고**로 정리됩니다. **합의 verdict: 머지 전 비동기 오류 전파와 테스트 공백을 메운 뒤 출하(FIX_THEN_SHIP)**가 타당합니다.

## Consolidated Findings

### Immediate Fixes Required (CRITICAL/HIGH)

| ID  | 영역            | 통합 우선순위 | 요약                                                                                                                                                                                                              | 근거 리뷰                                                                             |
| --- | --------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| F-1 | 아키텍처/신뢰성 | **CRITICAL**  | `enqueueIndices`가 `void runWorker()`로 워커를 시작하고, `runWorker`가 내부에서 **rethrow**할 경우 **미처리 Promise rejection** 가능. `awaitWorkerIdle`만으로는 상위에서 잡히지 않을 수 있음.                     | Architecture (Critical) — 구현 리뷰는 명시하지 않았으나 **보수적·구조 우선으로 승격** |
| F-2 | 구현/품질       | **HIGH**      | `01_plan` Step 7·완료 조건: **`recorder-batch.test.tsx`**에 재시도 성공 시 `saveSession`+`enqueuePipeline`, 실패 시 미호출, 배지·종료 후 컨트롤 등 **Recorder 통합 시나리오 테스트 부재**(diff에 파일 변경 없음). | Implementation + Architecture                                                         |
| F-3 | 구현/품질       | **HIGH**      | `use-batch-transcription.test.tsx`가 계획 표의 **순차 처리·회전 시 실패 우선 재시도·online 부정/정리·stop 이후 fetch 없음** 등을 충분히 봉인하지 못함. 구현은 의도에 가깝지만 **회귀 방지 레버가 약함**.          | Implementation (Important)                                                            |

**상세 bullet**

- **F-1 (CRITICAL)**: 워커 루프에서 예외를 **삼키고 상태로만 반영**하거나, **단일 “워커 완료” Promise를 추적해 `stopAndTranscribe` / `retryTranscription`이 그 결과를 await**하는 등, **throw가 글로벌 unhandled rejection으로 새지 않게** 상위와 연결해야 합니다(아키텍처 리뷰 권고를 **즉시 수정**으로 채택).
- **F-2 (HIGH)**: Recorder에 들어간 `persistBatchResult`, `handleBatchRetry`, `BatchRetryControl` 연동은 **통합 테스트 없이는 회귀 비용이 큼**; 계획서에 명시된 파일·시나리오를 기준으로 **최소 Step 7 시나리오**를 채웁니다.
- **F-3 (HIGH)**: 훅의 `toEnqueue` 정렬·`queueSetRef` 등은 리뷰에서 **구현 자체는 요구에 가깝다**고 보되, **테스트가 완료 조건 1·2·3을 증명하지 못함** — TDD 범위를 계획서와 정렬합니다.

### Recommended Improvements (MEDIUM)

| ID  | 영역      | 요약                                                                                                                                                                  | 근거                                                                                              |
| --- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| M-1 | 성능      | 의도적 **무제한 재시도**로 인한 지속 **CPU·네트워크·배터리** 부하; 관측(메트릭/알림) 또는 정책 허용 시 백오프·백그라운드 탭 완화 검토.                                | Security (Performance MEDIUM)                                                                     |
| M-2 | 문서/정합 | 계획 **Step 4**·이슈 문구와 달리 **마지막 세그먼트는 큐가 아닌 `finalBlob`** — 제품 모델이 타당하면 **계획/이슈 문서를 코드에 맞춤**.                                 | Implementation + Architecture                                                                     |
| M-3 | 문서/정합 | **`online` 리스너**: 계획은 `startRecording` 내부 등록 가정 vs 구현은 **`status === "recording"`용 `useEffect`**. 동작은 동등에 가깝으나 **문서·주석으로 의도 명시**. | Implementation + Architecture                                                                     |
| M-4 | 보안/운영 | **서버/API 쿼터·레이트 리밋·모니터링** 강화; 클라이언트만으로는 재시도 폭주 방지 한계(탭 단위).                                                                       | Security (LOW를 운영·비용으로 **MEDIUM 권고로 승격** — 다중 리뷰에서 “무제한 재시도”가 반복 언급) |

### Optional Enhancements (LOW)

- **`data-testid="batch-retry-button"`**: 계획과의 일관성; 현재는 `role`/`aria-label`로도 검증 가능(Implementation).
- **`enqueueIndices` 매 enqueue마다 큐 전체 `sort`**: 세그먼트 수·빈도가 커지면 **O(n log n)** 반복 — 삽입 시 정렬 유지 또는 정렬 생략 여부 검토(Security Performance).
- **`refreshTranscriptFromPartials` 전체 join**: 매 완료 **O(n)** — 증분 업데이트 또는 디바운스(Security Performance).
- **`handleBatchRetry`의 `console.error`**: 프로덕션에서 **일반 사용자 메시지 + 민감 필드 제거된 로깅**(Security).
- **`useBeforeUnload`에 `transcribing` 포함**: 데이터 손실 완화에는 유리하나 **긴 전사 중 이탈 확인 UX** 부담 — 필요 시 정책 조정(Security UX/LOW).
- **`BatchRetryControl` props**: 녹음 중 모드에서 미사용 props 다수 — **`mode`별 union**으로 결합도 감소(Architecture).
- **`00_issue.md` 계획 참조**: 저장소에 `01_plan.md`가 있으므로 **경로를 저장소 내부로**(Architecture).
- **코드 스타일**: `enqueueIndices`의 `const index = raw` 등 불필요 중간 변수 정리(Architecture).

## Cross-Domain Observations

- **“계획 준수 vs 실제 설계”**가 구현·아키텍처 양쪽에서 반복됩니다. **기능 결함이라기보다 문서·테스트 정합성**이 주된 갭이며, **코드가 의도적으로 다른 경우는 문서를 고치는 것**이 합의됩니다(마지막 세그먼트, `online` 등록 위치).
- **보안은 통과**이나 **재시도·STT 호출 빈도**는 **성능·비용·가용성(준-DoS)**으로 연결되어 **구현/운영 교차** 이슈입니다. 클라이언트 완화는 선택이나 **서버 한도·관측**은 권장합니다.
- **구현 리뷰가 놓친 비동기 rejection**은 **아키텍처·신뢰성** 영역이므로, 합성에서는 **단일 CRITICAL**로 올려 **머지 게이트**에 포함합니다.

## Deduplicated Items

| 통합 키                                     | 중복 출처                                         | 한 줄 정리                                                                                            |
| ------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Recorder 통합 테스트 공백                   | Implementation Important, Architecture Important  | `recorder-batch.test.tsx`(또는 동등)에 Step 7 시나리오 반영                                           |
| 훅 테스트 범위 부족                         | Implementation Important                          | 순차·회전·online 부정 등 계획 표 행 보강                                                              |
| 계획 vs `stopAndTranscribe` 마지막 세그먼트 | Implementation Suggestion, Architecture Important | 문서/계획을 **`finalBlob` 모델**에 맞춤                                                               |
| `online` 등록 방식 불일치                   | Implementation 부분 충족, Architecture Important  | 문서 또는 주석으로 **`useEffect([status])` 의도** 명시                                                |
| 무제한 재시도 부하                          | Security LOW(비용) + Security MEDIUM(성능)        | **하나의 “관측·정책·선택적 완화” 권고**로 병합                                                        |
| 긍정 공통점                                 | 세 리뷰                                           | 워커 큐+Set 중복 제거+정렬, Recorder 저장 경로 단일화, `online` 녹음 중 가드, 치명적 보안 취약점 없음 |

## Conflicts Resolved

| 충돌                                                         | 해결                                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verdict: NEEDS_FIXES vs PASS_WITH_NOTES (×2)**             | **보수적·교차 도메인**: 보안/아키텍처 “통과 메모”는 **취약점·경계** 관점이고, 구현 리뷰의 **테스트 미이행**과 아키텍처 **CRITICAL 비동기**는 **출하 게이트**에 걸립니다 → **`FIX_THEN_SHIP`**.                                           |
| **Implementation이 CRITICAL로 명시하지 않은 rejection 이슈** | **아키텍처가 구조·동시성을 주장** → **CRITICAL로 채택**(보안은 해당 없음, 보수적 합의).                                                                                                                                                  |
| **Security “LOW 재시도 폭주” vs “의도된 동작”**              | **보안 관점**: 클라이언트 단독으로는 막기 어렵다는 전제 유지. **완화 조치**는 제품 정책과 충돌 시 문서화만으로도 된다는 원문을 존중하되, **합성 우선순위**에서는 **MEDIUM 권고(관측·서버 한도)**로 정리해 **과잉 구현을 강제하지 않음**. |
| **계획 문구(마지막 큐잉) vs 코드**                           | **구현/아키텍처 일치**: 제품 모델이 타당하면 **문서 수정이 정답**(코드 변경 강제 아님).                                                                                                                                                  |

## Final Verdict

**FIX_THEN_SHIP**

### Rationale

치명적 보안 결함은 없으나, **미처리 Promise rejection 가능성(F-1)**은 런타임 안정성과 관측 가능한 장애로 직결됩니다. 또 **계획이 요구한 Recorder 통합 테스트와 훅 회귀 테스트(F-2, F-3)**가 부족하면 이번 변경의 핵심 가치(저장·파이프라인·재시도 연동)가 **리그레션에 노출**됩니다. 위를 반영하면 **SHIP은 이르고**, 수정 후 재검증 시 **SHIP**으로 상향 가능합니다. **MAJOR_REVISION_NEEDED**까지는 아님 — 설계 방향과 경계는 리뷰 전반이 **수긍 가능한 수준**입니다.
