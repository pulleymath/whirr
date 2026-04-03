# Security & Performance Review

## Summary

비밀 키는 `.env.example` 플레이스홀더와 `.gitignore`의 `.env*` 예외 처리로 클라이언트 노출 경로가 없고, API·입력 처리가 없어 공격 면이 매우 작다. 성능 측면에서는 정적 랜딩 수준이며, 테스트의 `process.cwd()` 가정은 CI/로컬 일관성에 해당하는 주의점이다.

## Security Findings

### [LOW] Vitest가 `process.cwd()`를 리포지토리 루트로 가정함

- Location: `src/__tests__/env.test.ts`, `structure.test.ts`, `meta.test.ts`
- Category: data-handling
- Risk: 작업 디렉터리가 루트가 아니면 테스트 실패 가능. 프로덕션 노출 아님.
- Remediation: CI에서 저장소 루트에서 `npm test` 실행 유지.

### [LOW] `.env.example`에 외부 서비스 키 이름 노출

- Location: `.env.example`
- Category: data-handling
- Risk: AssemblyAI 사용 여부 추론 가능. 플레이스홀더만 있어 심각도 낮음.
- Remediation: 온보딩 의도면 유지.

## Performance Findings

### [LOW] 레이아웃에서 Google Fonts 원격 로드

- Location: `src/app/layout.tsx`
- Category: network
- Impact: `next/font/google` 최적화로 일반적으로 허용 수준.

### [LOW] 테스트에서 동기 `readFileSync` 다회 호출

- Category: storage
- Impact: 스위트 규모가 작아 미미.

## Verdict

PASS_WITH_NOTES
