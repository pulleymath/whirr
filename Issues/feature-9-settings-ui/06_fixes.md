# 리뷰 반영 수정 기록

## 수정 항목

### 1. 아키텍처·결정 문서 동기화 (D1 / I1 / A1)

- 심각도: MEDIUM
- 출처: 종합(구현·아키텍처 리뷰)
- 수정 내용: `docs/DECISIONS.md`에 전사 설정(Context + localStorage, SSR, 후속 연동·검증 원칙) 절 추가. `docs/ARCHITECTURE.md`에 앱 설정·`MainAppProviders` 책임 행 및 브라우저 설정 데이터 위치 보강.
- 변경 파일: `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`

### 2. OpenAI Realtime 세션 `transcription.prompt` 복구

- 심각도: HIGH (테스트·계약 회귀)
- 출처: 구현 과정에서 품질 게이트 통과를 위해 적용
- 수정 내용: `openAiGaTranscriptionSession`에서 빈 문자열 대신 `OPENAI_REALTIME_TRANSCRIPTION_PROMPT` 상수 사용.
- 변경 파일: `src/lib/stt/openai-realtime.ts`

### 3. ESLint `set-state-in-effect` (SettingsProvider hydrate)

- 심각도: MEDIUM
- 출처: Phase 6 린트
- 수정 내용: `localStorage` → 상태 동기화용 `useEffect`에 범위 `eslint-disable` 주석 명시.
- 변경 파일: `src/lib/settings/context.tsx`

## 미수정 항목 (사유 포함)

- **webSpeechApi 대칭 테스트(D3)**: `batch`와 동일 분기로 리스크가 낮아 이번 라운드에서는 생략.
- **다이얼로그 포커스 트랩·Escape·설정 버튼 `aria-disabled`(D4)**: 접근성 개선으로 가치는 있으나 스코프·디자인 시스템 정합을 위해 후속 PR로 분리.
- **batchModel/language API 검증(D2)**: Feature 10 등에서 서버로 넘기는 시점에 적용.

## 수정 후 테스트 결과

- `npm test -- --run`: 34 files, 148 passed
- `npx tsc --noEmit`, `npx eslint .`, `npx prettier --check .`, `npm run build`: 통과
