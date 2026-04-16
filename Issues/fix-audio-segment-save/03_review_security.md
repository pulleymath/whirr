---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  feature: "fix-audio-segment-save"
  review_kind: security
---

# Security & Performance Review

## Summary

클라이언트 로컬 오디오 저장 경로에서 병합 Blob 대신 세그먼트 배열을 그대로 넘기도록 바뀐 수준이라 **새로운 외부 입력·인증·XSS 표면은 거의 없고**, 성능은 **병합 단계 제거로 CPU 측면 이득**이 있을 수 있으나 **세그먼트 개수가 매우 많을 때 객체·배열 오버헤드**는 감안할 만하다.

## Security Findings

### [LOW] 저장 데이터 형태만 변경 (Blob[] vs 단일 Blob)

- Location: `src/components/recorder.tsx` (`saveSessionAudio` 호출 구간)
- Category: data-handling
- Risk: `segments`는 녹음 파이프라인에서 온 `Blob[]`이며 IndexedDB에 `put`만 수행한다. 이 diff만으로 **서버 유출·새 시크릿 노출·HTML 삽입 경로는 추가되지 않는다**.
- Remediation: 보안 측면 추가 조치 필수 아님.

### [LOW] 테스트에 고정 문자열 Blob

- Location: `src/components/__tests__/recorder-batch.test.tsx`, `session-detail-audio.test.tsx`
- Category: data-handling
- Risk: 테스트 전용 데이터로 **운영 비밀 노출 위험은 없음**.
- Remediation: 없음.

## Performance Findings

### [LOW] `getFullAudioBlob` 병합 제거

- Location: `src/components/recorder.tsx`
- Category: memory
- Impact: 긴 녹음에서 **여러 WebM 청크를 하나로 합치는 작업**이 사라지면 병합 비용과 대형 단일 Blob 할당이 줄어들 수 있다.

### [LOW] 세그먼트 개수 증가 시 배열·Blob 핸들 오버헤드

- Location: `src/components/recorder.tsx` → `saveSessionAudio(id, segments)`
- Category: storage / memory
- Impact: 총 바이트 수가 같아도 **Blob 객체 수가 N배**가 되면 JS 힙 오버헤드가 약간 늘 수 있다. 세션당 `put` 횟수는 이 diff만으로 늘지 않는다.

### [INFO] `useCallback` 의존성에서 `batch.sessionRef` 제거

- Location: `src/components/recorder.tsx`
- Category: rendering
- Impact: 콜백 재생성/이펙트 재실행 빈도에 영향 가능. 올바른 의존성 여부는 기능 리뷰 대상.

## Verdict

**PASS_WITH_NOTES**
