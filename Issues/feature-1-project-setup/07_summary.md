# Feature 1 — 작업 요약

## 구현된 기능

- Next.js App Router를 `src/app/` 기준으로 이전하고 메타데이터·`lang="ko"`·Whirr 랜딩 페이지를 구성함.
- `src/components`, `src/hooks`, `src/lib`, `src/types`, `src/lib/stt` 디렉터리 스캐폴드 및 `.gitkeep` 배치.
- `TranscriptionProvider` 인터페이스를 `src/lib/stt/types.ts`에 정의하고 `src/lib/stt/index.ts`에서 re-export.
- Vitest + `vitest.config.ts`의 `@` → `src` alias, `npm test` / `test:watch` 스크립트.
- 구조·환경·메타·STT 타입 계약을 검증하는 테스트(`src/__tests__/**`, `src/lib/stt/__tests__/**`).
- `.env.example`(`ASSEMBLYAI_API_KEY`) 및 `.gitignore`의 `!.env.example`.
- `docs/ARCHITECTURE.md` §8에 Vercel 연동 절차·`.env.local` 안내 보강.
- `docs/README.md`에 `npm test` 등 자주 쓰는 명령 안내.

## 주요 기술적 결정

- 경로 별칭 `@/*`를 `./src/*`로 통일해 ARCHITECTURE §7과 맞춤.
- Vitest는 `environment: "node"`와 명시적 `import { describe, expect, it } from "vitest"`로 Next `tsconfig`와 충돌을 피함.
- STT 계약은 `satisfies TranscriptionProvider` + `connect` Promise 검증으로 타입·런타임을 함께 확인.

## 테스트 커버리지

- Vitest 14케이스: 환경, 디렉터리 구조, `.env.example`, `package.json`/`tsconfig` 메타, `TranscriptionProvider`.

## 파일 변경 목록

- 신규: `src/**`, `vitest.config.ts`, `.env.example`
- 수정: `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `docs/ARCHITECTURE.md`, `docs/README.md`
- 삭제/이전: 루트 `app/` → `src/app/`(파비콘·글로벌 CSS·레이아웃 포함)

## 알려진 제한 사항

- Vercel에 실제 배포·URL 검증은 GitHub 연동 및 사용자 계정이 필요해 로컬 에이전트에서 수행하지 않음. 절차는 ARCHITECTURE §8에 문서화됨.
- ARCHITECTURE §7의 `api/stt/token`, `assemblyai` 구현체, `sessions` 페이지 등은 후속 피쳐 범위.

## 다음 단계

- Feature 2(오디오 녹음)·Feature 3(STT)에서 Provider 구현 및 API 라우트 추가.
