# 코드 컨벤션

이 저장소는 **TypeScript**와 **Next.js App Router**를 사용한다.

## 포맷·린트

- `npm run format` — Prettier로 저장소 전체 포맷 적용
- `npm run format:check` — 포맷 검사만 수행
- `npm run lint` — ESLint 실행

설정 파일: 루트의 `eslint.config.mjs`, `.prettierignore`(내용은 여기에 인용하지 않음).

## 파일·이름

- React 컴포넌트·뷰 파일은 **kebab-case** (`recorder.tsx`, `session-list.tsx` 등).

## import

- **모든 import는 파일 상단**에 둔다. 동적·인라인 import로 우회하지 않는다(Cursor/팀 규칙과 동일한 방향).

## STT 오류 메시지

- 업스트림·서버 원문을 UI에 그대로 노출하지 않는다. 알려진 코드만 안전하게 매핑하고, 나머지는 일반화된 사용자 메시지로 보여 준다. STT 모듈의 사용자용 오류 매핑 함수로 일관되게 처리한다.

## 테스트

- Vitest 사용(`npm run test`).
- **일반**: 검증 대상 모듈과 같은 트리 안의 `__tests__/`에 둔다(컴포넌트·훅·API 등).
- **예외**: 소스 파일과 **같은 디렉터리**에 `*.test.ts`를 두는 경우도 허용된다(예: 일부 훅). 새 테스트는 가능하면 `__tests__/` 쪽 패턴에 맞춘다.
