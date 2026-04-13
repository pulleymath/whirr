---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  feature: "feature-13-5min-segment-recording"
  review_kind: security
---

# 성능 및 보안 리뷰

## 리뷰 개요

- 피쳐: 5분 세그먼트 녹음 및 디버그 오디오 저장
- 중점 사항: 대용량 Blob 저장에 따른 메모리/저장소 성능, IndexedDB 보안, 다운로드 안전성

## 체크리스트 및 결과

1. **메모리 관리**: 녹음 중 생성되는 Blob들을 `segmentsRef`에 유지하므로 장시간 녹음 시 메모리 사용량이 증가할 수 있음. 하지만 5분 단위로 분할하여 전사하므로 단일 대용량 Blob보다는 안정적임.
2. **저장소 성능**: `session-audio` 스토어를 분리하여 세션 목록 조회 성능에 영향을 주지 않도록 설계됨.
3. **보안**: IndexedDB는 동일 출처 정책(SOP)에 의해 보호되므로 안전함. 다운로드 시 `URL.revokeObjectURL`을 통한 리소스 정리가 적절히 수행됨.
4. **API 호출**: 5분마다 API를 호출하므로 부하가 분산됨.

## 상세 의견

- **메모리 최적화**: 매우 긴 녹음(예: 수 시간)의 경우 메모리 내에 모든 Blob을 들고 있는 것이 부담이 될 수 있으나, 현재 MVP 수준에서는 허용 가능한 범위임. 향후 필요시 IndexedDB에 즉시 스트리밍 저장하는 방식을 고려할 수 있음.
- **Quota 관리**: IndexedDB 저장 시 브라우저 쿼터 제한에 걸릴 수 있음. 현재 코드에서 에러 핸들링이 되어 있어 전체 앱 중단은 발생하지 않음.
- **성능 (추가)**: 100ms 인터벌 렌더 비용 및 다건 동시 다운로드 시의 브라우저 부하에 대한 주의가 필요함.

## 액션 아이템

- [MEDIUM] `useBatchTranscription`의 100ms `setInterval` 주기를 250-500ms로 완화하거나 throttling 고려.
- [LOW] 다운로드 파일명의 ISO 문자열에서 `:` 등 특수문자 치환 (Windows 호환성).
