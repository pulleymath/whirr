---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  feature: "feature-10-batch-transcription"
  review_kind: security
---

# Security & Performance Review

## Summary

배치 전사 프록시는 MIME·용량 검증과 레이트 리밋을 두었고 API 키는 서버에만 둔 점은 적절합니다. 다만 클라이언트가 `model`을 임의로 넘길 수 있고, `file.type`만으로 형식을 신뢰하며, 본문 전체를 `formData()`로 파싱한 뒤 크기를 검사하는 순서는 남용·부하 측면에서 여지가 있습니다. 성능은 장시간 녹음 시 100ms 간격 `setInterval`로 인한 리렌더가 두드러집니다.

## Security Findings

### [HIGH] 클라이언트 지정 `model` 무제한 전달

- Location: `src/app/api/stt/transcribe/route.ts`
- Category: auth / data-handling
- Risk: 공개 `POST`에서 임의 모델 ID로 OpenAI 호출·비용 소진 가능.
- Remediation: 서버에서 허용 모델 화이트리스트 검증 및 길이 상한.

### [MEDIUM] 오디오 형식 검증이 선언 MIME에만 의존

- Location: `src/app/api/stt/transcribe/route.ts`, `stt-transcribe-constants.ts`
- Category: input-validation
- Risk: `type` 조작 시 비오디오 페이로드 전달 가능성.
- Remediation: 매직 바이트 검사 또는 문서화된 위험 수용.

### [MEDIUM] 업스트림 오류 본문을 서버 로그에 기록

- Location: `src/app/api/stt/transcribe/route.ts`
- Category: data-handling
- Risk: 오류 본문에 민감 정보 포함 시 로그 유출.
- Remediation: 프로덕션에서는 상태 코드 위주 로깅.

### [LOW] IP 기반 레이트 리밋과 `X-Forwarded-For` 신뢰

- Location: `stt-token-rate-limit.ts`, transcribe route
- Category: auth
- Risk: 신뢰할 수 없는 프록시 환경에서 한도 우회 가능성.
- Remediation: 검증된 클라이언트 IP 소스 사용.

## Performance Findings

### [MEDIUM] `formData()` 전체 파싱 후에야 크기 거절

- Location: `src/app/api/stt/transcribe/route.ts`
- Category: network / memory
- Impact: 대용량 멀티파트 파싱 비용.
- Suggestion: 플랫폼 한도·스트리밍 파서 검토.

### [MEDIUM] 녹음 중 100ms마다 `setElapsedMs`로 리렌더

- Location: `use-batch-transcription.ts`, `recorder.tsx`
- Category: rendering
- Impact: 장시간 녹음 시 빈번한 setState.
- Suggestion: 갱신 주기 완화 또는 ref 기반 표시.

### [LOW] 실시간 모드에서도 `useBatchTranscription` 항상 마운트

- Location: `recorder.tsx`
- Category: rendering / memory
- Impact: 미미한 오버헤드.
- Suggestion: 모드별 서브컴포넌트 분리 검토.

## Verdict

**PASS_WITH_NOTES** — 기본 검증·레이트 리밋·`maxDuration`은 적절. **모델 화이트리스트** 등 권장 조치 반영 권장.
