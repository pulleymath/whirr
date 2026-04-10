---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  feature: "feature-12-stt-session-resilience"
  review_kind: security
---

# Security & Performance Review

## Summary

STT 세션 복원력 변경은 비밀 키 노출·XSS·새 외부 입력 경로를 추가하지 않으며, 타이머·리스너 정리도 대체로 적절합니다. 다만 클라이언트 콘솔 로깅·토큰 발급 실패 시 에러 메시지 처리·실패 시 Blob 장기 메모리 보유는 보안·프라이버시·메모리 측면에서 주의할 만합니다.

## Security Findings

### [MEDIUM] 프로바이더 에러 전체를 `console.error`로 기록

- Location: `src/hooks/use-transcription.ts` (`handleTokenPathError` 내 `console.error("[transcription] provider error:", err)`)
- Category: data-handling
- Risk: 복구 가능한 오류가 잦아질수록 브라우저 개발자 도구에 `Error` 객체(스택·원문 메시지)가 누적됩니다. 운영/지원용으로는 유용하나, 공용 기기·스크린 녹화·확장 프로그램 환경에서는 내부 구현 단서가 노출될 수 있습니다.
- Remediation: 프로덕션에서는 `console.error`를 생략하거나, 로깅 시 `message`만 제한적으로 남기고 스택은 제외하는 빌드 분기(또는 샘플링)를 검토합니다.

### [LOW] 재연결 실패 시 `fetchToken` 예외 메시지를 그대로 사용자 문구 파이프라인에 전달

- Location: `src/hooks/use-transcription.ts` (`handleTokenPathError`의 `catch`에서 `userFacingSttError(failRaw)`)
- Category: data-handling
- Risk: 토큰 API가 상세한 서버/프록시 오류 문자열을 `Error.message`에 실으면, 매핑되지 않은 경우 `userFacingSttError`의 기본 문구로만 가려지더라도 일부 구현에서는 원문이 새어 나갈 여지가 있습니다(현재 매핑 테이블·`default` 동작에 따라 다름).
- Remediation: 토큰 경로 실패는 고정 코드(예: `TOKEN_FETCH_FAILED`)로 정규화한 뒤 매핑하거나, 알 수 없는 메시지는 항상 동일한 일반 문구만 노출하도록 보장합니다.

### [LOW] 배치 전사 실패 후에도 녹음 Blob을 ref에 유지

- Location: `src/hooks/use-batch-transcription.ts` (`lastRecordingBlobRef`)
- Category: data-handling
- Risk: 의도된 재시도 UX이나, 탭을 닫기 전까지 **오디오 Blob이 메모리에 더 오래 남습니다**. 공용 기기에서는 “실패 직후 메모리에서 사라짐” 대비 잔존 시간이 길어집니다.
- Remediation: 문서/UX로 명시하거나, 백그라운드 탭·장시간 방치 시 Blob 해제 정책(타임아웃)을 별도로 검토합니다.

### [LOW] Web Speech `start()` 예외 메시지를 그대로 `onError`에 전달

- Location: `src/lib/stt/web-speech.ts` (`tryStartRecognition` 내 `onError(new Error(msg))`)
- Category: data-handling
- Risk: 브라우저별 예외 문자열이 예측 불가하나, 일반적으로 민감 정보를 담지는 않습니다. 다만 로깅·상위 계층에서 그대로 노출되면 노이즈·희귀 케이스 정보 유출 가능성은 있습니다.
- Remediation: 필요 시 내부 코드로 정규화한 뒤 `userFacingWebSpeechErrorCode` 등 기존 경로로만 UI에 노출합니다.

## Performance Findings

### [MEDIUM] 실패 시 배치 녹음 Blob의 메모리 장기 점유

- Location: `src/hooks/use-batch-transcription.ts` (`lastRecordingBlobRef`, `retryTranscription`)
- Category: memory
- Impact: 긴 녹음에서 전사가 반복 실패하면 **대용량 Blob이 GC 대상에서 제외된 채 유지**되어 모바일·저메모리 환경에서 압박이 커질 수 있습니다.
- Suggestion: 재시도 횟수·시간 상한 후 명시적 해제, 또는 “다시 시도” 외 “녹음 폐기”를 동일 화면에서 강조해 조기 해제를 유도합니다.

### [LOW] 배치 전사 자동 재시도로 최악 지연·업스트림 부하 증가

- Location: `src/hooks/use-batch-transcription.ts` (`runTranscribeWithRetries`, `BATCH_TRANSCRIBE_RETRY_BACKOFF_MS`)
- Category: network
- Impact: 5xx·네트워크 오류 시 최대 3회 시도와 2s·4s 대기로 **최악 경우 사용자 체감 지연이 길어지고**, 서비스 장애 시 동일 Blob에 대한 요청이 배수될 수 있습니다.
- Suggestion: 정책상 의도된 동작이면 유지. 부하가 문제가 되면 재시도 상한·백오프 상한·서킷 브레이커(연속 실패 시 수동만)를 검토합니다.

### [LOW] `visibilitychange` 시 가시 상태마다 `start()` 재시도

- Location: `src/lib/stt/web-speech.ts` (connect 시 등록한 `visibilitychange` 핸들러)
- Category: rendering/memory
- Impact: 탭 전환을 자주 하면 **불필요한 `start()` 호출·예외 경로**가 늘어날 수 있습니다. `tryStartRecognition`이 실패 시 카운터를 올리므로, 과도한 전환은 재시작 한도 소진으로 이어질 수 있습니다.
- Suggestion: 이미 인식 중인지(브라우저 상태)를 가능한 한 반영하거나, visible 전환당 디바운스/쿨다운을 두어 호출 빈도를 줄입니다.

### [LOW] 실시간 재연결 시 `console.error` I/O

- Location: `src/hooks/use-transcription.ts`
- Category: network (client-side I/O)
- Impact: 재연결이 잦은 구간에서 **콘솔 출력 비용**이 소폭 누적될 수 있습니다.
- Suggestion: 개발 전용 가드 또는 샘플링.

## Verdict

PASS_WITH_NOTES
