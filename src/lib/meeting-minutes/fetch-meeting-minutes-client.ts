import { userFacingHttpErrorMessage } from "@/lib/api/user-facing-fetch-error";
import type { SessionContext } from "@/lib/glossary/types";
import type { MeetingMinutesTemplate } from "@/lib/meeting-minutes/templates";

export type FetchMeetingMinutesOptions = {
  glossary?: string[];
  sessionContext?: SessionContext | null;
  template?: MeetingMinutesTemplate;
};

/**
 * 브라우저에서 요약 API를 호출해 본문(`summary`) 문자열만 반환한다.
 */
export async function fetchMeetingMinutesSummary(
  text: string,
  model: string,
  signal?: AbortSignal,
  options?: FetchMeetingMinutesOptions,
): Promise<string> {
  const body: Record<string, unknown> = { text, model };
  if (options?.glossary !== undefined) {
    body.glossary = options.glossary;
  }
  if (options?.sessionContext !== undefined) {
    body.sessionContext = options.sessionContext;
  }
  if (options?.template !== undefined) {
    body.template = options.template;
  }
  const res = await fetch("/api/meeting-minutes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const serverMsg =
      data &&
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : null;
    if (res.status === 429) {
      throw new Error(userFacingHttpErrorMessage(429));
    }
    const msg =
      serverMsg != null && serverMsg.trim()
        ? serverMsg.trim()
        : "요약 요청에 실패했습니다.";
    throw new Error(msg);
  }
  if (
    data &&
    typeof data === "object" &&
    data !== null &&
    "summary" in data &&
    typeof (data as { summary: unknown }).summary === "string"
  ) {
    return (data as { summary: string }).summary;
  }
  throw new Error("요약 응답 형식이 올바르지 않습니다.");
}
