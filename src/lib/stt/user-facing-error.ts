/**
 * STT 관련 내부/업스트림 메시지를 UI용 한국어 문구로 정규화한다.
 * 알 수 없는 문자열은 일반 문구로만 노출한다.
 */
export function userFacingSttError(raw: string): string {
  switch (raw) {
    case "STT token service unavailable":
      return "음성 인식 서비스가 설정되지 않았습니다. 관리자에게 문의하세요.";
    case "Failed to obtain STT token":
    case "Invalid token response":
      return "음성 인식을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.";
    case "Too many STT token requests":
      return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
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
