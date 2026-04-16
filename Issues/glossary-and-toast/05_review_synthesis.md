---
issue_driven_dev:
  source: subagent
  phase: synthesis
  subagent_type: generalPurpose
  feature: "glossary-and-toast"
---

# glossary-and-toast — 리뷰 종합 (Synthesis)

## Overall Quality Score

**7.8 / 10** — 데이터 흐름·배선·회귀 테스트(전 스위트 그린)는 견고하나, **계획서 대비 테스트·문서 정합성**, **API 남용·프롬프트 합성에 대한 MEDIUM 권고**, **네비게이션·저장 I/O 일관성**에서 감점.

## Executive Summary

구현·보안·아키텍처 리뷰 모두 **PASS_WITH_NOTES**이며, blocking 수준의 결함이나 CRITICAL/HIGH 단언은 없습니다. 용어·세션 컨텍스트 → API → `buildSystemPromptWithContext` → 세션 `context` 영속 → 파이프라인 토스트까지 **의도한 경계 안에서 일관**합니다. 반면 (1) **계획 Step에 명시된 일부 테스트·파일 경로가 미이행**이거나 구현이 문서와 다르고, (2) **glossary 항목별 길이·총량 상한 부재**는 보안·성능 리뷰가 동일하게 지적한 남용·비용 리스크이며, (3) **`window.location.assign` vs `useRouter().push`**는 계획·ARCHITECTURE와의 축 불일치로 남습니다. 종합 판단은 **선택적 수정 후 머지 가능** 수준이며, 공개·비용 민감 API라면 glossary 상한은 머지 전 처리 권장입니다.

## Consolidated Findings

### CRITICAL

| ID  | 도메인 | 요약      | 근거                         |
| --- | ------ | --------- | ---------------------------- |
| —   | —      | 해당 없음 | 세 리뷰 모두 CRITICAL 미기재 |

### HIGH

| ID  | 도메인 | 요약      | 근거                     |
| --- | ------ | --------- | ------------------------ |
| —   | —      | 해당 없음 | 세 리뷰 모두 HIGH 미기재 |

### MEDIUM

| ID  | 도메인                 | 요약                                                                                              | 위치·메모                                                                                   |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| M1  | Implementation         | API route 테스트가 계획 대비 일부 누락 (`topic`/`keywords` 2000자 초과 400, context 전달 단언 등) | `src/app/api/meeting-minutes/__tests__/route.test.ts` vs `route.ts`의 `parseSessionContext` |
| M2  | Implementation         | Recorder에서 `SessionContextInput` 렌더·`isBusy` disabled 통합 검증이 계획 위치와 불일치·누락     | `recorder-batch.test.tsx` 계획 vs 실제 enqueue 검증 위주                                    |
| M3  | Security               | glossary **항목별·총량** 길이 상한 없음 → 페이로드·LLM 비용·지연 남용 여지                        | `route.ts` `parseGlossary`                                                                  |
| M4  | Security               | 용어·세션 컨텍스트가 시스템 프롬프트에 합성(간접 프롬프트 주입 표면)                              | `prompts.ts` + API 전달; 기능과 트레이드오프                                                |
| M5  | Security / Performance | (M3과 동일 루트) 프롬프트·토큰 부담                                                               | `parseGlossary` + `buildSystemPromptWithContext`                                            |
| M6  | Performance            | 설정 패널 용어 사전: 입력마다 `localStorage` + 상태 갱신                                          | `settings-panel.tsx`, `glossary/context.tsx`                                                |
| M7  | Architecture           | Toaster 검증 경로가 계획(`layout-toaster.test.tsx`)과 불일치                                      | `AppToaster` + `layout.tsx`는 합리적이나 문서·계획 산출물 불일치                            |
| M8  | Architecture           | 세션 이동이 `useRouter`가 아닌 `window.location.assign` → App Router 추상화 우회·문서와 불일치    | `pipeline-toast-notifier.tsx`                                                               |

_(M3/M5는 동일 대응: 항목당·합계 상한 + 400/413.)_

### LOW (요약 표)

