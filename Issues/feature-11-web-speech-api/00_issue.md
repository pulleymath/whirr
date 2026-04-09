# Feature 11: Web Speech API 전사 지원

## 1. 개요

브라우저 내장 **Web Speech API** (`SpeechRecognition`)를 사용하는 전사 모드를 추가한다. 외부 API 키나 서버 없이 **브라우저만으로** 음성을 텍스트로 변환할 수 있어, API 비용 없이 간단한 전사가 가능하다. 다만 인식 정확도와 기능(다화자 구분, 노이즈 리덕션 등)은 외부 STT 대비 제한적이므로, 기존 전사 방식과 **병존하는 추가 옵션**으로 제공한다.

### 배경

- Web Speech API는 Chrome, Edge, Safari 등 주요 브라우저에서 지원되며, **무료**로 사용할 수 있다.
- 별도 API 키 설정 없이 바로 사용 가능해, **초기 설정 부담이 없다**.
- 실시간 전사(`interim` 결과)를 지원하므로, 현재 `TranscriptionProvider` 인터페이스의 `onPartial`/`onFinal` 콜백 구조에 자연스럽게 매핑된다.
- 단, 브라우저/OS에 따라 인식 품질이 다르고, 오프라인에서는 동작하지 않을 수 있으며(Chrome은 서버 전송), 연속 인식 시 간헐적으로 끊길 수 있다.

### 참고 자료

