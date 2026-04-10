/** OpenAI Realtime 업스트림 세션 60분 한도 메시지(문자열 일치로 분류) */
export const OPENAI_REALTIME_SESSION_MAX_DURATION_MESSAGE =
  "Your session hit the maximum duration of 60 minutes." as const;

export const SESSION_EXPIRED_OR_DISCONNECTED =
  "SESSION_EXPIRED_OR_DISCONNECTED" as const;

/** 55분 선제 갱신 등 훅이 재연결을 트리거할 때 Provider가 올리는 내부 코드 */
export const SESSION_PROACTIVE_RENEW = "SESSION_PROACTIVE_RENEW" as const;

export const SESSION_RECONNECT_EXHAUSTED =
  "SESSION_RECONNECT_EXHAUSTED" as const;

const WEB_SPEECH_ERROR_MESSAGES: Record<string, string> = {
  "not-allowed":
    "마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크를 허용해 주세요.",
  "no-speech": "음성이 감지되지 않았습니다. 마이크를 확인해 주세요.",
  "audio-capture": "마이크를 찾을 수 없습니다.",
  network: "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.",
};

const WEB_SPEECH_GENERIC = "음성 인식 중 오류가 발생했습니다." as const;

/** Web Speech API `SpeechRecognitionErrorEvent.error` 코드 → UI 문구 */
export function userFacingWebSpeechErrorCode(code: string): string {
  return WEB_SPEECH_ERROR_MESSAGES[code] ?? WEB_SPEECH_GENERIC;
}

/** `no-speech` 반복 알림을 windowMs 안에서 한 번만 허용한다. */
export function createWebSpeechNoSpeechDebouncer(windowMs: number) {
  let lastReportAt = -Infinity;
  return {
    shouldReport(nowMs: number): boolean {
      if (nowMs - lastReportAt < windowMs) {
        return false;
      }
      lastReportAt = nowMs;
      return true;
    },
    reset(): void {
      lastReportAt = -Infinity;
    },
  };
}

export const WEB_SPEECH_ERROR_PREFIX = "WEB_SPEECH:" as const;

export function formatWebSpeechProviderError(code: string): string {
  return `${WEB_SPEECH_ERROR_PREFIX}${code}`;
}

export function parseWebSpeechProviderError(message: string): string | null {
  if (!message.startsWith(WEB_SPEECH_ERROR_PREFIX)) {
    return null;
  }
  return message.slice(WEB_SPEECH_ERROR_PREFIX.length);
}

/**
 * 자동 재연결 루프에서 다시 시도할 만한 업스트림·연결 오류
 */
export function isSttReconnectRecoverableMessage(message: string): boolean {
  if (message === OPENAI_REALTIME_SESSION_MAX_DURATION_MESSAGE) {
    return true;
  }
  if (message.includes("maximum duration of 60 minutes")) {
    return true;
  }
  if (message === SESSION_EXPIRED_OR_DISCONNECTED) {
    return true;
  }
  if (message === SESSION_PROACTIVE_RENEW) {
    return true;
  }
  if (message === "WebSocket connection failed") {
    return true;
  }
  return false;
}

/** 짧은 토스트용 문구. 해당 없으면 null */
export function userFacingSttReconnectToast(raw: string): string | null {
  switch (raw) {
    case SESSION_PROACTIVE_RENEW:
      return "세션을 곧 갱신합니다.";
    case OPENAI_REALTIME_SESSION_MAX_DURATION_MESSAGE:
      return "세션을 갱신하는 중입니다.";
    case SESSION_EXPIRED_OR_DISCONNECTED:
      return "연결을 복구하는 중입니다.";
    default:
      if (raw.includes("maximum duration of 60 minutes")) {
        return "세션을 갱신하는 중입니다.";
      }
      return null;
  }
}

/**
 * STT 관련 내부/업스트림 메시지를 UI용 한국어 문구로 정규화한다.
 * 알 수 없는 문자열은 일반 문구로만 노출한다.
 */
export function userFacingSttError(raw: string): string {
  switch (raw) {
    case OPENAI_REALTIME_SESSION_MAX_DURATION_MESSAGE:
      return "세션 시간(60분)이 만료되었습니다. 자동으로 재연결합니다.";
    case SESSION_EXPIRED_OR_DISCONNECTED:
      return "음성 인식 연결이 끊어졌습니다. 자동으로 재연결합니다.";
    case SESSION_RECONNECT_EXHAUSTED:
      return "음성 인식 연결이 끊어졌습니다. 녹음을 다시 시작해 주세요.";
    case SESSION_PROACTIVE_RENEW:
      return "세션을 갱신하는 중입니다.";
    case "STT token service unavailable":
      return "음성 인식 서비스가 설정되지 않았습니다. 관리자에게 문의하세요.";
    case "Failed to obtain STT token":
    case "Invalid token response":
      return "음성 인식을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.";
    case "Too many STT token requests":
      return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
    case "STT transcription service unavailable":
      return "일괄 전사 서비스가 설정되지 않았습니다. 관리자에게 문의하세요.";
    case "Failed to transcribe audio":
    case "Invalid transcription response":
      return "녹음 전사에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    case "Audio file too large":
      return "녹음 파일이 너무 큽니다. 더 짧게 녹음해 주세요.";
    case "Unsupported audio type":
      return "지원하지 않는 오디오 형식입니다.";
    case "Unsupported transcription model":
      return "지원하지 않는 전사 모델입니다.";
    case "WebSocket connection failed":
      return "음성 인식 서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.";
    case "Invalid WebSocket message":
      return "음성 인식 데이터 처리 중 오류가 발생했습니다.";
    case "STT_PROVIDER_ERROR":
      return "음성 인식 서버에서 오류가 반환되었습니다. 잠시 후 다시 시도해 주세요.";
    case "Failed to get STT token":
      return "음성 인식을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.";
    default:
      return "음성 인식 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }
}
