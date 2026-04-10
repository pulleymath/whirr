---
issue_driven_dev:
  source: subagent
  phase: synthesis
  subagent_type: generalPurpose
  feature: "feature-12-stt-session-resilience"
---

# Unified action plan

구현·보안·아키텍처 리뷰를 통합·중복 제거·충돌 해소(보안·구조·정확성 우선 규칙 적용)한 결과이다. 보안 CRITICAL는 없음. 다중 리뷰어 동일 지적은 한 행으로 묶었다.

## CRITICAL

| ID | Finding | Sources | Action |
|----|---------|---------|--------|
| — | 없음 | — | 세 리포트에 치명적 보안·데이터 유출급 항목 없음 |

## HIGH

| ID | Finding | Sources | Action |
|----|---------|---------|--------|
| H1 | 플랜 Step 7 Recorder 테스트 미구현(UI·훅 연결 회귀 락 없음) | impl (HIGH), arch (동일 주제 LOW) | `recorder-stt-integration.test.tsx` 확장 또는 `recorder-session-resilience.test.tsx` 추가: 경과/`streamingSessionHint`, 55분 안내, `reconnectToast`, 엔진 분기, 배치 에러 시 `retryBatchTranscription` 호출 검증 |
| H2 | 프로바이더·토큰 경로 오류의 콘솔 로깅과 사용자 대면 문자열 | sec (MEDIUM `console.error` 전체 Error + LOW 토큰 실패 원문 파이프라인; LOW 콘솔 I/O는 동일 완화에 포함) | 프로덕션에서 전체 스택/객체 로깅 생략·샘플링 또는 `message`만; 토큰 실패는 고정 코드(예: `TOKEN_FETCH_FAILED`)로 정규화 후 매핑, 미매핑 시 항상 동일 일반 문구만 노출 |

## MEDIUM

| ID | Finding | Sources | Action |
|----|---------|---------|--------|
| M1 | Web Speech `visibilitychange` 재시도: 플랜「1회」와 구현 불일치 + visible마다 `start()` 빈도 | impl, sec, arch | 한 번만 재시도 플래그 또는 플랜/제품 문구 정정; 가능 시 인식 중 상태 반영·디바운스/쿨다운 |
| M2 | 배치 `fetch` throw(네트워크) 백오프 재시도가 테스트에 없음 | impl | `mockRejectedValueOnce` 연쇄로 실패→성공/최종 실패 케이스를 `use-batch-transcription.test.tsx`에 추가 |
| M3 | STT 어댑터가 `user-facing-error`에 결합(신호 vs 문구 레이어 혼합) | arch | `stt/session-codes.ts` 등 기계용 상수 분리, `user-facing-error`는 문구 매핑만 |
| M4 | 55분 선제 간격이 프로바이더·Recorder에 이중 정의 | arch | 공용 상수 단일 출처 export 후 recorder가 import |
| M5 | `prepareStreaming` 내부 `handleTokenPathError` 등 대형 중첩 블록 | arch | 핸들러를 모듈/`useCallback`으로 분리, `prepareStreaming`은 오케스트레이션만 |
| M6 | 배치 실패 후 `lastRecordingBlobRef` Blob 장기 점유(프라이버시·메모리) | sec (MEDIUM 메모리 + LOW 데이터 처리 통합) | 문서/UX 명시; 재시도·시간 상한 후 명시적 해제 또는 「폐기」 유도 |
| M7 | `reconnectToast` 명명 vs 실제 `<p role="status">` 패턴 불일치 | arch | `reconnectStatusMessage` 등 rename 또는 실제 토스트/라이브 리전으로 통일 |
| M8 | 배치 자동 재시도의 최악 지연·업스트림 부하 | sec | 의도면 문서화; 필요 시 백오프 상한·연속 실패 시 수동만(서킷) 검토 |

## LOW (선택)

- `isSttReconnectRecoverableMessage` 직접 단위 테스트 — impl  
- `reconnectToast` 설정 `renderHook`/`waitFor` 검증 — impl  
- Web Speech `start()` 예외 문자열 정규화 후 UI 경로만 — sec  
- `MockWebSocket` 공통 추출 — arch  
- 플랜 파일명 vs `use-batch-transcription.test.tsx` 문서 정합 — arch  
- `SESSION_PROACTIVE_RENEW` 토스트 전용 여부 주석 고정 — arch  
- 배치 백오프 루프 가독성 — arch  

## Conflicts resolved

상충 없음. 토큰/로깅·Blob 수명은 보안·보수적 사용자 표면 원칙을 따름.

## Final verdict

**FIX_THEN_SHIP** — H1·H2 처리 후 머지 권장; M·L은 단계적 적용 가능.
