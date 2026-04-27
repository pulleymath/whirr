---
issue_driven_dev:
  source: subagent
  phase: synthesis
  subagent_type: generalPurpose
  feature: audio-zip-download
---

# Review Synthesis

## Overall Quality Score

**B** — 계획 대비 구현·테스트·접근성 보완이 반영되어 품질은 양호하나, 보안·성능 리뷰에서 지적된 **메인 스레드 블로킹**과 **대용량 세션 메모리 중복** 같은 HIGH 이슈는 머지 후에도 추적이 필요하다.

## Executive Summary

오디오 ZIP 다운로드 기능은 구현·테스트 관점에서 **에러 복구 UI 테스트 부재(MEDIUM)** 가 사후에 **rejection catch + Vitest** 로 보완되어 이전 PASS_WITH_NOTES의 핵심 격차가 해소된 상태다. 접근성은 로딩 시 **동적 `ariaLabel`(ZIP 생성 중)** 로 LOW 항목이 정리되었고, 빈 블롭 계약은 **`downloadRecordingZip` JSDoc** 으로 아키텍처 리뷰의 MEDIUM이 문서 차원에서 완화되었다. 다만 보안·성능 리뷰의 **HIGH(동기 ZIP, 대용량 메모리)** 는 코드 변경만으로는 닫히지 않아, 출시 판단은 **즉시 머지 가능 + 후속 과제 명시**가 타당하다.

## Consolidated Findings

### Immediate Fixes Required (CRITICAL/HIGH)

| #   | Finding                                                         | Source   | Severity | Category             |
| --- | --------------------------------------------------------------- | -------- | -------- | -------------------- |
| 1   | `zipSync` 등 동기 ZIP 생성으로 메인 스레드 장시간 블로킹 가능   | security | HIGH     | Performance / UX     |
| 2   | 대용량 세션에서 ZIP 구성 시 메모리 중복(버퍼 이중 보유 등) 위험 | security | HIGH     | Memory / Scalability |

#### 1. 메인 스레드 블로킹 (동기 ZIP)

- Original severity: security HIGH
- Adjusted severity: **HIGH** (유지)
- Location: ZIP 생성 경로(클라이언트 `zipSync` 계열 사용 지점)
- Action: Web Worker·청크 스트리밍·비동기 API 등으로 **UI 프리즈를 피하는 생성 경로**를 설계하고, 세션 길이·트랙 수 상한에 대한 성능 예산을 정한다.

#### 2. 대용량 세션 메모리 중복

- Original severity: security HIGH
- Adjusted severity: **HIGH** (유지)
- Location: 녹음 Blob 수집 및 ZIP에 넣기 전후의 버퍼 관리
- Action: **스트리밍 추가·중간 Blob 해제·필요 시 서버 측 ZIP** 등으로 피크 메모리를 낮추고, 대용량 픽스처로 측정한다.

### Recommended Improvements (MEDIUM)

| #   | Finding                                                                                   | Source         | Category     |
| --- | ----------------------------------------------------------------------------------------- | -------------- | ------------ |
| 1   | 빈 블롭에 대한 “빌드는 throw / 다운로드는 no-op” 이중 계약 — 동작 단일화 여부 검토        | architecture   | API contract |
| 2   | (선택) 구현 리뷰에서 언급된 **간접 `triggerBlobDownload` 검증**을 더 직접적으로 만들 여지 | implementation | Test clarity |

#### 1. 빈 블롭 계약 (문서화 이후)

- Original severity: architecture MEDIUM
- Adjusted severity: **MEDIUM → LOW~MEDIUM 경계** (JSDoc 반영으로 혼선 완화, **런타임 단일 정책**은 미결)
- Location: `downloadRecordingZip` 및 호출부
- Action: JSDoc을 유지한 채, 팀 합의로 **throw vs no-op 중 하나**로 수렴시키거나, 빌더와 다운로더에 **동일한 가드**를 두어 계약을 코드로 고정한다.

### Optional Enhancements (LOW)

- 파일명 **유니코드/엣지 케이스** 정규화·검증 강화 (security LOW)
- **의존성 감사**(보안 패치·라이선스) 정기 실행 (security LOW)
- **모듈 응집도**, `buildRecordingZipBlob` export 여부, **import 순서**, 인라인 핸들러 정리 (architecture LOW)
- 트리거 다운로드 **목(mock) 스타일** 다듬기 (implementation LOW, 이미 LOW로 분류)

## Cross-Domain Observations

- **“클라이언트에서 ZIP을 만든다”** 는 구현·아키텍처·보안이 한 점에서 만나는 축이다. 기능 완성도는 좋아졌지만, **동기 처리·메모리**는 제품 규모가 커질수록 단일 이슈가 UX·안정성·비용으로 동시에 드러난다.
- **계약(빈 입력)** 과 **접근성(로딩 피드백)** 은 문서·aria로 1차 정리되었고, 남은 것은 **성능·메모리 아키텍처** 쪽이다.

## Deduplicated Items

- “ZIP 생성 중 사용자 피드백”은 구현(aria)·UX와 연결되었고, 보안 리뷰의 **블로킹**과는 별도 축으로 정리했다(aria는 해소, 블로킹은 미해소).

## Conflicts Resolved

- **구현 vs 보안**: 구현상 PASS 요소(에러 테스트·catch)와 별개로, **보안·성능의 HIGH는 보수적으로 유지**한다(충돌 시 보안 관점 우선).
- **아키텍처 MEDIUM(JSDoc)**: 문서 추가만으로 “완전 해소”로 보지 않고, **계약 단일화**는 MEDIUM 후속으로 남긴다.

## Final Verdict

**SHIP_WITH_FOLLOWUPS**

### Rationale

에러 경로 **catch**, **Vitest 복구 시나리오**, 로딩 **동적 `ariaLabel`**, **`downloadRecordingZip` JSDoc** 등으로 구현·테스트·접근성·문서화 격차는 머지 가능 수준으로 좁혀졌다. 반면 **동기 ZIP으로 인한 메인 스레드 블로킹**과 **대용량 세션 메모리 중복**은 사용자 체감·OOM 리스크와 직결되므로 **머지 후 우선순위 높은 후속 과제**로 다루는 것이 합리적이다. CRITICAL은 없고 MAJOR_REVISION 수준의 구조 역행도 없어 **전면 보류(FIX_THEN_SHIP)** 보다는 **선적 후 추적**이 맞다.
