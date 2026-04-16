---
issue_driven_dev:
  source: subagent
  phase: synthesis
  subagent_type: generalPurpose
  feature: "feature-17-ui-recorder-session"
---

# Review Synthesis

## Overall Quality Score

**B** — 계획 대비 UI·아키텍처 방향은 정합하고 테스트 스위트는 통과했으나, 린트 경고·저장·파이프라인 오류 피드백 회귀 가능성·계획서 TDD 공백이 남아 “완료 조건 충족” 관점에서는 한 단계 부족하다.

## Executive Summary

구현·보안·아키텍처 리뷰 모두 **치명적 보안 결함이나 경계 위반은 없다**고 본다. `lucide-react`·공유 버튼·탭 제거·세션 상세 단순화는 `ARCHITECTURE.md`와 잘 맞고, 오디오 미리듣기·Object URL 제거는 메모리·성능에 유리하다. 반면 구현 리뷰가 지적한 **`persistError` 미노출·ESLint 미사용 변수 경고**는 사용자 피드백과 품질 게이트에 직결되며, 세 리뷰가 공통으로 **계획 Step 4·6·8 테스트 미이행**을 본다. 이후 코드베이스에 `recorder-pipeline-user-error` UI, `PostRecordingPipelineContext` 테스트 export, 추가 `recorder-ui` 테스트가 들어갔다면 **저장·파이프라인 오류 표면화·busy 문구 검증**은 일부 완화되었을 수 있으나, 본 합성은 제출된 세 문서를 주 근거로 한다.

## Consolidated Findings

### Immediate Fixes Required (CRITICAL/HIGH)

| #   | Finding                                      | Source                 | Severity | Category |
| --- | -------------------------------------------- | ---------------------- | -------- | -------- |
| —   | 세 리뷰에서 CRITICAL/HIGH로 합의된 항목 없음 | impl / security / arch | —        | —        |

구현 리뷰는 테스트 통과·“즉시 차단 수준 결함 없음”, 보안 리뷰는 고위험 취약점 없음, 아키텍처 리뷰는 “must fix”급 구조 결함 없음으로 정리했다. **다만** 린트·오류 UI 회귀는 아래 MEDIUM에서 **병합 전 처리(FIX_THEN_SHIP)**로 취급한다.

### Recommended Improvements (MEDIUM)

| #   | Finding                                                                                                                               | Source     | Category               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------- |
| 1   | `persistError`·`pipeline.errorMessage`가 홈 UI에서 끊긴 가능성(이전 `SummaryTabPanel` 경로); `persistError`만 설정·미표시로 린트 경고 | impl       | correctness / UX       |
| 2   | 계획 Step 4: `pipeline.isBusy`일 때 “이전 녹음을 처리 중” 등 파이프라인 잠금 UX 테스트 부재                                           | impl, arch | test / plan compliance |
| 3   | 계획 Step 6·8: 세션 상세 lucide·`cursor-pointer` 등 계획 문구와 테스트 단언 불일치                                                    | impl, arch | test / plan compliance |
| 4   | `IconButton`(`ariaLabel`) vs `Button`(`"aria-label"`) 접근성 prop 네이밍 불일치                                                       | arch       | code style / a11y API  |
| 5   | `RecordButton`이 계획의 크기·duration·border-radius 전용 트랜지션과 다름 — 의도면 문서 정합                                           | impl, arch | spec / docs            |

#### 1. 저장·파이프라인 오류 피드백 및 린트

- Original severity: impl — Important
- Adjusted severity: **MEDIUM** (다중 리뷰는 아니나 사용자 피드백·완료 조건 “린트 무경고”와 직결)
- Location: `src/components/recorder.tsx` (구현 리뷰 기준)
- Action: 오류를 홈 녹음 카드·`TranscriptView` 상단 등에 노출하거나, 미사용이면 상태·`setPersistError`를 제거해 동작과 린트를 일치시킨다. (후속으로 `recorder-pipeline-user-error` UI가 추가되었다면 해당 구현과 중복·누락 여부를 재확인한다.)

#### 2. Recorder 파이프라인 busy UX 테스트

- Original severity: impl Important, arch Important (should fix)
- Adjusted severity: **MEDIUM** (두 도메인에서 동일 — 계획 대비 공백)
- Location: `src/components/__tests__/recorder-ui.test.tsx`
- Action: `pipeline.isBusy` 시 노출 문구를 단언하는 테스트 추가(또는 계획서에서 항목 철회·근거 명시).

#### 3. 세션 상세 계획 대비 테스트

- Original severity: impl Important, arch Important
- Adjusted severity: **MEDIUM**
- Location: `src/components/__tests__/session-detail.test.tsx`
- Action: 계획 Step 6·8에 맞춘 단언 추가, 또는 “행위·aria 중심으로 대체”를 계획서에 반영.

