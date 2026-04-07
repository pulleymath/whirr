# 리뷰 반영 수정 기록

## 수정 항목

### 1. 토큰 라우트 단위 테스트를 OpenAI 업스트림에 맞게 갱신

- 심각도: HIGH (CI 실패 방지)
- 출처: 구현 직후 `npm test` 실패
- 수정 내용: `OPENAI_API_KEY`, `transcription_sessions`, `client_secret` 응답 모킹으로 교체
- 변경 파일: `src/app/api/stt/token/__tests__/route.test.ts`

## 미수정 항목 (사유 포함)

- `assemblyai.ts`의 unused 경고: 레거시 유지 파일로 본 피쳐 범위에서 제외

## 수정 후 테스트 결과

`npm test` 전부 통과(로컬 실행).
