# Whirr — 보안·신뢰 경계

이 문서는 **신뢰 경계와 비밀·데이터·오류 처리 원칙**만 요약한다. 구조·역할·트레이드오프는 [ARCHITECTURE.md](./ARCHITECTURE.md), [DECISIONS.md](./DECISIONS.md)를 본다.

## 비밀·환경 변수

- `OPENAI_API_KEY` 등 장기 키는 **서버 환경에만** 둔다(`.env.example` 참고). 클라이언트 번들에 포함되지 않게 한다.
- **`NEXT_PUBLIC_` 접두사를 비밀에 쓰지 않는다.** 공개 번들로 노출된다.

## 브라우저 ↔ STT

- 브라우저는 장기 API 키를 갖지 않는다. **API 라우트에서 발급한 단기(에피메랄) 자격 증명**으로 STT(WSS 등)에 연결한다. 경계 요약은 [ARCHITECTURE.md](./ARCHITECTURE.md)의 «신뢰·실행 경계»를 본다.

## 토큰 발급 API

- 토큰 발급 엔드포인트에 **속도 제한**을 둔다(클라이언트 식별 기반). 구현은 인메모리 한계를 쓸 수 있다.
- **서버리스·다 인스턴스**에서는 전역 단일 한계가 아닐 수 있다. 확장 시 중앙 저장소·엣지 정책 등 검토 — [DECISIONS.md](./DECISIONS.md) «토큰 API 보호».
- 선택 변수: `STT_TOKEN_RATE_LIMIT_MAX`, `STT_TOKEN_RATE_LIMIT_WINDOW_MS` (`.env.example`).

## 사용자에게 보이는 오류

- 업스트림(STT·공급자) **원문 오류를 UI에 그대로 노출하지 않는다.** 사용자용 문구로 정규화한다 — [DECISIONS.md](./DECISIONS.md) «UI 오류 표시».

## 오디오·텍스트·저장

- **전사 텍스트**는 클라이언트(예: IndexedDB)에 세션 단위로만 보관한다. MVP에서 앱 서버에 전사 본문을 영속 저장하지 않는다 — [PRD.md](./PRD.md), [ARCHITECTURE.md](./ARCHITECTURE.md) «데이터가 머무는 곳».
- **녹음 오디오 원본**은 앱·서버에서 장기 보관 대상이 아니다. 전사 목적 외부 전송에만 쓰이는 정신을 따른다.

## 관련 문서

- [ARCHITECTURE.md](./ARCHITECTURE.md) — 경계·데이터 위치·운영·비밀
- [DECISIONS.md](./DECISIONS.md) — STT·토큰 API·UI 오류·배포 맥락
