---
issue_driven_dev:
  source: subagent
  phase: synthesis
  subagent_type: generalPurpose
  feature: session-detail-edit-modal
---

# Review Synthesis

## Overall Quality Score

**B** — 동작·보안 경계는 대체로 안정적이나, 저장 후 갱신 계약·테스트 커버리지·렌더링 비용·레이어 결합에서 정리할 과제가 누적되어 있다.

## Executive Summary

세 리뷰 모두 **PASS_WITH_NOTES**로, 플랜 방향(읽기 전용 상세·모달 편집·요약 파이프라인·beforeunload)에 대한 구현 충실도는 높습니다. 구현 리뷰가 지적한 **`onAfterPersist` 실패 시에도 모달이 닫히는** 흐름은 완료 조건과 어긋날 수 있었고, 플랜 대비 **모달/상세 통합 테스트 공백**이 큽니다. 보안 리뷰는 신규 치명 취약점 없이 로깅·확인 UI 등 **LOW** 이슈만 제시했고, 아키텍처 리뷰는 **영속 로직의 UI 파일 공존**과 **명명/동등성 비교 방식**이 유지보수·성능과 맞물린다고 본다.

## Consolidated Findings

### Immediate Fixes Required (CRITICAL/HIGH)

| #   | Finding                                                                                                | Source          | Severity | Category                  |
| --- | ------------------------------------------------------------------------------------------------------ | --------------- | -------- | ------------------------- |
| 1   | `onAfterPersist`가 실패(`false`)여도 모달이 닫혀, 저장/갱신 완료 UX와 플랜 완료 조건이 어긋날 수 있음  | impl            | HIGH     | correctness / UX 계약     |
| 2   | dirty·스냅샷 동등성에 `JSON.stringify`를 써 렌더마다 직렬화 비용이 누적될 수 있음(큰 용어집/템플릿 시) | security + arch | HIGH     | performance + readability |

#### 1. 저장 후 재조회 실패에도 모달이 닫힘

- **원본 심각도:** impl MEDIUM
- **조정 심각도:** HIGH
- **Location:** `src/components/session-edit-dialog.tsx` — `handleSave` 내 `onAfterPersist` 이후 처리
- **Action:** `onAfterPersist`가 `false`이면 모달 유지 + 갱신 실패 메시지 표시, 또는 부모에서 재조회 실패 시 reject하도록 계약을 단일화한다.

#### 2. `JSON.stringify` 기반 dirty/동등성 비교

- **원본 심각도:** security MEDIUM, arch LOW
- **조정 심각도:** HIGH (동일 코드 스멜을 성능·가독성 양쪽에서 지적)
- **Location:** `src/components/session-edit-dialog.tsx` (`snapshotsEqual`, 저장 버튼 `disabled` 등)
- **Action:** `useMemo` 기반 스냅샷/dirty 플래그, 또는 필드·배열 명시적 비교로 교체해 렌더당 직렬화를 제거한다.

### Recommended Improvements (MEDIUM)

| #   | Finding                                                   | Source | Category            |
| --- | --------------------------------------------------------- | ------ | ------------------- |
| 3   | `SessionEditDialog` 단위 테스트가 플랜 RED 대비 크게 부족 | impl   | 테스트 / 플랜 준수  |
| 4   | 영속 로직이 다이얼로그 UI 모듈에 공존                     | arch   | layering / coupling |
| 5   | `isDirty`처럼 보이는 이름이 실제로는 함수                 | arch   | naming              |

### Optional Enhancements (LOW)

- 브라우저 콘솔 원문 `console.error` 완화 — security
- `window.confirm` → 장기 인앱 확인 — security
- 복사 피드백 `setTimeout` 언마운트 정리 — security
- 아주 긴 스크립트 전체 `<pre>` 렌더 — security
- 상세가 `recorder-note-workspace`에서 탭 상수만 import — arch
- 모달 `max-w-3xl` / `z-[70]` vs 플랜 불일치 — arch
- `session-detail.tsx` import 그룹 순서 — arch
- 빈 `SessionContext` 리터럴 중복 — arch
- 상세 통합 테스트 보강(헤더, `mm-progress`, scriptMeta 등) — impl
- `session-detail-mm-before-unload`에서 모달 DOM 제거 단언 — impl

## Cross-Domain Observations

- `JSON.stringify` + 명명 패턴이 성능과 가독성을 동시에 건드린다.
- 플랜이 요구한 모달·상세 행동은 코드에 있으나 테스트가 따라오지 못한 영역이 넓다.
- IDB 갱신·스냅샷 조립이 UI 파일에 남아 있으면 수정이 같은 파일에 쌓이기 쉽다.

## Deduplicated Items

- JSON 직렬화 기반 dirty / `snapshotsEqual`: security와 architecture 지적을 항목 #2로 통합했다.

## Conflicts Resolved

- 저장 후 모달 닫힘 심각도: 구현 리뷰는 MEDIUM이었으나 플랜 정합성·사용자 오인 가능성을 반영해 HIGH로 올려 Immediate에 포함했다.

## Final Verdict

**FIX_THEN_SHIP**

### Rationale

치명 보안 회귀나 대규모 설계 붕괴는 없으나, `onAfterPersist` 실패 시 모달 처리와 `JSON.stringify` 렌더 비용은 출하 전에 다루는 것이 바람직하다. 모달·상세 테스트 보강과 구조 정리는 로드맵으로 둔다.
