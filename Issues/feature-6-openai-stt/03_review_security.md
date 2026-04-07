# 성능 및 보안 리뷰 (요약)

- **API 키**: `OPENAI_API_KEY`는 서버 Route에만 존재; 브라우저는 에피메랄 `client_secret`만 수신.
- **레이트 리밋**: 기존 IP/프록시 키 기반 인메모리 제한 유지.
- **리스크**: 서브프로토콜 `openai-insecure-api-key.*` 명칭은 OpenAI 문서 명세이나, 토큰이 WebSocket 핸드셰이크에 노출되므로 HTTPS 페이지·짧은 TTL 전제가 필요함(공급자 설계).
