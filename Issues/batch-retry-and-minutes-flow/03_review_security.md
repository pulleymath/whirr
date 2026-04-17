---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  feature: batch-retry-and-minutes-flow
  review_kind: security
---

# Security & Performance Review

## Summary

클라이언트 측 워커 큐·`online` 리스너·재시도 UI 변경은 **새로운 시크릿 노출, XSS, 인젝션 경로를 추가하지 않으며**, 인덱스·큐 중복 제거 등 방어적 처리가 들어가 있습니다. 다만 **재시도 상한 없음**으로 인한 지속적 네트워크/CPU 사용과, **큐 정렬·전사본 전체 조합**이 핫 패스에서 반복되는 점은 성능·비용 측면에서 주의할 만합니다.

## Security Findings

### [LOW] 클라이언트 재시도 폭주로 인한 비용·가용성 영향

- Location: `src/hooks/use-batch-transcription.ts` (회전 콜백 `enqueueIndices`, `useEffect` 내 `online` 핸들러), 이슈/계획서(재시도 상한 없음)
- Category: data-handling / auth (서버 측 한도·과금과 연동 시)
- Risk: 의도된 동작이지만, 장시간 녹음·불안정 네트워크에서 **STT API 호출이 매 회전·online마다 반복**될 수 있습니다. 클라이언트만으로는 남용 방지가 어렵고, **서버/API 키·쿼터 정책**에 부담이 가면 비용·DoS에 가까운 패턴이 될 수 있습니다(브라우저 탭 단위).
- Remediation: 서버 측 **레이트 리밋·백오프 응답·모니터링** 유지/강화. 제품 정책상 필요하면 **최대 재시도 간격 또는 사용자 확인 후 재시도**를 선택적으로 두는 것을 검토(요구사항과 충돌 시 문서화만으로도 충분할 수 있음).

### [LOW] 저장 실패 시 콘솔에 오류 메시지 로깅

- Location: `src/components/recorder.tsx` (`handleBatchRetry`의 `console.error("[session-storage] save failed:", msg)` 등 기존 패턴과 동일 계열)
- Category: data-handling
- Risk: `saveSession`/`saveSessionAudio`가 던지는 예외 메시지에 **경로·내부 식별자**가 포함되면 개발자 도구에 노출될 수 있습니다. 심각도는 낮으나 민감 환경에서는 정보 유출 여지가 있습니다.
- Remediation: 프로덕션에서는 **사용자용 일반 메시지 + 구조화 로깅(민감 필드 제거)** 또는 서버 측 로깅으로만 상세 원인 기록.

## Performance Findings

### [MEDIUM] 의도적 무제한 재시도에 따른 지속 부하

- Location: `src/hooks/use-batch-transcription.ts` (회전·`online`·`retryTranscription` 경로)
- Category: network / memory
- Impact: 요구사항상 정당하지만, **fetch·타이머·상태 갱신**이 오래 지속되면 배터리·CPU·네트워크를 계속 사용합니다. 탭을 열어둔 채 실패가 반복되면 특히 두드러집니다.
- Suggestion: (선택) **백그라운드 탭**일 때 재시도 빈도 완화, 또는 동일 실패에 대한 **지수 백오프**(제품이 허용할 때만). 최소한 메트릭/알림으로 “장시간 실패 루프”를 관찰 가능하게 하는 것을 권장합니다.

### [LOW] `enqueueIndices`에서 매번 큐 전체 정렬

- Location: `src/hooks/use-batch-transcription.ts` (`enqueueIndices` 내 `queueRef.current.sort`)
- Category: storage / rendering (알고리즘)
- Impact: 세그먼트 수가 커지고 회전·`online`이 잦으면 **O(n log n)** 정렬이 반복됩니다. 대부분 세션에서는 미미할 수 있습니다.
- Suggestion: 삽입 시 **이진 탐색으로 정렬 유지**하거나, “시간순”이 이미 보장되는 입력이면 **정렬 생략** 여부를 검토합니다.

### [LOW] 세그먼트 완료마다 전체 partial 배열을 이어 붙이기

- Location: `src/hooks/use-batch-transcription.ts` (`refreshTranscriptFromPartials` → `filter` + `join`)
- Category: rendering / memory
- Impact: 세그먼트가 많을수록 **매 완료 시 O(세그먼트 수)** 재계산이 반복되어, 전사 진행 중 메인 스레드 작업이 늘어날 수 있습니다.
- Suggestion: **증분 업데이트**(마지막으로 바뀐 인덱스만 반영) 또는 **디바운스**로 `setTranscript` 빈도 제한.

### [LOW] `useBeforeUnload` 조건 확장

- Location: `src/components/recorder.tsx` (`useBeforeUnload(..., isBatchMode && batch.status === "transcribing")`)
- Category: network / UX
- Impact: 전사 중 이탈 방지는 데이터 손실 완화에 유리합니다. 다만 **브라우저 기본 대화상자**로 사용자 흐름을 막을 수 있어, “transcribing”이 길어지면 체감 방해가 될 수 있습니다(성능이라기보다 UX).
- Suggestion: 필요 시 **저장 완료 후에만** 경고를 끄는 등 기존 패턴과 일관되게 유지하면 충분합니다.

## Verdict

**PASS_WITH_NOTES** — 치명적·높은 심각도의 보안 취약점은 보이지 않으며, 인덱스 검증·큐 중복 제거·`online` 리스너 정리 등은 적절합니다. **무제한 재시도에 따른 클라이언트/백엔드 부하**, **큐 정렬·전체 transcript 재조합**은 규모가 커질 때 비용·반응성에 영향을 줄 수 있어 위 수준의 개선·관측을 권장합니다.
