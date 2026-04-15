---
issue_driven_dev:
  source: subagent
  phase: synthesis
  subagent_type: generalPurpose
  feature: "feature-15-post-recording-pipeline"
---

# Review synthesis — feature-15-post-recording-pipeline

## Overall Quality Score

**7.8 / 10** — 계획·신뢰 경계·테스트·빌드는 정합하나, 머지 전 운영·견고성·공개 API 관점에서 소수의 조치가 권장됩니다.

## Executive Summary

구현 리뷰는 `01_plan.md` 대비 기능·데이터 흐름이 일치하고 `npm test` / `tsc` / eslint / build 통과를 확인했습니다. 보안 리뷰는 비밀 노출·경계는 양호하나 `/api/summarize`에 입력 상한·남용 완화가 없다는 점을 지적했습니다. 아키텍처 리뷰는 유틸 분리·레이아웃 Provider·녹음 전용 내비 가드가 문서와 맞는다고 보았고, 파이프라인 Context의 응집도·문서 갱신을 제안했습니다.

**교차 검토에서 공통으로 떠오른 축**은 (1) 파이프라인 코어의 검증·구조화, (2) 배포 시 API 남용·비용 리스크, (3) PR에 실제로 올라가는 파일 범위입니다. 보안 CRITICAL은 없으므로 **MAJOR_REVISION_NEEDED**는 해당하지 않습니다. 보수적 기준으로 **FIX_THEN_SHIP**을 권합니다.

## Consolidated Findings

### Immediate fixes (CRITICAL / HIGH)

| ID  | 항목                                                                                                       | 출처           | 조치                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I1  | **피처 핵심 파일이 `git diff main`에 안 보이는 상태(`??`) 가능** — PR/리뷰에서 누락 위험                   | Implementation | 머지 전 `post-recording-pipeline/context.tsx`, `transcribe-segment.ts`, `use-before-unload.ts`, `/api/summarize`, 관련 테스트·이슈 문서 등 **전부 추적·커밋** 확인 |
| I2  | **`enqueue` 단일 in-flight 가드로 두 번째 호출이 조용히 무시** — 비정상 경로에서 저장·파이프라인 유실 가능 | Implementation | 큐 도입, 또는 “이미 처리 중” 사용자 피드백·명시적 거부/재시도 정책 중 하나로 **유실 방지**                                                                         |

_보안 리뷰에 CRITICAL 항목은 없음 — 유지._

### Recommended (MEDIUM)

| ID  | 항목                                                                                         | 출처            | 조치                                                                                         |
| --- | -------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| M1  | **`POST /api/summarize` 본문 길이·페이로드 상한 없음** — 공개·실제 LLM 연동 시 DoS/비용 남용 | Security        | `text` 길이 또는 UTF-8 바이트 상한, 초과 시 400/413; 가능하면 **레이트 리밋**·비용 상한 설계 |
| M2  | **Mock 요약 API 200ms 인위 지연** — 파이프라인 체감 지연                                     | Security (perf) | 프로덕션 경로에서 제거 또는 개발 전용 가드                                                   |
| M3  | **`PostRecordingPipelineProvider` 본체 통합 테스트 없음** — 회귀에 취약                      | Implementation  | DB·fetch 목킹 기반 소수 통합 테스트로 **enqueue → 전사 → updateSession → 요약** 검증         |
| M4  | **Provider 한 파일에 오케스트레이션·I/O·파싱·phase 혼재**                                    | Architecture    | `runPostRecordingPipeline(input, deps)` 등 **순수 모듈 분리** 검토로 테스트·재사용성 개선    |
| M5  | **`ARCHITECTURE.md`에 요약 프록시·세션 `status`/`summary` 미반영**                           | Architecture    | “녹음 후 파이프라인” 단락 추가                                                               |

### Optional (LOW)

