---
issue_driven_dev:
  source: main
  phase: plan
  subagent_type: generalPurpose
  feature: "fix-audio-segment-save"
---

# 배치 녹음 오디오 세그먼트 저장/다운로드 수정 — 컨텍스트(리뷰용)

## 개발 범위

- 배치 모드에서 녹음 중지 시 `getFullAudioBlob()`로 합친 단일 Blob만 IndexedDB에 저장하던 동작을 제거한다.
- `stopAndTranscribe()`가 반환하는 `segments` 배열을 그대로 `saveSessionAudio`에 저장한다.
- 세션 상세에서 다운로드 시 세그먼트 전체가 `downloadRecordingSegments`에 전달되는지 테스트로 고정한다.

## 완료 조건

- 5분 초과 녹음 시 저장되는 세그먼트 수가 회전 횟수 + 마지막 구간과 일치한다(합본 1개로 덮어쓰지 않음).
- 관련 단위 테스트가 통과한다.

## 변경 파일(대상)

- `src/components/recorder.tsx`
- `src/components/__tests__/recorder-batch.test.tsx`
- `src/components/__tests__/session-detail-audio.test.tsx`