- [Web Speech API — SpeechRecognition (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [Web Speech API 브라우저 호환성 (Can I Use)](https://caniuse.com/speech-recognition)

### 선행 작업

- Feature 9 (설정 인프라 및 UI) — 설정 Context와 모드 선택 UI가 구현되어 있어야 한다.

## 2. 상세 기획 (Detailed Plan)

### 2.1 Web Speech API Provider 구현

**파일**: `src/lib/stt/web-speech.ts` (신규)

`TranscriptionProvider` 인터페이스를 구현하는 `WebSpeechProvider` 클래스를 작성한다.

```ts
class WebSpeechProvider implements TranscriptionProvider {
  connect(
    onPartial: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (error: Error) => void,
  ): Promise<void>;

  sendAudio(pcmData: ArrayBuffer): void; // no-op (브라우저가 직접 마이크를 캡처)
  stop(): Promise<void>;
  disconnect(): void;
}
```

#### SpeechRecognition 설정

```ts
const recognition = new (
  window.SpeechRecognition || window.webkitSpeechRecognition
)();
recognition.continuous = true; // 연속 인식 모드
recognition.interimResults = true; // 중간 결과 수신
recognition.lang = "ko-KR"; // 설정에서 받은 언어 코드
recognition.maxAlternatives = 1; // 첫 번째 대안만 사용
```

#### 이벤트 매핑

| SpeechRecognition 이벤트 | TranscriptionProvider 콜백 | 설명                                                                                                                                    |
| ------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `onresult` (interim)     | `onPartial(text)`          | `results[i].isFinal === false`인 결과의 transcript                                                                                      |
| `onresult` (final)       | `onFinal(text)`            | `results[i].isFinal === true`인 결과의 transcript                                                                                       |
| `onerror`                | `onError(error)`           | 에러 메시지를 사용자 친화적으로 변환                                                                                                    |
| `onend`                  | (자동 재시작)              | `continuous` 모드에서도 브라우저가 임의로 종료할 수 있으므로, 아직 `stop()`이 호출되지 않았다면 자동으로 `recognition.start()`를 재호출 |

#### `onresult` 처리 로직 상세

```ts
recognition.onresult = (event: SpeechRecognitionEvent) => {
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    const transcript = result[0].transcript;
    if (result.isFinal) {
      onFinal(transcript);
    } else {
      onPartial(transcript);
    }
  }
};
```

#### `sendAudio` — No-op 처리

Web Speech API는 **브라우저가 직접 마이크를 캡처**한다. 기존 `AudioWorklet` PCM 파이프라인의 오디오 데이터를 받을 필요가 없다. `sendAudio`는 빈 함수로 구현한다.

이는 기존 `TranscriptionProvider` 인터페이스와의 호환성을 유지하면서도, Web Speech API의 마이크 캡처 메커니즘을 존중하는 설계다.

#### 자동 재시작 메커니즘

Chrome의 SpeechRecognition은 `continuous: true`에서도 약 60초 후 또는 긴 침묵 후 자동으로 `onend`를 발생시킬 수 있다. 녹음이 진행 중인 상태(`stop()`이 호출되지 않은 상태)라면 `onend`에서 자동으로 `recognition.start()`를 재호출하여 인식을 이어간다.

```ts
recognition.onend = () => {
  if (!this.stopped) {
    recognition.start(); // 자동 재시작
  }
};
```

재시작 간 짧은 공백(~0.5초)이 발생할 수 있으나, 회의 전사 목적에서는 허용 가능한 수준이다.

### 2.2 브라우저 호환성 검사

**파일**: `src/lib/stt/web-speech.ts` (같은 파일)

```ts
function isWebSpeechApiSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}
```

- Feature 9의 설정 패널에서 Web Speech API 옵션 옆에 브라우저 미지원 시 "(이 브라우저에서 지원되지 않습니다)" 문구를 표시하고 선택을 비활성화한다.
- 이미 `webSpeechApi` 모드가 선택된 상태에서 미지원 브라우저로 접근 시, `Recorder`에서 에러 메시지를 표시하고 녹음을 시작하지 않는다.

### 2.3 Provider 팩토리 등록

**파일**: `src/lib/stt/index.ts`

```ts
export { WebSpeechProvider, isWebSpeechApiSupported } from "./web-speech";

export function createWebSpeechProvider(
  language?: string,
): TranscriptionProvider {
  return new WebSpeechProvider(language);
}
```

- Web Speech API는 토큰이 필요 없으므로, 팩토리 함수의 시그니처가 기존과 다르다 (token 대신 language).
- `useTranscription` 훅 또는 `Recorder`에서 `mode === 'webSpeechApi'`일 때 이 팩토리를 사용한다.

### 2.4 Recorder 컴포넌트 통합

**파일**: `src/components/recorder.tsx`

`mode === 'webSpeechApi'`일 때의 녹음 흐름:

1. **녹음 시작**: `WebSpeechProvider.connect()`를 호출하면 내부적으로 `recognition.start()`가 실행된다. 동시에 기존 `useRecorder`로 마이크 세션을 시작하여 **입력 레벨 미터와 타이머**를 표시한다 (단, PCM 청크는 사용하지 않음).
2. **녹음 중**: `onPartial`/`onFinal` 콜백이 기존 `TranscriptView`에 그대로 표시된다. 사용자 경험은 실시간 전사와 동일하다.
3. **녹음 중지**: `recognition.stop()`을 호출하고, 마이크 세션을 종료한다.

#### 마이크 이중 접근 문제

Web Speech API와 `AudioWorklet`(기존 `useRecorder`)이 동시에 마이크에 접근하면 일부 브라우저에서 문제가 될 수 있다. 두 가지 해결 방안:

- **방안 A (권장)**: Web Speech API 모드에서는 `useRecorder`의 마이크 캡처를 사용하되, `sendPcm`을 no-op으로 전달한다. 레벨 미터와 타이머는 정상 동작하고, PCM 데이터는 어디에도 전송되지 않는다. Web Speech API가 별도로 마이크에 접근한다.
- **방안 B**: Web Speech API 모드에서는 `useRecorder`를 아예 시작하지 않고, 별도의 간이 마이크 레벨 모니터링 유틸을 만든다.

두 방안 모두 기술적으로 가능하나, **방안 A**가 기존 코드 변경을 최소화한다. Chrome에서는 여러 `getUserMedia` 호출이 같은 물리 마이크를 공유하므로 충돌이 없다.

### 2.5 에러 처리

Web Speech API의 에러를 사용자 친화적 메시지로 변환한다.

**파일**: `src/lib/stt/user-facing-error.ts` (기존 파일 확장)

| SpeechRecognition error.error | 사용자 메시지                                                             |
| ----------------------------- | ------------------------------------------------------------------------- |
| `not-allowed`                 | "마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크를 허용해 주세요." |
| `no-speech`                   | "음성이 감지되지 않았습니다. 마이크를 확인해 주세요."                     |
| `audio-capture`               | "마이크를 찾을 수 없습니다."                                              |
| `network`                     | "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요."              |
| `aborted`                     | (무시 — 사용자 취소)                                                      |
| 기타                          | "음성 인식 중 오류가 발생했습니다."                                       |

`no-speech` 에러는 침묵이 길어지면 반복 발생할 수 있다. 짧은 시간(3초) 내 동일 에러가 반복되면 사용자에게 한 번만 표시하도록 디바운싱한다.

### 2.6 테스트

- `src/lib/stt/__tests__/web-speech.test.ts`: WebSpeechProvider 단위 테스트
  - `connect()` 호출 시 `SpeechRecognition.start()` 호출 확인
  - interim 결과 → `onPartial` 콜백 호출
  - final 결과 → `onFinal` 콜백 호출
  - 에러 이벤트 → `onError` 콜백 호출
  - `onend` 시 자동 재시작 동작
  - `stop()` 호출 시 자동 재시작 중단
  - `sendAudio` 호출 시 아무 동작 안 함 (no-op)
  - `isWebSpeechApiSupported()` — window 객체 모킹 테스트
- `src/components/__tests__/settings-panel-web-speech.test.tsx`: 설정 패널에서 Web Speech API 미지원 시 비활성화 표시 테스트

#### 테스트 환경 구성

SpeechRecognition은 JSDOM에 없으므로, **Mock 객체**를 구성해야 한다.

```ts
// 테스트 setup
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start() {
    /* mock */
  }
  stop() {
    /* mock */
  }
  abort() {
    /* mock */
  }
}
globalThis.SpeechRecognition = MockSpeechRecognition;
```

### 2.7 문서 업데이트

- `docs/DECISIONS.md`: Web Speech API 채택 결정 기록 (무료, 설정 불필요, 정확도 트레이드오프)
- `docs/ARCHITECTURE.md`: STT 어댑터 계층에 Web Speech API Provider 추가
- `docs/PRD.md`: 전사 방식에 "Web Speech API (브라우저 내장)" 옵션 추가
- `Issues/STATUS.md`: Feature 11 항목 추가

## 3. 완료 조건 (Done Criteria)

- [ ] `WebSpeechProvider`가 `TranscriptionProvider` 인터페이스를 정확히 구현한다.
- [ ] `recognition.continuous = true`, `recognition.interimResults = true`로 설정되어 연속 인식 + 중간 결과를 수신한다.
- [ ] 음성 인식 중간 결과가 `onPartial`로, 확정 결과가 `onFinal`로 정상 전달된다.
- [ ] `sendAudio`가 no-op으로 구현되어 기존 인터페이스와 호환된다.
- [ ] 브라우저가 인식을 임의 종료(`onend`)했을 때 자동으로 재시작한다.
- [ ] `stop()` 호출 시 인식이 정상 종료되고, 자동 재시작이 중단된다.
- [ ] `isWebSpeechApiSupported()` 함수가 브라우저 지원 여부를 올바르게 판별한다.
- [ ] 설정 패널에서 Web Speech API 미지원 브라우저인 경우 해당 옵션이 비활성화되고 안내 문구가 표시된다.
- [ ] 설정에서 `Web Speech API` 모드 선택 시, `Recorder`가 Web Speech API 흐름으로 동작한다.
- [ ] Web Speech API 에러(`not-allowed`, `no-speech`, `network` 등)가 사용자 친화적 메시지로 변환되어 표시된다.
- [ ] 한국어(`ko-KR`) 음성이 정상적으로 인식된다.
- [ ] 기존 실시간 전사(OpenAI Realtime) 코드가 수정되지 않고 정상 동작한다.
- [ ] Provider 단위 테스트가 통과한다.
