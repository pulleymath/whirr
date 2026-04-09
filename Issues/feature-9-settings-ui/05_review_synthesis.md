---
issue_driven_dev:
  source: subagent
  phase: synthesis
  subagent_type: generalPurpose
  subagent_model: "claude-opus-4"
  feature: "feature-9-settings-ui"
---

# Review Synthesis

## Overall Quality Score

**8.2 / 10** — 기능·테스트·경계 설계는 출시 수준이나, 문서 동기화와 설정값 검증·접근성은 후속 작업으로 정리하는 것이 안전합니다.

## Executive Summary

세 리뷰 모두 **치명적 차단 이슈는 없습니다**. 구현 리뷰는 Settings 타입/파싱, `SettingsProvider`·localStorage, `SettingsPanel`, `MainShell` 기어, Recorder 분기, `RecordingActivity`, `MainAppProviders`까지 계획 대비 구현이 완료되었고 **148/148 테스트 통과**로 회귀 신뢰도가 높습니다. 보안은 **localStorage에서 읽는 임의 문자열**(batchModel, language 등)이 이후 API/백엔드에서 그대로 쓰일 때를 대비한 **검증·화이트리스트**만 보완하면 됩니다. 아키텍처는 **RSC 경계·`lib/settings` 응집도**가 양호하며, `RecordingActivity`를 `lib`에 둔 선택은 **문서에 근거를 남기면** 수용 가능합니다.

공통으로 **DECISIONS.md·ARCHITECTURE.md·STATUS/체크리스트 갱신**이 빠져 있어, “코드는 머지 가능하나 제품/온보딩 관점에서는 미완” 상태입니다. 최종 권고는 **APPROVE_WITH_FOLLOW_UPS**입니다.

## Consolidated Findings

### 구현 (Implementation)

| ID  | 심각도          | 요약                                          | 권장 조치                                        |
| --- | --------------- | --------------------------------------------- | ------------------------------------------------ |
| I1  | Medium          | `docs/DECISIONS.md`, `ARCHITECTURE.md` 미반영 | 설정·프로바이더·Recorder 분기 결정을 문서에 반영 |
| I2  | Low             | 이슈 STATUS/체크리스트 미갱신                 | 머지 전·직후 이슈 폴더 상태 정리                 |
| I3  | Low (선택)      | webSpeechApi 대칭/통합 테스트 부재            | 회귀 방지용 최소 테스트 추가 검토                |
| I4  | Low (기능 공백) | language가 STT에 아직 미연동                  | 후속 이슈로 명시하거나 연동 범위 문서화          |

### 보안 (Security)

| ID  | 심각도 | 요약                                              | 권장 조치                                         |
| --- | ------ | ------------------------------------------------- | ------------------------------------------------- |
| S1  | Low    | localStorage의 batchModel/language 등 임의 문자열 | API/토큰 경로에서 사용 직전 스키마·허용 목록 검증 |
| S2  | 정보   | OpenAI 프롬프트 상수 사용                         | 현재 판단 유지 (특이 이슈 없음)                   |
| S3  | 정보   | localStorage 기반 XSS는 앱 전반 관심사            | CSP/출력 이스케이프 등 기존 전략과 정렬           |

### 아키텍처 (Architecture)

| ID  | 심각도     | 요약                                 | 권장 조치                                |
| --- | ---------- | ------------------------------------ | ---------------------------------------- |
| A1  | Medium     | 코드·문서 불일치 (설계 기록 부재)    | I1과 동일: 아키텍처·결정 문서 동기화     |
| A2  | Low (선택) | 설정 다이얼로그 포커스 트랩 / Escape | 모달 패턴에 맞춰 키보드·포커스 처리 검토 |
| A3  | Low (선택) | 설정 버튼 `aria-disabled`            | 비활성 상태일 때 스크린리더 일관성 개선  |

## Cross-Domain Observations

1. **문서 동기화**는 구현(I1)과 아키텍처(A1)에서 동일하게 “중요”로 겹칩니다.
2. **설정값 신뢰 경계**: 보안(S1)의 “localStorage 임의 문자열”과 구현(I4)의 “language 미연동”은 합쳐서 보면, **클라이언트 설정 → 서버/API** 경로가 생길 때 **한 곳에서 검증·정규화**하는 패턴을 미리 정하는 것이 좋습니다.
3. **품질 vs 범위**: 테스트 커버리지는 강하지만(I3), 아키텍처의 접근성 항목(A2, A3)은 **같은 Settings UI**에 대한 UX/a11y 보완으로, 별도 소규모 PR로 묶기 적합합니다.

## Deduplicated Items

| 통합 ID | 원본             | 한 줄 정리                                | 우선순위                |
| ------- | ---------------- | ----------------------------------------- | ----------------------- |
| D1      | I1 + A1          | 결정·아키텍처 문서 + STATUS 반영          | 머지 직전~직후          |
| D2      | S1 + (I4와 연관) | 설정 문자열은 “사용 지점”에서 검증·정규화 | STT/API 연동 시 필수    |
| D3      | I3               | webSpeechApi 관련 대칭 테스트             | 여유 시                 |
| D4      | A2 + A3          | 다이얼로그 포커스/Escape, `aria-disabled` | a11y 폴리시에 맞춰 선택 |

## Final Recommendation

**APPROVE_WITH_FOLLOW_UPS**

- **머지 가능 조건**: 블로킹 결함 없음, 테스트 전부 통과.
- **필수 후속**: D1(문서·이슈 상태) 정리; STT/API에 language·batchModel 등을 연결할 때 D2 적용.
- **선택 후속**: D3, D4.
