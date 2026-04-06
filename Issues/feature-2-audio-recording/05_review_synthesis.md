# Review Synthesis

## Overall Quality Score

**B** — 기능·구조·테스트가 계획을 충족하고, 리뷰 후 HIGH 이슈(중복 시작 레이스, 레벨 미터 과도 리렌더)를 코드로 완화했습니다. 워클릿 버퍼 할당 최적화 등은 후속으로 남습니다.

## Executive Summary

구현·아키텍처 리뷰는 대체로 PASS_WITH_NOTES였고, 보안/성능 리뷰는 중복 `start` 레이스와 rAF마다 `setState`를 HIGH로 지적했습니다. 종합적으로 동일 원인(세션 수명·UI 업데이트 빈도)이 두 영역에 걸쳐 있어, `startingRef`/`cancelledRef` 가드와 레벨 UI 스로틀·`Uint8Array` 재사용으로 정렬했습니다.

## Consolidated Findings

### Immediate Fixes Required (CRITICAL/HIGH)

| #   | Finding                                  | Source                    | Severity | Category    |
| --- | ---------------------------------------- | ------------------------- | -------- | ----------- |
| 1   | 녹음 시작 중복/레이스로 고아 미디어 세션 | security / implementation | HIGH     | 리소스 수명 |
| 2   | rAF마다 `setLevel`로 과도 리렌더         | security                  | HIGH     | 렌더링      |

#### 1. 중복 start / stop-중 시작 취소

- **Adjusted severity:** HIGH
- **Location:** `src/hooks/use-recorder.ts`
- **Action:** `startingRef`로 진행 중 재진입 차단, `cancelledRef`로 `stop` 또는 대기 중 취소 시 획득한 세션을 즉시 `stop`, `getUserMedia` 대기 중 중복 호출 방지.

#### 2. 레벨 미터 UI 업데이트

- **Adjusted severity:** HIGH
- **Location:** `src/hooks/use-recorder.ts`
- **Action:** `LEVEL_UI_MIN_INTERVAL_MS`(48ms) 스로틀, Analyser용 `Uint8Array` 재사용.

### Recommended Improvements (MEDIUM)

| #   | Finding                           | Source               |
| --- | --------------------------------- | -------------------- |
| 1   | `getUserMedia` reject 단위 테스트 | implementation       |
| 2   | 워클릿 `merged` 할당/GC 부담      | security/performance |
| 3   | `formatElapsed` 위치(훅 vs lib)   | architecture         |

- **1:** `src/lib/audio.test.ts`에 `getUserMedia` 거부 케이스 추가(반영 완료).
- **2:** 후속 리팩터(링 버퍼 등) 권장.
- **3:** 선택적 분리.

### Optional Enhancements (LOW)

- `onPcmChunk` 통합 테스트, `Recorder`에 PCM 소비자 prop 노출(STT 연동 시).
- `getUserMedia` constraints(`echoCancellation` 등) 명시.

## Cross-Domain Observations

세션 수명과 메인 스레드 부하가 구현·보안·성능 리뷰에서 동시에 다뤄짐.

## Deduplicated Items

- “중복 start” = implementation MEDIUM + security HIGH → **HIGH**로 통합 처리.

## Conflicts Resolved

없음.

## Final Verdict

**SHIP** (리뷰 지적 HIGH 항목 반영 후)

### Rationale

중복 시작 가드·취소 경로·레벨 스로틀·버퍼 재사용·`getUserMedia` 실패 테스트가 반영되었고, 타입체크·린트·테스트·빌드가 통과합니다.
