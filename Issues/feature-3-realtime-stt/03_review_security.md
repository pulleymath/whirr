# Security & Performance Review

## Summary

API 키는 서버 라우트에만 사용되며 클라이언트 번들에 포함되지 않는다. 토큰은 `/api/stt/token`을 통해서만 전달된다.

## Security Findings

### [LOW] 토큰 라우트 무분별 호출

- Location: `src/app/api/stt/token/route.ts`
- Description: 인증 없이 POST만으로 토큰을 발급하면 비용·남용 위험이 있다(MVP 범위에서는 허용 가능).
- Suggestion: 향후 사용자 인증·레이트 리밋 검토.

### [LOW] 에러 본문 일반화

- Location: `src/app/api/stt/token/route.ts`
- Description: 업스트림 실패 시 내부 상세를 노출하지 않음 — 적절함.

## Performance Findings

### [LOW] 녹음 중 PCM 전송 빈도

- Location: `src/hooks/use-recorder.ts` → `sendPcm`
- Description: Worklet 청크마다 전송 — 실시간 STT에 필요한 수준이나, 향후 배치·압축 여지는 있음.

### [PASS] 리소스 정리

- Location: `src/hooks/use-transcription.ts`, `src/lib/stt/assemblyai.ts`
- Description: 언마운트 시 `disconnect`, `stop` 타임아웃 후 `close`로 정리.

## Verdict

PASS
