# Feature 12: STT 세션 장시간 사용 시 안정성 개선

## 1. 개요

장시간 회의 녹음·전사 시 **업스트림 세션 제한에 의한 예기치 않은 중단**을 방지하고, 중단이 발생하더라도 **데이터 손실 없이 복구**할 수 있는 메커니즘을 추가한다.

### 배경

OpenAI Realtime Transcription API는 **WebSocket 세션당 최대 60분** 제한이 있다. 60분 도달 시 서버가 `error` 이벤트를 전송하며, 현재 코드는 이를 일반 에러로 처리해 전사를 종료한다. 사용자는 왜 전사가 끊겼는지 알기 어렵고, 그동안의 전사 결과는 보존되지만 이어서 녹음을 계속할 방법이 없다.

```
[browser] [transcription] provider error: Error: Your session hit the maximum duration of 60 minutes.
    at OpenAIRealtimeProvider.handleIncomingMessage (src/lib/stt/openai-realtime.ts:265:15)
```

이 문제는 OpenAI Realtime에만 국한되지 않는다. 모든 전사 경로에서 장시간 사용 시 유사한 중단 시나리오가 존재한다.

### 프로바이더별 현황 분석

| 전사 방식                | 세션 제한                             | 현재 대응                                             | 장시간 사용 시 위험                                                                   |
| ------------------------ | ------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **OpenAI Realtime**      | 서버 정책 60분                        | `onError` → 에러 메시지 표시 → `disconnectProvider()` | **높음** — 60분 세션 만료 시 전사 중단, 재연결 없음                                   |
| **AssemblyAI Streaming** | 서버 정책에 따름 (close code 3007 등) | `onError` → 에러 메시지 표시 → `disconnectProvider()` | **중간** — 세션 종료 시 전사 중단, 재연결 없음                                        |
| **Web Speech API**       | 브라우저/OS 구현 의존                 | `onend`에서 자동 `recognition.start()` 재시작         | **낮음** — 자동 재시작이 있으나, 백그라운드 탭 제한·권한 해제 등으로 재시작 실패 가능 |
| **녹음 후 전사 (Batch)** | 클라이언트 측 60분 하드 리밋          | 55분 경고 + 60분 자동 중지·전사                       | **낮음** — 시간 제한이 이미 구현되어 있음. 단, 전사 API 호출 실패 시 재시도 없음      |

### 공통 문제

1. **WebSocket 기반 프로바이더(OpenAI Realtime, AssemblyAI)**: `ws.onclose` 이벤트에서 `onError` 콜백이 호출되지 않는다. 서버가 에러 이벤트 없이 연결만 끊으면 사용자는 아무 피드백 없이 전사가 멈추는 것을 경험한다.
2. **에러 메시지 미매핑**: OpenAI의 `"Your session hit the maximum duration of 60 minutes."` 같은 세션 만료 메시지가 `userFacingSttError`에서 `default` 케이스로 처리되어 원인을 알 수 없는 일반 에러 문구가 표시된다.
3. **자동 복구 부재**: `use-transcription.ts`에서 모든 에러는 `disconnectProvider()`로만 처리된다. 복구 가능한 에러(세션 만료, 일시적 네트워크 끊김)와 복구 불가능한 에러(인증 실패, 서비스 미설정)를 구분하지 않는다.

### 참고 자료

