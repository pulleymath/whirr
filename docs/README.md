# 프로젝트 문서 안내

이 폴더(`docs/`)는 AI 코딩 에이전트가 개발을 착수하기 전에 프로젝트의 요구사항, 시스템 구조, 기술적 결정 사항 등을 파악하기 위해 참고해야 하는 핵심 문서들이 위치한 곳입니다.
에이전트는 작업을 시작하기 전에 수행할 태스크의 성격에 맞춰 아래의 문서들을 반드시 확인하고 필요한 컨텍스트를 확보해야 합니다.
개발 완료 후 변경사항이 생기면 해당 문서도 같이 수정되어야 합니다.

## 자주 쓰는 명령

- `npm run dev` — 로컬 개발 서버
- `npm test` — Vitest 단위·구조 테스트(훅 테스트는 해당 파일의 `@vitest-environment happy-dom` 지시 사용)
- `npm run build` — 프로덕션 빌드

로컬에서 실시간 전사를 쓰려면 저장소 루트 `.env.example`을 참고해 `.env.local`에 `OPENAI_API_KEY`를 넣은 뒤 `npm run dev`로 녹음을 시작하면 된다. `/api/stt/token`은 OpenAI `transcription_sessions`로 에피메랄 토큰을 발급하며, 클라이언트 IP(프록시 헤더)당 요청 빈도 제한이 걸려 있다. 필요하면 `.env.example`의 `STT_TOKEN_RATE_LIMIT_*` 변수로 조정할 수 있다.

## 문서 목차

- **[PRD.md](./PRD.md)**
- **[ARCHITECTURE.md](./ARCHITECTURE.md)**
- **[DECISIONS.md](./DECISIONS.md)**
