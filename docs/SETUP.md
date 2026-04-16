# 로컬 설정 (요약)

에이전트·개발자가 빠르게 스캔할 수 있도록 원칙만 적습니다. 긴 명령어 튜토리얼은 두지 않습니다.

## 런타임·패키지 매니저

- **Node.js**: 현재 **LTS** 사용. 이 프로젝트는 **Next.js 16**을 쓰므로, 지원 Node 범위는 **Next.js 공식 문서의 시스템 요구사항**(Installation / Getting Started)을 기준으로 맞춥니다.
- **패키지 매니저**: 저장소에 `package-lock.json`이 있으므로 **`npm`**을 사용합니다. (`pnpm` 등도 가능하지만, 잠금 파일 기준 권장은 npm.)

## 환경 변수

1. `.env.example`을 복사해 **`.env.local`**을 만듭니다.
2. **필수**: `OPENAI_API_KEY` — STT(음성) **토큰 API**와 녹음 후 **회의록 생성**(Chat Completions) 서버 라우트에 필요합니다. 값은 여기에 붙이지 않습니다.
3. **선택**: `ASSEMBLYAI_*`, `STT_TOKEN_RATE_LIMIT_*` 등은 `.env.example` 주석을 따릅니다.

비밀 값·실제 키는 문서나 채팅에 붙여 넣지 않습니다.

## 자주 쓰는 스크립트 (`package.json`)

| 명령            | 용도             |
| --------------- | ---------------- |
| `npm run dev`   | 개발 서버        |
| `npm run build` | 프로덕션 빌드    |
| `npm run lint`  | ESLint           |
| `npm run test`  | Vitest 일회 실행 |

(참고: `start`, `format`, `test:watch` 등도 동일 파일에 정의되어 있습니다.)

## 마이크·브라우저

- 마이크 접근은 **HTTPS** 또는 브라우저가 허용하는 **로컬 호스트**에서 안정적으로 동작하는 경우가 많다. 권한은 사이트별 설정에서 확인한다.