- [OpenAI Realtime API — Session lifecycle](https://platform.openai.com/docs/guides/realtime)
- [AssemblyAI Streaming — Error handling](https://www.assemblyai.com/docs/streaming)

### 선행 작업

- Feature 3 (실시간 STT) — 실시간 전사 인프라
- Feature 6 (OpenAI STT) — OpenAI Realtime Provider
- Feature 10 (배치 전사) — 녹음 후 전사
- Feature 11 (Web Speech API) — 브라우저 내장 전사

## 2. 상세 기획 (Detailed Plan)

### 2.1 세션 만료 선제 감지 및 자동 재연결 (OpenAI Realtime)

**파일**: `src/lib/stt/openai-realtime.ts`, `src/hooks/use-transcription.ts`

OpenAI Realtime 세션이 60분 제한에 걸리기 **전에** 능동적으로 재연결한다.

#### 타이머 기반 선제 재연결

- `connect()` 시점부터 경과 시간을 추적한다.
- **55분** 경과 시 현재 WebSocket을 정상 종료(`stop()`)하고, 새 토큰을 발급받아 새 WebSocket을 연결한다.
- 재연결 사이 짧은 공백(1–3초)이 발생하나, 이미 확정된 전사(`finals`)는 보존되며 부분 전사(`partial`)만 유실될 수 있다.

#### 훅 레벨 재연결 오케스트레이션

`use-transcription.ts`에서 Provider 에러를 분류하여 재연결 여부를 결정한다.

- **재연결 가능**: 세션 만료, 일시적 네트워크 끊김, 서버 과부하(429)
- **재연결 불가**: 인증 실패, API 키 미설정, 서비스 미구성

재연결 시:

1. 기존 Provider를 `disconnect()`
2. 새 토큰을 `fetchToken()`으로 발급
3. 새 Provider를 생성하여 `connect()`
4. 기존 `finals` 배열은 그대로 유지 (UI에서 이전 전사가 사라지지 않음)
5. 최대 재연결 횟수 제한 (예: 3회) — 초과 시 사용자에게 수동 재시작 안내

### 2.2 WebSocket `onclose` 에러 감지 보강

**파일**: `src/lib/stt/openai-realtime.ts`, `src/lib/stt/assemblyai.ts`

현재 두 WebSocket Provider의 `ws.onclose`는 `stopResolver` 처리만 하고, 사용자에게 에러를 알리지 않는다. 사용자가 `stop()`을 호출하지 않았는데 연결이 끊긴 경우(서버 측 종료, 네트워크 끊김 등) `onError`를 호출하도록 보강한다.

```
ws.onclose = (event) => {
  // 정상 종료(사용자가 stop() 호출)가 아닌 경우 에러로 보고
  if (!userInitiatedClose) {
    onError(new Error("SESSION_EXPIRED_OR_DISCONNECTED"));
  }
};
```

`stopResolver`가 설정되어 있으면(= `stop()` 호출로 인한 종료) 에러를 보고하지 않는다.

### 2.3 세션 만료 에러 메시지 매핑

**파일**: `src/lib/stt/user-facing-error.ts`

세션 만료·연결 끊김 관련 에러 메시지를 사용자 친화적 문구로 매핑한다.

| 내부 메시지                                              | 사용자 문구                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| `"Your session hit the maximum duration of 60 minutes."` | "세션 시간(60분)이 만료되었습니다. 자동으로 재연결합니다."  |
| `"SESSION_EXPIRED_OR_DISCONNECTED"`                      | "음성 인식 연결이 끊어졌습니다. 자동으로 재연결합니다."     |
| (자동 재연결 실패 시)                                    | "음성 인식 연결이 끊어졌습니다. 녹음을 다시 시작해 주세요." |

자동 재연결이 활성화된 상태에서는 에러 메시지를 **토스트**로 잠깐 보여준 뒤 자동으로 사라지게 하고, 재연결에 실패한 경우에만 **영구 에러 메시지**를 표시한다.

### 2.4 AssemblyAI 세션 만료 대응

**파일**: `src/lib/stt/assemblyai.ts`

AssemblyAI도 OpenAI와 동일한 패턴을 적용한다.

- `ws.onclose`에서 비정상 종료 감지 → 에러 보고
- `use-transcription.ts`의 재연결 오케스트레이션이 AssemblyAI Provider에도 동일하게 적용됨 (인터페이스가 같으므로 훅 레벨 변경만으로 충분)

### 2.5 Web Speech API 재시작 실패 대응

**파일**: `src/lib/stt/web-speech.ts`

현재 자동 재시작(`onend` → `recognition.start()`)이 실패하는 경우를 감지하지 않는다.

- `recognition.start()` 호출이 예외를 던지면 `onError`를 호출하도록 보강한다.
- 연속 재시작 실패 횟수를 추적하여, 3회 이상 실패 시 재시작을 중단하고 사용자에게 알린다.
- 브라우저 탭이 백그라운드로 전환되었을 때의 제한은 현 단계에서 대응하지 않되, 포그라운드 복귀 시 재시작을 시도한다.

### 2.6 배치 전사 실패 시 재시도

**파일**: `src/hooks/use-batch-transcription.ts`

현재 전사 API 호출이 실패하면 에러 상태로 전환되고 끝난다. 녹음 Blob은 이미 해제되어 재시도가 불가능하다.

- **Blob 참조 유지**: 전사가 성공하거나 사용자가 명시적으로 폐기할 때까지 Blob 참조를 유지한다.
- **수동 재시도 UI**: 에러 상태에서 "다시 시도" 버튼을 제공한다.
- **자동 재시도**: 네트워크 에러(fetch 실패, 5xx 응답) 시 최대 2회까지 지수 백오프(2초, 4초)로 자동 재시도한다. 4xx 에러(파일 크기 초과, 인증 실패 등)는 재시도하지 않는다.

### 2.7 사용자 세션 경과 시간 표시 개선

**파일**: `src/components/recorder.tsx`

실시간 전사 모드에서도 세션 경과 시간을 표시한다. (현재 배치 모드에서만 표시)

- 55분 경과 시 "세션이 곧 갱신됩니다" 안내를 표시한다 (자동 재연결이 구현된 경우).
- 자동 재연결이 없는 경우, "녹음 시간이 길어지고 있습니다. 전사가 중단될 수 있습니다." 경고를 표시한다.

### 2.8 테스트

- `src/lib/stt/__tests__/openai-realtime-reconnect.test.ts`
  - 55분 타이머 만료 시 WebSocket 재연결 동작 검증
  - 서버 `error` 이벤트(세션 만료) 수신 시 재연결 트리거 검증
  - 재연결 중 기존 `finals` 보존 검증
  - 최대 재연결 횟수 초과 시 에러 전파 검증

- `src/lib/stt/__tests__/assemblyai-onclose.test.ts`
  - 비정상 종료 시 `onError` 호출 검증
  - 정상 종료(`stop()` 호출) 시 `onError` 미호출 검증

- `src/lib/stt/__tests__/web-speech-restart-failure.test.ts`
  - `recognition.start()` 예외 시 `onError` 호출 검증
  - 연속 재시작 실패 3회 시 재시작 중단 검증

- `src/hooks/__tests__/use-batch-transcription-retry.test.ts`
  - 5xx 에러 시 자동 재시도 동작 검증
  - 4xx 에러 시 재시도 미시도 검증
  - Blob 참조 유지 및 수동 재시도 검증

- `src/lib/stt/__tests__/user-facing-error-session.test.ts`
  - 세션 만료 메시지 매핑 검증

### 2.9 문서 업데이트

- `docs/DECISIONS.md`: 세션 재연결 전략 결정 기록 (55분 선제 재연결, 재시도 정책)
- `docs/ARCHITECTURE.md`: 전사 복원력(resilience) 레이어 추가
- `docs/TROUBLESHOOTING.md`: "세션 시간 만료" 증상 및 대응 추가

## 3. 완료 조건 (Done Criteria)

- [ ] OpenAI Realtime 세션이 55분 경과 시 자동으로 재연결되고, 기존 전사 결과가 보존된다.
- [ ] 서버가 60분 세션 만료 에러를 보내면 자동 재연결을 시도한다.
- [ ] WebSocket 비정상 종료 시(OpenAI, AssemblyAI 모두) 사용자에게 에러가 표시된다.
- [ ] 세션 만료 관련 에러 메시지가 사용자 친화적 한국어 문구로 표시된다.
- [ ] 자동 재연결 중에는 일시적 상태 안내가 표시되고, 실패 시 영구 에러 메시지가 표시된다.
- [ ] 최대 재연결 횟수(3회)를 초과하면 수동 재시작을 안내한다.
- [ ] Web Speech API 재시작 실패 시 에러가 보고되고, 연속 실패 시 재시작이 중단된다.
- [ ] 배치 전사 실패 시 Blob이 보존되어 재시도가 가능하다 (자동 2회 + 수동 재시도 버튼).
- [ ] 실시간 전사 모드에서 세션 경과 시간이 표시된다.
- [ ] 모든 단위 테스트가 통과한다.
- [ ] 기존 전사 기능(실시간, 배치, Web Speech)이 정상 동작한다.
