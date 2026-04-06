# Review Synthesis

## Overall Quality Score

B — 핵심 기능과 단위·통합 테스트 대부분은 충실하나, 계획 대비 중지 플로우 검증 공백과 공개 토큰 API의 남용 위험이 동시에 남아 있어 “바로 운영 반영” 수준은 아니다.

## Executive Summary

구현·테스트 관점에서는 Vitest 50개 통과와 모듈별 커버리지가 양호하다. 보안·과금 측면에서는 인증·제한 없는 STT 토큰 발급이 가장 큰 구멍이며, 아키텍처는 전반적으로 문서와 맞지만 Provider 추상화·`index.ts` 역할 서술과 실제 코드 사이에 정리할 여지가 있다. 스타일·저우선 이슈는 출시 판단을 가르지 않는다.

## Consolidated Findings

### Immediate Fixes Required (CRITICAL/HIGH)

| #   | Finding                                                                                               | Source         | Severity | Category               |
| --- | ----------------------------------------------------------------------------------------------------- | -------------- | -------- | ---------------------- |
| 1   | STT 토큰 API에 인증·제한 없음                                                                         | security       | HIGH     | auth / abuse           |
| 2   | Step 5 요구: 녹음 중지 시 `stop`/`disconnect`(또는 `stopRecording` → `finalizeStreaming`) 순서 미검증 | implementation | HIGH     | test / plan compliance |

#### 1. STT 토큰 API 무인증·무제한 발급

- **원래 심각도:** security HIGH
- **조정 심각도:** HIGH (유지)
- **위치:** `src/app/api/stt/token/route.ts`
- **조치:** 인증(또는 최소한 세션·서명된 클라이언트 검증), 레이트 리밋, 모니터링·알림을 도입해 토큰 남용·과금 폭주를 막을 것.

#### 2. 중지 플로우 통합 테스트 누락 (계획 Step 5)

- **원래 심각도:** implementation HIGH
- **조정 심각도:** HIGH (유지)
- **위치:** `src/components/__tests__/recorder-stt-integration.test.tsx`
- **조치:** 녹음 중 상태를 모의한 뒤 “중지” 시 `stopRecording`이 `finalizeStreaming`보다 먼저 호출되는지 `callOrder` 등으로 단언하는 시나리오 추가.

### Recommended Improvements (MEDIUM)

| #   | Finding                                              | Source          | Category             |
| --- | ---------------------------------------------------- | --------------- | -------------------- |
| 1   | WebSocket/업스트림 오류 문자열이 UI에 그대로 노출    | security        | data-handling / UX   |
| 2   | Base64 변환 시 문자열 반복 연결                      | security (perf) | performance          |
| 3   | WebSocket OPEN 전 `pendingAudio` 무제한 적재 가능    | security (perf) | performance / memory |
| 4   | `SessionTerminated`만 수신하는 경로의 테스트 보강    | implementation  | test coverage        |
| 5   | 훅 기본 Provider가 AssemblyAI 구체에 고정            | architecture    | boundaries           |
| 6   | `ARCHITECTURE.md` §7의 `index.ts` 역할과 실제 불일치 | architecture    | documentation        |

### Optional Enhancements (LOW)

- 짧은 수명 토큰이 URL 쿼리에 포함됨 (`assemblyai.ts`) — 위협 모델에 맞게 문서화 또는 대안 검토.
- `finals` 배열 무한 증가 — 장시간 세션에서 상한·윈도잉.
- export 스모크 테스트 검증 강도 (`types.test.ts`).
- 훅 “리셋” 시나리오 테스트 (`use-transcription.test.tsx`).
- API 라우트 핸들러 집중도, `Recorder` 내 오케스트레이션 혼재 — 필요 시 분리.
- `TranscriptView` 목록 `key`가 콘텐츠에 의존 — 안정적 ID 선호.
- STT 모듈 import 경로 불일치 (`use-transcription.ts`).

## Cross-Domain Observations

- **스트리밍 경로:** `assemblyai.ts`가 보안(오류 노출)·성능(Base64, 큐)·테스트(세션 종료 엣지) 논의의 교차점이다.
- **경계 설계:** 아키텍처의 “UI가 구현체를 직접 참조하지 않음”과 보안의 “토큰 발급은 신뢰 경계 안에서만”이 같은 방향(서버·팩토리·인증)으로 수렴한다.

## Deduplicated Items

세 리뷰가 **동일 항목을 서로 다른 이름으로 중복 지적한 사례는 없다.** “Recorder·STT 연결부의 견고함”은 구현(중지 순서 테스트)과 아키텍처(Recorder 책임)에서 **인접 주제**로 각각 다루어졌으며, 위 표에서 역할에 맞게 분리 유지했다.

## Conflicts Resolved

**명시적 상충은 없었다.** 도메인별 권한 규칙에 따라: 보안 이슈는 security 리뷰 기준, 구조·추상화는 architecture 기준, 계획 대비 테스트 완결성은 implementation 기준으로 반영했다. 교차 시 **보수적 쪽**(예: 토큰 API는 인증·제한 없이 두지 않음)을 택했다.

## Final Verdict

FIX_THEN_SHIP

### Rationale

HIGH 두 건(공개 토큰 남용 위험, 계획 Step 5 중지 순서 미검증)은 출시 전에 처리하는 것이 타당하다. 나머지는 MEDIUM 이하로, 병행 개선 또는 후속 이슈로 묶어도 전체 방향성을 해치지 않는다. 구조적 재설계가 필요한 수준(MAJOR_REVISION)은 아니다.