| 테마        | 내용                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 테스트      | `layout-toaster.test.tsx` 미생성; PipelineToastNotifier “마운트 시점부터 done” 회귀 테스트 없음; `main-app-providers.test.tsx`가 `PipelineToastNotifier` 마운트를 직접 단언하지 않음 |
| 운영/로깅   | `console.error`에 예외 객체 전체 — 스택·내부 정보 노출 여지 (`route.ts`, `post-recording-pipeline/context.tsx`)                                                                      |
| 아키텍처    | `Session`이 `MeetingContext`에 직접 결합; 파서 관대함(`parseSessionContext`) 문서화 부재                                                                                             |
| 코드 스타일 | 토스트 테스트 Harness의 `isBusy` 규칙이 Provider와 불일치; Glossary vs Settings context 업데이트 스타일 차이                                                                         |
| 문서/계획   | 네비게이션 구현이 계획·이슈 초안과 다름 — 테스트는 현 구현에 맞춤                                                                                                                    |

## Cross-Domain Observations

1. **“계획서 정합성” vs “동작 적합성”**: 구현 리뷰는 기능·그린 테스트를 인정하면서도 **체크리스트 미이행**을 MEDIUM으로 잡고, 아키텍처 리뷰는 **파일 경로·내비 전략**까지 같은 꼬리로 묶습니다. 즉 품질 이슈의 상당 부분은 **산출물·문서 동기화** 문제입니다.

2. **보안 MEDIUM과 아키텍처가 같은 지점을 공유**: `buildSystemPromptWithContext`로 컨텍스트가 시스템 메시지에 들어가는 설계는 아키텍처상 자연스럽고, 보안 리뷰는 그 지점을 **남용·주입 표면**으로 읽습니다. 완화책(구조화·길이·필터)은 두 도메인 모두에 이익입니다.

3. **성능·보안 한 방**: glossary **항목 길이·총량 상한**은 보안 리뷰 M3와 성능 리뷰가 동일 제안으로 수렴합니다.

## Deduplicated Items

| 통합 키                   | 병합된 원본                             | 한 줄 조치                                           |
| ------------------------- | --------------------------------------- | ---------------------------------------------------- |
| Glossary limits           | Security M3, Performance(M5)            | 항목당·합계 상한 + 거절 코드                         |
| Plan/test gap — API       | Implementation M1                       | `topic`/`keywords` 초과 및 context 단언 추가         |
| Plan/test gap — UI/토스트 | Implementation(LOW×3) + Architecture M7 | 테스트 추가 **또는** 계획서 경로·범위 갱신           |
| Client navigation         | Implementation(LOW) + Architecture M8   | 문서·계획을 `assign`에 맞추거나 `router.push`로 통일 |
| localStorage churn        | Security Performance M6                 | debounce / onBlur / 저장 버튼                        |
| Prompt surface            | Security M4                             | 구분자·길이·(선택) 필터·로깅 정책                    |

## Conflicts Resolved

| 겉으로 상충                                   | 해소                                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| “테스트가 부족하다” vs “전체 테스트 그린”     | **기능 회귀는 낮고**, **계획 대비 테스트 완결성**이 별도 축의 부족으로 정리. 머지 게이트는 리뷰어 전원 non-blocking.                                         |
| “계획은 router” vs “코드는 `location.assign`” | 제품 결정이 아니면 **문서·계획을 구현에 맞추거나** 코드를 Next 패턴에 맞추는 **단일 방향**으로 정리; 리뷰 간 기술적 모순은 없음(둘 다 정합성 이슈로만 지적). |

## Final Verdict

**FIX_THEN_SHIP** (협의 가능 범위: 내부 전용·레이트리밋·비용 상한이 이미 강하면 **SHIP**으로 완화 가능)

- **권장 선행(짧게)**: glossary **항목·총량** 상한(M3/M5 단일 수정으로 보안·성능 동시 완화), API route에 계획된 **topic/keywords 초과** 테스트(M1).
- **병행 권장**: `location.assign` vs `router.push` 및 레이아웃 토스트 테스트 경로를 **계획 또는 코드 한쪽에 맞춤**(M7/M8).
- **후속 OK**: Recorder 통합 테스트(M2), 토스트 엣지·Harness 정확도·Session 타입 분리·로깅 축소 등은 **후속 PR**로 분리 가능하나, 팀이 “계획 완결”을 게이트로 쓰면 M2까지 포함하는 것이 좋습니다.

세 원본 리뷰의 개별 결론(**구현·보안·아키텍처 모두 PASS_WITH_NOTES**)과 정합되며, 종합 게이트는 **차단 결함 없음 + MEDIUM 몇 건은 머지 전·직후에 명시적으로 처리할 가치가 큼**으로 정리합니다.
