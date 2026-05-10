/**
 * 브라우저에서 API `fetch` 응답 status에 맞춰 사용자에게 보일 한국어 문구.
 * 429는 서버 `error` 문자열과 무관하게 동일한 안내를 쓴다.
 */
export function userFacingHttpErrorMessage(
  status: number,
  serverMessage?: string | null,
): string {
  if (status === 429) {
    return "요청이 많아 잠시 후 다시 시도해 주세요.";
  }
  if (serverMessage != null && serverMessage.trim()) {
    return serverMessage.trim();
  }
  return "요청에 실패했습니다.";
}
