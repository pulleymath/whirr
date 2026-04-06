# 리뷰 반영 수정 기록 (Phase 5 재실행)

`05_review_synthesis.md`의 HIGH·MEDIUM 권고를 반영했다.

## 수정 항목

### 1. STT 토큰 API 레이트 리밋 (HIGH — 보안)

- 심각도: HIGH
- 출처: `03_review_security.md` / `05_review_synthesis.md`
- 수정 내용: `x-forwarded-for` / `x-real-ip` 기준 클라이언트 키별 인메모리 슬라이딩 윈도우 제한. 초과 시 `429`와 `{ error: "Too many STT token requests" }`. 환경 변수 `STT_TOKEN_RATE_LIMIT_MAX`(기본 60), `STT_TOKEN_RATE_LIMIT_WINDOW_MS`(기본 600_000ms, 최소 60_000ms).
- 변경 파일: `src/lib/api/stt-token-rate-limit.ts`, `src/app/api/stt/token/route.ts`, `src/app/api/stt/token/__tests__/route.test.ts`, `src/lib/api/__tests__/stt-token-rate-limit.test.ts`, `.env.example`

### 2. 녹음 중지 시 stop → finalize 순서 통합 테스트 (HIGH — 구현)

- 심각도: HIGH
- 출처: `02_review_implementation.md` / `05_review_synthesis.md`
- 수정 내용: `recorder-stt-integration.test.tsx`에서 `vi.hoisted` 녹음 상태 + `rerender`로 “녹음 중지” 클릭 시 `callOrder`가 `["stopRecording", "finalizeStreaming"]`인지 검증.
- 변경 파일: `src/components/__tests__/recorder-stt-integration.test.tsx`

### 3. UI 오류 메시지 정규화 (MEDIUM — 보안/UX)

- 심각도: MEDIUM
- 출처: `03_review_security.md`
- 수정 내용: `userFacingSttError`로 알려진 서버/내부 코드만 매핑하고, 그 외·업스트림 원문은 노출하지 않음. AssemblyAI JSON `error` 필드는 `STT_PROVIDER_ERROR`로만 전달.
- 변경 파일: `src/lib/stt/user-facing-error.ts`, `src/hooks/use-transcription.ts`, `src/lib/stt/assemblyai.ts`, `src/hooks/__tests__/use-transcription.test.tsx`

### 4. CONNECTING 시 오디오 큐 상한 (MEDIUM — 성능)

- 심각도: MEDIUM
- 출처: `03_review_security.md`
- 수정 내용: `pendingAudio` 최대 128건, 초과 시 선입선출로 드롭.
- 변경 파일: `src/lib/stt/assemblyai.ts`

### 5. Base64 인코딩 청크 처리 (MEDIUM — 성능)

- 심각도: MEDIUM
- 출처: `03_review_security.md`
- 수정 내용: `String.fromCharCode.apply`를 8KB 청크로 나누어 문자열 연결 비용 완화.
- 변경 파일: `src/lib/stt/assemblyai.ts`

### 6. Provider 팩토리 및 문서 정합 (MEDIUM — 아키텍처)

- 심각도: MEDIUM
- 출처: `04_review_architecture.md`
- 수정 내용: `createAssemblyAiRealtimeProvider`를 `src/lib/stt/index.ts`에 두고 `useTranscription` 기본 팩토리로 사용. `ARCHITECTURE.md` §7 트리 설명 갱신.
- 변경 파일: `src/lib/stt/index.ts`, `src/hooks/use-transcription.ts`, `src/lib/stt/__tests__/types.test.ts`, `docs/ARCHITECTURE.md`

### 7. SessionTerminated·업스트림 error 단위 테스트 (MEDIUM — 구현)

- 심각도: MEDIUM
- 출처: `02_review_implementation.md`
- 수정 내용: `assemblyai.test.ts`에 `error` 필드 → `STT_PROVIDER_ERROR`, `stop` 없이 `SessionTerminated`만 수신 시 소켓 종료 검증.
- 변경 파일: `src/lib/stt/__tests__/assemblyai.test.ts`

### 8. 결정·사용자 문서 보강 (Phase 7-2)

- 수정 내용: `DECISIONS.md`에 D7(레이트 리밋)·D8(UI 오류 정규화) 추가. `docs/README.md`에 토큰 API 빈도 제한 안내.
- 변경 파일: `docs/DECISIONS.md`, `docs/README.md`

## 미수정 항목 (사유 포함)

| 항목                              | 사유                                                         |
| --------------------------------- | ------------------------------------------------------------ |
| 사용자 로그인 기반 인증           | MVP 범위 밖; 레이트 리밋으로 1차 완화                        |
| `finals` 배열 상한·가상 스크롤    | LOW; 장시간 세션 후속 이슈로 가능                            |
| API 라우트 fetch 헬퍼 분리        | LOW; 동작 변화 없음                                          |
| `TranscriptView` key 전략         | LOW                                                          |
| 완전한 전역 레이트 리밋(Redis 등) | 서버리스 인메모리 한계는 D7에 명시; 인프라 확장 시 별도 결정 |

## 수정 후 테스트 결과

- `npm test` — 14 files, 59 tests 통과
- `npx tsc --noEmit` / `npx eslint .` / `npx prettier --check .` / `npm run build` — 통과
