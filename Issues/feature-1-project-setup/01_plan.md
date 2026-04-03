# Feature 1 — 개발 계획서

## 개발 범위

Next.js 프로젝트를 ARCHITECTURE.md에 정의된 `src/` 기반 디렉토리 구조로 마이그레이션하고, TDD를 위한 Vitest 테스트 환경을 구성하며, STT 엔진 교체에 대비한 `TranscriptionProvider` 추상화 인터페이스를 정의한다. 환경 변수 템플릿(`.env.example`)을 작성하고, Vercel 배포를 위한 설정을 문서화한다.

**변경 대상 요약:**

| 영역 | 내용 |
| --- | --- |
| 테스트 환경 | Vitest 설치 및 설정 |
| 디렉토리 구조 | `app/` → `src/app/` 마이그레이션, `src/{components,hooks,lib,types}` 생성 |
| TypeScript 설정 | `tsconfig.json` path alias를 `src/` 기준으로 갱신 |
| STT 추상화 | `src/lib/stt/types.ts`에 `TranscriptionProvider` 인터페이스 정의 |
| 환경 변수 | `.env.example` 템플릿 작성 |
| 배포 | Vercel 배포 절차 문서화 |

## 기술적 접근 방식

1. **Vitest**: Next.js + TypeScript에서 ESM 네이티브 지원, 빠른 실행.
2. **`src/` 마이그레이션**: 루트 `app/`에서 `src/app/`으로 이동, `tsconfig.json`의 `paths`를 `./src/*`로 갱신.
3. **TranscriptionProvider**: ARCHITECTURE.md §2.1 시그니처를 `src/lib/stt/types.ts`에 반영. `satisfies` 기반 타입 검증 테스트.
4. **TDD**: RED → GREEN → REFACTOR.

## TDD 구현 순서

### Step 1: Vitest 테스트 환경 구성

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/__tests__/setup.test.ts`
- 테스트 케이스: vitest 실행, TypeScript 동작 확인

**GREEN** — 최소 구현

- `vitest.config.ts`, `package.json`에 `test` 스크립트 및 `vitest` devDependency

**REFACTOR**

- `tsconfig.json`에 `vitest/globals` 타입

### Step 2: `src/` 디렉토리 마이그레이션 및 구조 생성

**RED** — `src/__tests__/structure.test.ts`로 파일/디렉토리 존재 검증

**GREEN** — `src/app/*` 이동, 플레이스홀더 디렉토리, 루트 `app/` 제거, `tsconfig` paths 갱신

**REFACTOR** — `page.tsx` 최소 랜딩, `npm run build` 확인

### Step 3: TranscriptionProvider 인터페이스

**RED** — `src/lib/stt/__tests__/types.test.ts`

**GREEN** — `src/lib/stt/types.ts`, `src/lib/stt/index.ts`

**REFACTOR** — JSDoc, 배럴 export

### Step 4: 환경 변수 템플릿

**RED** — `src/__tests__/env.test.ts`

**GREEN** — `.env.example`, `.gitignore`에 `!.env.example`

**REFACTOR** — 주석 보강

### Step 5: Vercel 배포 문서화

**GREEN** — `docs/ARCHITECTURE.md` §8 보충, `npm run build` 검증

### Step 6: 메타데이터 검증

**RED** — `src/__tests__/meta.test.ts`

## 파일 변경 계획

신규: `vitest.config.ts`, `src/app/*`, `src/lib/stt/types.ts`, `index.ts`, 테스트 파일들, `.env.example`, `.gitkeep`들.

수정: `package.json`, `tsconfig.json`, `.gitignore`, `docs/ARCHITECTURE.md`.

삭제: 루트 `app/` 하위 파일.

## 완료 조건

- `npm test`, `npm run build` 통과
- `src/lib/stt/types.ts`에 `TranscriptionProvider` 정의
- `.env.example`에 `ASSEMBLYAI_API_KEY`, `NEXT_PUBLIC_` 없음
- `@/*` → `./src/*`

## 테스트 전략

Vitest + `node:fs` 구조/파일 검증, `satisfies TranscriptionProvider` 타입 계약 검증, 빌드 CLI 검증.
