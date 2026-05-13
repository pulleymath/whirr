# Whirr

> 회의 맥락과 함께 음성을 녹음하고, 스크립트와 AI 회의록을 만든 뒤, 세션을 브라우저에만 저장하는 로컬 우선 회의 노트 앱.

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)](https://www.typescriptlang.org)
[![Vitest](https://img.shields.io/badge/Vitest-4-6e9f18)](https://vitest.dev)

Whirr는 “녹음 파일을 어딘가에 올려두고 나중에 정리하는” 도구가 아닙니다. 회의 전에 제목, 참석자, 주제, 키워드, 요약 형식을 적어 두고, 녹음이 끝나면 그 맥락까지 포함해 스크립트와 AI 회의록을 자동으로 만듭니다.

저장은 브라우저 안에서 끝납니다. 앱 서버는 API 키를 숨기고 전사·요약 요청을 중계하는 최소 경계만 맡습니다.

## 무엇을 할 수 있나요?

- **회의 전 맥락 입력**: 노트 제목, 참석자, 주제, 키워드, 요약 형식을 녹음 전에 적어 둡니다.
- **녹음 후 일괄 전사**: 안정적인 저장·요약 흐름을 위해 기본 제품 경로는 녹음 후 일괄 처리입니다.
- **AI 회의록 생성**: 스크립트와 사용자가 적은 맥락을 바탕으로 회의록을 생성합니다.
- **로컬 세션 히스토리**: 제목, 스크립트, 요약, 회의 맥락을 IndexedDB에 세션 단위로 저장합니다.
- **상세 보기와 재생성**: 저장된 세션에서 스크립트와 맥락을 고치고 요약을 다시 만들 수 있습니다.
- **오디오 다운로드**: 브라우저에 남아 있는 녹음 세그먼트가 있으면 ZIP으로 내려받을 수 있습니다.
- **개발용 STT 경로**: 실시간 STT, Web Speech 계열은 교체 가능성을 위해 개발·대체 경로로 유지합니다.

## 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

이 저장소는 `package-lock.json`을 기준으로 `npm`을 권장합니다.

### 2. 환경 변수 준비

```bash
cp .env.example .env.local
```

`.env.local`에 서버 전용 OpenAI 키를 넣습니다.

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

선택 환경 변수는 `.env.example`의 주석을 따릅니다. 실제 키는 문서, 이슈, 채팅에 붙여 넣지 마세요.

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다. 마이크 권한은 HTTPS 또는 브라우저가 허용하는 로컬 호스트에서 안정적으로 동작합니다.

## 자주 쓰는 명령

| 명령                   | 설명                               |
| ---------------------- | ---------------------------------- |
| `npm run dev`          | 개발 서버를 실행합니다.            |
| `npm run build`        | 프로덕션 빌드를 만듭니다.          |
| `npm run start`        | 빌드 결과를 실행합니다.            |
| `npm run lint`         | ESLint를 실행합니다.               |
| `npm run typecheck`    | TypeScript 타입 검사를 실행합니다. |
| `npm run test`         | Vitest 테스트를 한 번 실행합니다.  |
| `npm run test:watch`   | Vitest를 watch 모드로 실행합니다.  |
| `npm run format`       | Prettier로 전체 포맷을 적용합니다. |
| `npm run format:check` | Prettier 포맷만 검사합니다.        |

## 제품 흐름

1. 사용자가 제목, 참석자, 주제, 키워드, 요약 형식을 필요하면 먼저 채웁니다.
2. 홈 화면의 녹음 카드에서 녹음을 시작하고 종료합니다.
3. Whirr가 스크립트 변환을 진행한 뒤 AI 회의록 생성을 요청합니다.
4. 완료된 세션은 브라우저 IndexedDB에 저장됩니다.
5. History에서 날짜별 목록을 열고 세션 상세로 다시 들어갑니다.
6. 필요하면 스크립트, 회의 맥락, 요약 형식을 고친 뒤 현재 세션 또는 새 세션으로 요약을 재생성합니다.

자세한 화면별 흐름은 [`docs/USER_FLOWS.md`](./docs/USER_FLOWS.md)를 참고하세요.

## 데이터와 보안 경계

Whirr의 기본 원칙은 단순합니다.

- **브라우저**: UI, 마이크 캡처, 로컬 세션 저장·조회, 사용자 설정을 담당합니다.
- **호스팅 앱**: 장기 API 키를 숨기고 전사·요약 요청을 검증해 외부 AI 서비스와 연결합니다.
- **외부 AI 서비스**: 오디오 전사와 요약 생성을 처리합니다.
- **로컬 저장소**: 제목, 스크립트, 요약, 노트 맥락을 세션 단위로 보관합니다.
- **서버 비저장**: MVP에서 사용자 스크립트·요약 본문을 앱 서버에 영속 저장하지 않습니다.
- **비밀 보호**: `OPENAI_API_KEY` 같은 장기 키는 서버 환경에만 둡니다. 비밀에는 `NEXT_PUBLIC_` 접두사를 쓰지 않습니다.

외부 서비스와 맞닿는 API에는 클라이언트 식별 기반 속도 제한을 둡니다. 서버리스 환경에서는 인스턴스별 메모리 한계가 있으므로, 트래픽이 커지면 중앙 저장소나 플랫폼 정책으로 이전하는 것을 검토합니다.

## 기술 스택

- **Next.js App Router**: 페이지, 레이아웃, 최소 API 라우트를 한 리포지토리에서 다룹니다.
- **React 19**: 홈 작업면, 녹음 카드, 세션 상세, 편집 모달 등 UI를 구성합니다.
- **TypeScript**: 앱 코드와 테스트 전반의 타입 경계를 맞춥니다.
- **IndexedDB (`idb`)**: 세션과 로컬 데이터를 브라우저에 저장합니다.
- **OpenAI API**: 기본 STT·회의록 요약 경로에서 사용합니다.
- **Vitest + Testing Library**: 훅, 컴포넌트, API Route, IndexedDB 관련 로직을 검증합니다.
- **Vercel 또는 동급 호스팅**: 프론트와 API Route를 같은 배포 단위로 제공합니다.

## 프로젝트 구조

```text
src/
  app/                 Next.js App Router 페이지, 레이아웃, API Route
  components/          홈, 녹음기, 세션 목록·상세·편집 모달 등 화면 컴포넌트
  hooks/               마이크 녹음, 전사, unload 보호 등 클라이언트 훅
  lib/                 IndexedDB, 오디오, 세션 텍스트, 날짜 그룹, 도메인 유틸
  lib/api/             API Route에서 쓰는 레이트 리밋과 서버 보조 로직
  lib/glossary/        전역 용어·세션 컨텍스트 타입과 클라이언트 Context
  lib/stt/             STT Provider 구현, 타입, 사용자용 오류 매핑
  types/               Web Speech API 등 환경 보강용 타입 선언
```

디렉터리별 책임은 [`docs/CODEMAP.md`](./docs/CODEMAP.md)에 더 짧게 정리되어 있습니다.

## 문서 지도

루트 README는 사람을 위한 시작점입니다. `docs/`는 제품·구조·운영·개발 관행을 주제별로 나눕니다.

| 문서                                                   | 언제 보나요?                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| [`docs/PRD.md`](./docs/PRD.md)                         | 제품 목표, MVP 범위, 비목표를 확인할 때                            |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)       | 브라우저, 호스팅 앱, 외부 AI 서비스의 경계를 볼 때                 |
| [`docs/DECISIONS.md`](./docs/DECISIONS.md)             | STT 경로, 백엔드 범위, 배포, 오류 표시 같은 결정 이유를 볼 때      |
| [`docs/USER_FLOWS.md`](./docs/USER_FLOWS.md)           | 홈, 녹음, 자동 요약, 상세, 편집, 설정 흐름을 확인할 때             |
| [`docs/SETUP.md`](./docs/SETUP.md)                     | 로컬 실행 전제, 환경 변수, npm 스크립트를 볼 때                    |
| [`docs/DEPLOY.md`](./docs/DEPLOY.md)                   | Vercel 배포와 프로덕션 환경 변수 체크리스트가 필요할 때            |
| [`docs/SECURITY.md`](./docs/SECURITY.md)               | 비밀, 레이트 리밋, 오류 노출, 데이터 저장 경계를 점검할 때         |
| [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md) | STT·요약 실패, 마이크 권한, IndexedDB, 빌드 실패를 좁힐 때         |
| [`docs/CODEMAP.md`](./docs/CODEMAP.md)                 | 어디를 고치면 되는지 빠르게 찾을 때                                |
| [`docs/CONVENTIONS.md`](./docs/CONVENTIONS.md)         | 포맷, 린트, 파일 이름, import, 테스트 배치 규칙을 볼 때            |
| [`docs/DESIGN.md`](./docs/DESIGN.md)                   | 색, 타이포, 간격, 라운드의 의도를 확인할 때                        |
| [`docs/UI_PATTERNS.md`](./docs/UI_PATTERNS.md)         | 카드, 버튼, 상태 표시, 토스트, 접근성 패턴을 볼 때                 |
| [`docs/TESTING.md`](./docs/TESTING.md)                 | 테스트 환경과 완료 전 검증 기준을 볼 때                            |
| [`docs/GLOSSARY.md`](./docs/GLOSSARY.md)               | IndexedDB, 세션, STT Provider, 에피메랄 토큰 같은 용어를 확인할 때 |

## 개발 원칙

- 구현을 바꾸면 관련 문서도 같이 바꿉니다.
- 사용자에게 보이는 STT·서버 오류는 업스트림 원문 대신 안전한 한국어 문구로 정규화합니다.
- React 컴포넌트·뷰 파일은 `kebab-case`를 씁니다.
- import는 파일 상단에 둡니다.
- 새 테스트는 가능하면 검증 대상과 같은 트리의 `__tests__/`에 둡니다.
- 기능 완료를 말하기 전에 `npm run test`, `npm run lint`, `npm run typecheck`를 통과시키는 것을 원칙으로 합니다.

## 배포

Vercel 또는 동급 플랫폼에 Next.js 앱과 API Route를 같은 프로젝트로 배포합니다. 기본 Next.js 배포에는 별도 `vercel.json`이 필요하지 않을 수 있습니다.

프로덕션에는 최소한 `OPENAI_API_KEY`가 필요합니다. 선택적으로 `STT_TOKEN_RATE_LIMIT_*`, `MEETING_MINUTES_RATE_LIMIT_*`로 API별 한도를 조절할 수 있습니다.

자세한 체크리스트는 [`docs/DEPLOY.md`](./docs/DEPLOY.md)를 참고하세요.

## 현재 범위

Whirr는 MVP 기준으로 단일 사용자, 로그인 없음, 데스크톱 브라우저 중심, 한국어 회의 맥락을 전제로 합니다.

아직 목표가 아닌 것들:

- 서버 텍스트 저장
- 다중 사용자·계정
- 모바일 최적화
- 다국어 자동 감지
- 세션 삭제, 공유, 검색, 피드백 루프

후속 방향은 [`docs/PRD.md`](./docs/PRD.md)에 유지합니다.
