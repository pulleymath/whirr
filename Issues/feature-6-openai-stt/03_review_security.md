# Security & Performance Review

## Summary

서버 전용 `OPENAI_API_KEY`와 에피메랄 토큰 패턴은 적절하고, 토큰 라우트는 업스트림 실패 시 본문을 노출하지 않으며 Provider 오류는 `userFacingSttError`로 UI에 일반화된다. 레이트 리밋은 `X-Forwarded-For` 첫 주소와 인스턴스 로컬 메모리에 의존한다. **후속 수정으로** PCM 청크마다 `setState` 하던 `sttPcmFramesSent`를 제거해 메인 스레드·리렌더 부담을 줄였다.

## Security Findings

### [MEDIUM] 신뢰되지 않는 프록시에서의 `X-Forwarded-For` 기반 키

- Location: `src/lib/api/stt-token-rate-limit.ts`
- Category: auth
- Risk: 헤더 스푸핑 시 레이트 리밋 우회 가능성.
- Remediation: 신뢰 엣지 뒤에서만 운영, 필요 시 Redis 등 공유 한도.

### [MEDIUM] 서버리스 인메모리 레이트 리밋

- Location: `src/lib/api/stt-token-rate-limit.ts`, `src/app/api/stt/token/route.ts`
- Category: auth
- Risk: 인스턴스별 한도.
- Remediation: 문서(D7)에 명시된 대로 확장 시 Edge/Redis 검토.

### [LOW] 에피메랄 토큰 노출 범위(설계 수용)

- Category: auth
- Risk: TTL 내 탈취 시 악용 가능(브라우저 직연결 모델의 일반적 트레이드오프).
- Remediation: TTL·장시간 녹음 시 재발급(문서 D9).

### [LOW] 개발 모드 전사 로깅 → **조치함**

- `use-transcription`의 `console.log` 제거.

## Performance Findings

### [HIGH] OpenAI 경로 PCM 청크당 React 상태 갱신 → **조치함**

- `sttPcmFramesSent` 상태 및 `setState` 제거.

### [MEDIUM] 핫 패스 리샘플·Base64

- Category: network/CPU
- Impact: 청크마다 비용 — 필요 시 Worklet 24kHz·배치 전송 등 후속 최적화.

### [LOW] `pendingJson` 상한 256

- 메모리 폭주 완화에 유리.

## Verdict

**PASS_WITH_NOTES**
