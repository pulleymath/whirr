---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "fix-audio-segment-save"
  review_kind: architecture
---

# Architecture & Code Style Review

## Summary

배치 정지 시 `stopBatchTranscribe`가 넘기는 **세그먼트 배열**을 `saveSessionAudio`에 위임하는 흐름은 브라우저·로컬 DB 경계와 잘 맞고, `Recorder`의 `stop` 콜백 의존성을 훅의 안정된 API에 맞추는 방향도 구조적으로 타당합니다. 테스트는 저장·다운로드 계약을 한 단계 더 명확히 하며, 배치 테스트에 남은 **미사용 mock 표면**은 정리 여지가 있습니다.

## Architecture Findings

### [LOW] 배치 테스트에 `getFullAudioBlob` 목이 남아 있음

- Location: `src/components/__tests__/recorder-batch.test.tsx`
- Category: coupling / structure
- Description: 저장 경로가 세그먼트 기반이면 `Recorder` 경로에서 `getFullAudioBlob`를 더 이상 호출하지 않을 수 있어 목이 혼란을 줄 수 있음.
- Suggestion: 실제로 호출되는 메서드만 남기거나 `getFullAudioBlob` 검증을 오디오 유틸 단위 테스트로 이동.

### [LOW] `docs/ARCHITECTURE.md`의 “오디오 원본 미유지” 서술과의 정합성

- Location: 문서(코드 변경 아님)
- Category: structure
- Description: 로컬 세그먼트 보존과 문서 한 줄 요약의 용어 정렬은 별도 권장.

### [LOW] `Recorder.stop` 배치 분기의 오케스트레이션 밀도

- Location: `src/components/recorder.tsx`
- Category: cohesion
- Suggestion: 분기가 늘면 `persistBatchSession` 같은 작은 헬퍼 추출 검토.

## Code Style Findings

### [LOW] 배치 테스트의 세그먼트 검증 방식

- Location: `src/components/__tests__/recorder-batch.test.tsx`
- Description: `expect.any(Array)` 뒤 길이·첫 Blob 내용 검증은 계약 고정에 유효함.

### [LOW] `session-detail-audio.test.tsx` 구성

- Location: `src/components/__tests__/session-detail-audio.test.tsx`
- Description: import 순서·단언 구조는 기존 패턴과 일치.

## Verdict

**PASS_WITH_NOTES**
