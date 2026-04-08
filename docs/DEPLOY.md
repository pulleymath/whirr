# Whirr — 배포 (Vercel)

이 앱은 [기술 결정](./DECISIONS.md)에 따라 **Next.js(App Router)** 를 **Vercel**에 올리고, UI와 **API 라우트**를 **한 프로젝트·한 배포**로 함께 제공한다. 비밀·토큰 발급·속도 제한 등 서버 측 요구는 [보안·운영 가이드](./SECURITY.md)와 함께 본다.

## 원칙

- **앱과 API를 같이 배포**: 프론트 페이지와 `app/api` 라우트가 동일한 Next.js 빌드·배포 단위에 포함된다. 별도 백엔드 서버를 두지 않는다는 전제와 맞는다([DECISIONS](./DECISIONS.md)).
- **환경 변수는 Vercel 프로젝트 설정에서 관리**: 대시보드에서 Production / Preview(필요 시 Development) 환경별로 값을 둔다. 아래는 **체크리스트 수준**이며, 화면 캡처 단계별 안내는 두지 않는다.
- **기본 배포에 `vercel.json` 필수 아님**: 표준 Next.js 프로젝트라면 리포지토리 연결·빌드 명령·출력 디렉터리 기본값으로 동작하는 경우가 많다. 리라이트·헤더·크론 등이 필요해지면 그때 설정을 검토한다.

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `OPENAI_API_KEY` | 예 | OpenAI API(전사·Realtime 등) 호출에 사용. **Production**에는 반드시 설정. **Preview** 브랜치/PR 미리보기에서도 API를 쓰면 동일하게 또는 별도 키로 설정한다. |
| `STT_TOKEN_RATE_LIMIT_MAX` | 아니오 | STT 토큰 발급 API의 클라이언트당 허용 횟수 상한(기본값은 코드에 정의됨). |
| `STT_TOKEN_RATE_LIMIT_WINDOW_MS` | 아니오 | 위 한도를 적용하는 시간 창(밀리초). |

기타 로컬 예시는 저장소 루트의 `.env.example`을 참고한다.

## 배포 전 체크리스트 (요약)

1. Git 리포지토리를 Vercel 프로젝트에 연결한다.
2. 프레임워크 프리셋이 Next.js로 인식되는지 확인한다.
3. **Production** 환경에 `OPENAI_API_KEY`를 설정한다.
4. Preview에서도 STT/토큰 API를 검증할 계획이면 **Preview**에 필요한 키·한도 변수를 설정한다.
5. 선택적으로 `STT_TOKEN_RATE_LIMIT_*`로 토큰 엔드포인트 부하를 조절한다.
6. 배포 후 실제 도메인에서 녹음·전사·토큰 발급 경로를 한 번씩 확인한다.

## 관련 문서

- [DECISIONS.md](./DECISIONS.md) — Vercel 배포, API 범위, 토큰 API 속도 제한 원칙
- [SECURITY.md](./SECURITY.md) — 비밀 관리·API 보호·운영 시 유의사항