- **파이프라인 `catch`에서 원시 `console.error`** — 로그에 PII·스택 과다 (Security)
- **`updateSession` 실패 메시지에 세션 ID** — UI 노출 시 불필요 식별자 (Security)
- **`phase === "done"` 직후에도 `isBusy` true** — 의도 UX면 유지, 아니면 정의 완화 (Implementation)
- **`useBeforeUnload`가 등록만 검증** — `preventDefault`/`returnValue` 스파이 보강 여지 (Implementation)
- **테스트 로그 노이즈** — 500/AbortError 출력 정리 (Implementation)
- **요약 응답 `unknown` 수동 가드** — API 타입·`parseSummarizeResponse` 공유 (Architecture)
- **`use-batch-transcription` 가독성** — 섹션·상수·헬퍼 (Architecture)
- **전체 전사 문자열 JSON 일괄 전송** — 상한과 정책 정합, 장기 청크/스트리밍 (Security)
- **IndexedDB `updateSession` 다회 호출** — 배치 가능 시 최적화 (Security)
- **배치 Blob 메모리** — 기존 한계, 별도 이슈 (Security)
- **mock 팩토리 `createMockPostRecordingPipeline()`** — 중복 증가 시 (Architecture)

## Cross-Domain Observations

1. **파이프라인 Context**가 구현(테스트 공백·enqueue 유실)·아키텍처(파일 비대)·보안(에러 로깅)에서 동시에 논의 대상입니다. 한 축으로 묶인 기술 부채입니다.
2. **`/api/summarize`**는 보안(상한·남용)·성능(mock 지연)·아키텍처(응답 스키마 공유)가 같은 엔드포인트에 모입니다. **서버 검증 + 클라이언트 파서 정리**를 같이 하면 효율적입니다.
3. **신뢰 경계**는 세 리뷰 모두 “클라이언트 IndexedDB + 동일 출처 API, 키 비노출”에 동의합니다. 이후 논쟁은 주로 **운영 노출 여부**(공개 배포 시 M1 필수)입니다.

## Deduplicated Items

- “파이프라인을 더 검증 가능하게” = Implementation의 **Provider 통합 테스트** + Architecture의 **I/O 분리** → 같은 목표, 레이어는 다름(테스트 vs 구조).
- “요약 경로 정리” = Security **본문 상한** + Architecture **타입/파서 공유** + (선택) **문서** → 한 번에 묶어 처리 가능.
- “Context/Provider 비대” = Implementation **enqueue 가드** 논의와 겹치지 않지만, **단일 파일 책임**은 Architecture 주도.

## Conflicts Resolved

| 주제                                 | 리뷰 간 견해                                                              | 합의                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `isBusy`가 `done` 직후에도 잠시 true | Implementation: 의도일 수 있음 / UX 완화 선택지                           | **제품 의도에 따름**; 코드 리뷰가 강제 변경을 요구하지 않음. LOW로 후속.              |
| Mock 요약 API의 존재                 | Security는 상한·남용을 “공개·LLM 시 필수”, 현재는 목                      | **현재 목 구현은 통과 가능**; **공개 배포 또는 LLM 연동 전 M1은 필수**로 보수적 정렬. |
| 머지 가능성                          | Implementation 조건부 / Security PASS_WITH_NOTES / Architecture 승인 가능 | 상충 아님 → **짧은 수정 후 머지(FIX_THEN_SHIP)** 로 수렴.                             |

## Final Verdict

**FIX_THEN_SHIP**

**근거:** 세 리뷰 모두 치명적 설계 파기나 보안 CRITICAL은 없고, 빌드·테스트는 통과했습니다. 다만 (1) **버전 관리에 피처 파일이 빠지면** 리뷰·릴리스 자체가 무의미해지므로 **I1은 머지 게이트**로 둡니다. (2) **`enqueue` 무음 드롭(I2)** 은 데이터 유실 가능성이 있어 **HIGH**로 취급하는 것이 보수적입니다. (3) 배포되는 앱에서 `/api/summarize`가 그대로 노출된다면 **M1(본문 상한 등)** 은 “나중에”가 아니라 **이번 머지 전 최소 완화**를 권합니다(보안 리뷰의 공개·LLM 전제와 정렬).

위 **I1·I2** 및 배포 전제 시 **M1**(및 가능하면 **M2**)을 반영한 뒤 머지하는 것을 권장합니다. **M3–M5**와 LOW 항목은 **머지 직후 스프린트**로 넘겨도 아키텍처·보안 리뷰의 “승인 가능 / PASS_WITH_NOTES” 판단과 모순되지 않습니다.
