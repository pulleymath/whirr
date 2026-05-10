# 테스트 가이드

이 저장소의 단위·통합 테스트는 **Vitest**로 실행한다.

## 러너와 스크립트

| 스크립트             | 설명                              |
| -------------------- | --------------------------------- |
| `npm run test`       | 한 번 실행 후 종료 (`vitest run`) |
| `npm run test:watch` | 파일 변경 시 재실행 (`vitest`)    |
| `npm run lint`       | ESLint                            |
| `npm run typecheck`  | TypeScript 검사 (`tsc --noEmit`)  |

관련 의존성: `vitest`, `@testing-library/react`, `happy-dom`, `fake-indexeddb`.

## 환경

- **기본**: Vitest 설정에서 테스트 환경은 **Node**가 기본이다.
- **DOM이 필요한 경우**: 해당 테스트 파일에서 Vitest 환경 지시로 **happy-dom**을 쓴다(React·브라우저 API).
- **IndexedDB**: DB 관련 테스트에서는 **fake-indexeddb**로 브라우저 IndexedDB를 흉내 낸다.

즉, “전역이 항상 happy-dom”이 아니라 **Node 기본 + 필요한 파일만 happy-dom / fake-indexeddb** 조합이다.

## 테스트가 모이는 대략적인 구역

파일 단위 목록은 두지 않고, 역할별로 묶으면 다음과 같다.

- **`hooks/`** — 녹음·전사 등 훅 동작(`__tests__/` 또는 훅 파일 옆의 `*.test.ts`)
- **`components/__tests__/`** — UI 컴포넌트와 `@testing-library/react`
- **`lib/stt/`** — STT(음성·토큰·타입 등) 보조 로직
- **`lib/`** (세션 그룹핑, 텍스트 조립, 오디오, API 헬퍼 등) — 도메인·유틸
- **`lib/` 하위 `__tests__`** — IndexedDB·세션 저장과 연관된 로직
- **`app/api/` 하위 `__tests__`** — App Router API 라우트 핸들러
- **`__tests__/`** — 환경·구조·메타·계약성 등 프로젝트 전반 스모크/검증

## 완료 판단 전에 할 일

기능이나 수정이 “끝났다”고 말하기 전에 **`npm run test`**, **`npm run lint`**, **`npm run typecheck`**를 통과시키는 것을 원칙으로 한다. 로컬에서 반복 작업할 때는 `npm run test:watch`를 쓰면 된다.