#### 4. aria prop 네이밍 일관성

- Original severity: arch Important (should fix)
- Adjusted severity: **MEDIUM** (스타일만이면 상한 MEDIUM 유지)
- Location: `src/components/ui/icon-button.tsx`, `src/components/ui/button.tsx`
- Action: `ui/` 계층에서 `ariaLabel` 등 단일 관례로 통일.

#### 5. RecordButton 스펙 vs 구현

- Original severity: impl Suggestions, arch Suggestions
- Adjusted severity: **MEDIUM** (문서·제품 정합)
- Location: `src/components/record-button.tsx`, `Issues/.../01_plan.md`
- Action: 구현을 계획에 맞추거나 계획·이슈에 의도적 변경을 한 줄 명시.

### Optional Enhancements (LOW)

- **`iconClassName`**: 향후 비신뢰 입력 연결 시 클래스 주입 위험 — 현재는 정적 문자열; 허용 목록 또는 외부 입력 비사용 유지(security).
- **`lucide-react`**: 공급망·`npm audit`, named import 유지(security).
- **번들**: 프로덕션 chunk 분석으로 아이콘 import 누적 방지(security/perf).
- **`IconButton` “size variant”**: 계획 문구와 구현(`iconClassName`) 정리(impl/arch).
- **`VARIANT_CLASSES` 중복**: `ui/variants.ts` 등으로 통합 검토(arch).
- **`RecordButton` 배치**: `components/recorder/` 등 기능 폴더(arch).
- **`session-detail.tsx` lucide**: 액션별 분리·상수화(arch).
- **`MainTranscriptTabs` 테스트**: `className` 정규식 대신 `toHaveClass` 등 완화(arch).
- **`session-detail-audio.test.tsx`**: 라벨이 아이콘만 되면 `aria-label` 기반으로 전환(impl).

## Cross-Domain Observations

1. **“계획서 TDD 체크리스트 vs 실제 테스트”**가 구현·아키텍처에서 동일하게 반복된다. 기능은 컴포넌트·공유 스타일로 충족될 수 있으나, **검증 가능한 스펙 문서**와 테스트가 어긋난다.
2. **홈 레이아웃 단순화**는 성능·구조에 긍정이나, 제거된 패널이 담당하던 **오류·상태 메시지**를 다른 곳으로 옮기지 않으면 UX 회귀가 된다.
3. **보안·아키텍처**는 경계·의존성 추가를 문제 삼지 않았고, **구현 품질(린트·회귀·테스트 공백)**이 병합 결정의 주요 마찰이다.

## Deduplicated Items

| 통합 항목                            | 원본 출처                                                      |
| ------------------------------------ | -------------------------------------------------------------- |
| 파이프라인 busy 문구 미검증          | impl Plan Compliance / Findings, arch Architecture Findings #1 |
| 세션 상세 Step 6·8 테스트 갭         | impl Important #3, arch Architecture Findings #2               |
| RecordButton 스펙·애니메이션 불일치  | impl Suggestions #1, arch Suggestions #3                       |
| IconButton size variant 문서 vs 구현 | impl Suggestions #2, arch Suggestions #4                       |

## Conflicts Resolved

| 주제        | 상황                                                                          | 결론                                                                                                           |
| ----------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 병합 적합성 | 구현·보안은 PASS_WITH_NOTES, 아키텍처는 “조건부 승인·테스트 보완 시 approved” | 보수적으로 **FIX_THEN_SHIP**: 린트·오류 UI·계획 대비 최소 정합을 병합 전에 처리한다.                           |
| 치명도      | 구현 “Critical 없음” vs 사용자 피드백 회귀 우려                               | 보안이 CRITICAL을 올리지 않았으므로 **CRITICAL로 승격하지 않음**; 회귀·린트는 **MEDIUM + 병합 게이트**로 둔다. |

## Final Verdict

**FIX_THEN_SHIP**

### Rationale

보안·서버·데이터 경계 측면에서 **MAJOR_REVISION**은 필요하지 않다. 테스트는 통과하고 아키텍처 방향도 문서와 맞다. 그러나 **ESLint 완료 조건 위반 가능성**, **저장·파이프라인 오류의 UI 공백(또는 dead state)**, **계획에 명시된 테스트·문서 정합**이 남아 있어 그대로 SHIP하기엔 품질 게이트와 사용자 신뢰 측면에서 부족하다. 린트 정리·오류 표면화 확정·(선택적으로) 계획 Step 4·6·8 테스트 또는 계획서 갱신 후 병합하는 것이 적절하다. 후속 커밋에서 파이프라인 사용자 오류 UI·컨텍스트 export·추가 테스트가 이미 반영되었다면, 동일 문서를 기준으로 **재실행한 린트·테스트**로 FIX_THEN_SHIP 조건 충족 여부를 닫으면 된다.
