# Review Synthesis

## Overall Quality Score

**A** — 계획 이탈(UI props)·과도한 리렌더(`sttPcmFramesSent`)·로깅·테스트 공백(`onError`)을 코드 수정으로 수렴시켰다. 남은 MEDIUM은 운영 한계(프록시·분산 레이트 리밋)와 선택적 구조 개선이다.

## Executive Summary

세 리뷰 모두 초기에는 **PASS_WITH_NOTES / NEEDS_FIXES** 성격이었으나, 동일 테마(UI 확장, 청크당 setState, 로그, 훅 테스트)를 한 번에 정리했다. 보안상 치명적 결함은 없고 에피메랄 토큰 패턴은 적절하다.

## Consolidated Findings

### Immediate Fixes Required (CRITICAL/HIGH)

| #   | Finding                              | Source         | 조치                  |
| --- | ------------------------------------ | -------------- | --------------------- |
| 1   | 계획 대비 UI·props 변경              | impl, arch     | `recording` prop 제거 |
| 2   | 청크마다 `sttPcmFramesSent` setState | security, impl | 상태 제거             |
| 3   | Provider `onError` → UI 테스트 공백  | impl           | 훅 테스트 추가        |

### Recommended Improvements (MEDIUM)

| #   | Finding                       | Source   | 비고                         |
| --- | ----------------------------- | -------- | ---------------------------- |
| 1   | XFF·인메모리 레이트 리밋 한계 | security | 문서·운영 가이드, 추후 Redis |
| 2   | 기본 팩토리 스모크            | impl     | 선택                         |

### Optional Enhancements (LOW)

- WS 파싱 공용화, PCM 프레이밍 모듈 분리, 세션 타입 좁히기.

## Cross-Domain Observations

- UI 변경·`sttPcmFramesSent`·로그는 구현·보안·아키텍처 리뷰에서 중복 지적 → 단일 수정으로 처리.

## Deduplicated Items

- UI vs 계획: impl HIGH + arch MEDIUM → 하나의 HIGH로 통합 후 해소.
- `sttPcmFramesSent`: security HIGH + impl LOW → 제거로 해소.

## Conflicts Resolved

- `sttPcmFramesSent` 심각도: security 우선 → 제거로 완화.
- route의 `openai-realtime` import: 공유 `openAiTranscriptionSessionBody`로 정당화.

## Final Verdict

**SHIP** (리뷰 반영 커밋 기준)

### Rationale

HIGH 항목(UI 계약, 성능, onError 테스트)과 LOW 정리(로그, dead code, import 순서, 세션 바디 단일화)를 반영했으며, 남은 이슈는 운영·선택 개선에 해당한다.
