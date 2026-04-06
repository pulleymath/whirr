# Security & Performance Review

## Summary

클라이언트 측 마이크·오디오 파이프라인은 비밀 노출이나 전형적 XSS 위험은 낮습니다. 다만 **녹음 시작을 빠르게 연속 호출할 때 이전 세션이 정리되지 않을 수 있는 레이스**가 있고, **녹음 중 매 프레임 `setState`**와 worklet 측 **매 퀀텀 버퍼 할당**이 부담이 될 수 있습니다.

## Security Findings

### [HIGH] 녹음 시작 레이스로 인한 고아 미디어 세션

- **Location:** `src/hooks/use-recorder.ts` (`start` 콜백)
- **Category:** data-handling / 리소스 수명
- **Risk:** 중복 `start()`로 두 개의 세션이 생기면 이전 스트림·컨텍스트가 정리되지 않을 수 있음.
- **Remediation:** 진행 중 플래그 또는 기존 세션 정리 후 시작.

### [MEDIUM] 원시 PCM이 콜백으로 전달되는 데이터 취급

- **Location:** `src/lib/audio.ts`, `use-recorder.ts`
- **Risk:** 향후 네트워크·로깅 시 음성 데이터 유출 가능성.
- **Remediation:** 전송 시 TLS, 로그 금지 등 정책.

### [LOW] `getUserMedia({ audio: true })` 제약 없음

- **Location:** `src/lib/audio.ts`

## Performance Findings

### [HIGH] 녹음 중 `requestAnimationFrame`마다 `setLevel`로 리렌더

- **Location:** `src/hooks/use-recorder.ts`
- **Remediation:** 스로틀 또는 ref 기반 업데이트.

### [MEDIUM] 레벨 미터 매 프레임 `Uint8Array` 할당

- **Location:** `src/hooks/use-recorder.ts`
- **Remediation:** 버퍼 재사용.

### [MEDIUM] Worklet `process`에서 매 호출 `merged` 전체 복사

- **Location:** `public/audio-processor.js`
- **Remediation:** (선택) 링 버퍼 등으로 개선.

## Verdict

**PASS_WITH_NOTES**
