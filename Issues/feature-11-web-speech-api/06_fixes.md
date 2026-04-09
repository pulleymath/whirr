# 리뷰 반영 수정 기록

## 수정 항목

### 1. `resultIndex` 루프·`start()` 실패·팩토리 throw 테스트 보강

- 심각도: HIGH (implementation / security)
- 출처: 02_review_implementation, 03_review_security
- 수정 내용: `web-speech.test.ts`에 `resultIndex`부터 순회 검증, `start()` 실패 시 `abort` 호출, `recognitionFactory` throw 시 `onError` 검증 추가. `onend` 재시작은 `queueMicrotask`와 맞춰 `Promise.resolve()`로 단언.
- 변경 파일: `src/lib/stt/__tests__/web-speech.test.ts`

### 2. `recognition.start()` 실패 시 리소스 정리

- 심각도: MEDIUM (security)
- 출처: 03_review_security
- 수정 내용: `releaseRecognitionResources`로 핸들러 해제·abort/stop을 공통화하고, 초기 `start()` 실패 `catch`에서도 동일 정리 수행.
- 변경 파일: `src/lib/stt/web-speech.ts`

### 3. `onend` 재시작을 `queueMicrotask`로 한 틱 유예

- 심각도: HIGH (performance)
- 출처: 05_review_synthesis
- 수정 내용: 동기 재귀에 가까운 `start()` 호출을 완화.
- 변경 파일: `src/lib/stt/web-speech.ts`

### 4. Web Speech 클라우드·이중 캡처 고지

- 심각도: HIGH / MEDIUM (security)
- 출처: 03_review_security, 05_review_synthesis
- 수정 내용: 설정 패널 Web Speech 모드 `hint`에 클라우드 전송 가능성 및 레벨 미터용 별도 캡처 가능성 명시.
- 변경 파일: `src/components/settings-panel.tsx`

### 5. `tokenlessProvider` JSDoc으로 Web Speech 전용 의도 명시

- 심각도: MEDIUM (architecture)
- 출처: 04_review_architecture, 05_review_synthesis
- 수정 내용: `WEB_SPEECH:` 규약 전제를 주석에 기술.
- 변경 파일: `src/hooks/use-transcription.ts`

### 6. `parseWebSpeechProviderError` 단위 테스트

- 심각도: LOW (implementation)
- 출처: 02_review_implementation
- 수정 내용: 접두 파싱 2건 추가.
- 변경 파일: `src/lib/stt/__tests__/user-facing-web-speech.test.ts`

### 7. TypeScript: Web Speech DOM 타입 보강

- 심각도: HIGH (빌드 게이트)
- 출처: `tsc --noEmit` 실패 대응
- 수정 내용: `src/types/speech-recognition.d.ts` 추가 및 `tsconfig.json` include.
- 변경 파일: `src/types/speech-recognition.d.ts`, `tsconfig.json`

### 8. 설정 패널: `useSyncExternalStore`로 브라우저 지원 여부 조회

- 심각도: MEDIUM (eslint `set-state-in-effect`)
- 출처: Phase 6 eslint
- 수정 내용: `useEffect`+`setState` 제거, 서버 스냅샷은 `true`(낙관적).
- 변경 파일: `src/components/settings-panel.tsx`

## 미수정 항목 (사유 포함)

- **onend 백오프/재시도 상한**: 이슈에서 즉시 재시작을 요구해 추가 백오프는 범위를 넓힘. `queueMicrotask`만 적용.
- **듀얼 캡처 제거(방안 B)**: 이슈에서 방안 A 채택. 문구로만 고지.

## 수정 후 테스트 결과

`npx tsc --noEmit`, `npx eslint .`, `npx prettier --check .`, `npm test -- --run`, `npm run build` 모두 통과.
