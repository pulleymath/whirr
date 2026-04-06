# Security & Performance Review

## Summary

서버 측 API 키 분리와 일반화된 HTTP 오류 응답은 적절합니다. 다만 **인증 없이 STT 토큰을 무제한 발급**할 수 있어 비용·남용 위험이 크고, WebSocket/업스트림 오류 메시지가 UI에 그대로 노출될 수 있습니다. 성능 측면에서는 **Base64 인코딩의 문자열 누적 방식**과 **CONNECTING 상태에서의 오디오 큐 무제한 증가**가 장시간·고빈도 스트리밍에서 부담이 될 수 있습니다.

## Security Findings

### [HIGH] STT 토큰 API에 인증·제한 없음

- Location: `src/app/api/stt/token/route.ts` (전체 `POST` 핸들러)
- Category: auth
- Risk: 로그인 여부와 관계없이 누구나 `POST /api/stt/token`으로 AssemblyAI 실시간 토큰을 받을 수 있어, **과금·쿼터 고갈·악의적 남용**이 가능합니다. CORS로 다른 사이트에서 직접 호출은 막혀도, 스크립트·봇·익명 사용자에 의한 내부 API 남용은 그대로입니다.
- Remediation: 세션/사용자 인증 후에만 발급, IP·사용자·세션 단위 **레이트 리밋**, 필요 시 **CAPTCHA** 또는 짧은 TTL·1회용 토큰 정책과 모니터링을 도입합니다.

### [MEDIUM] WebSocket/업스트림 오류 문자열이 사용자에게 그대로 전달

- Location: `src/lib/stt/assemblyai.ts` (`handleIncomingMessage` 내 `msg.error` 처리), `src/hooks/use-transcription.ts` (`setErrorMessage(err.message)`)
- Category: data-handling
- Risk: AssemblyAI가 반환하는 `error` 필드나 예외 메시지가 **내부 구현·엔드포인트 단서**를 담을 경우 화면에 노출됩니다.
- Remediation: UI에는 고정된 사용자용 문구만 보여 주고, 원문은 서버 로그(민감 정보 제외)·클라이언트 디버그 플래그에서만 다룹니다.

### [LOW] 짧은 수명 토큰이 URL 쿼리에 포함

- Location: `src/lib/stt/assemblyai.ts` (`connect` 내 `?token=${encodeURIComponent(this.token)}`)
- Category: data-handling
- Risk: 브라우저 히스토리, 일부 프록시/로그, Referer 등 경로로 **토큰이 유출**될 수 있습니다(통상 짧은 TTL이면 영향은 제한적).
- Remediation: 제공사가 지원하면 헤더 기반 인증 등 쿼리 없는 연결 방식을 검토하고, 토큰 TTL을 최소화합니다.

## Performance Findings

### [MEDIUM] Base64 변환 시 문자열 반복 연결

- Location: `src/lib/stt/assemblyai.ts` (`arrayBufferToBase64` 내 `binary += String.fromCharCode(...)` 루프)
- Category: memory / rendering(간접)
- Impact: 청크가 클수록 JS 엔진에 따라 **CPU·할당 비용이 커질 수 있고**, 고빈도 `sendAudio` 호출 시 메인 스레드 부담이 됩니다.
- Remediation: `Uint8Array`를 청크 단위로 처리하거나, (가능하면) **바이너리 전송 경로**로 교체합니다.

### [MEDIUM] WebSocket이 OPEN 되기 전 `pendingAudio` 무제한 적재 가능

- Location: `src/lib/stt/assemblyai.ts` (`sendAudio`의 `CONNECTING` 분기, `pendingAudio`)
- Category: memory
- Risk: 연결이 지연·교착되면 PCM 페이로드 문자열이 **큐에 계속 쌓여** 메모리를 많이 쓸 수 있습니다.
- Remediation: 큐 최대 길이·최대 바이트, 초과 시 드롭 또는 연결 실패 처리, 연결 타임아웃을 둡니다.

### [LOW] `finals` 배열 무한 증가

- Location: `src/hooks/use-transcription.ts`, `src/components/transcript-view.tsx`
- Category: rendering / memory
- Impact: **아주 긴 세션**에서 확정 문장이 계속 쌓이면 상태·DOM이 커지고 리렌더 비용이 증가합니다.
- Remediation: 최대 보관 개수, 가상 스크롤, 또는 세션 단위 페이지네이션을 고려합니다.

## Verdict

PASS_WITH_NOTES
