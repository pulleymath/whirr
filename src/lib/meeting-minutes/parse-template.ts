import { MEETING_MINUTES_MAX_CUSTOM_TEMPLATE_LENGTH } from "@/lib/api/meeting-minutes-api-constants";
import {
  DEFAULT_MEETING_MINUTES_TEMPLATE,
  type BuiltInMeetingMinutesTemplateId,
  type MeetingMinutesTemplate,
} from "./templates";

export type ParseMeetingMinutesTemplateResult =
  | { ok: true; value: MeetingMinutesTemplate }
  | { ok: false; error: string };

const BUILTIN_IDS: readonly BuiltInMeetingMinutesTemplateId[] = [
  "default",
  "informationSharing",
  "business",
] as const;

function isBuiltInId(id: string): id is BuiltInMeetingMinutesTemplateId {
  return (BUILTIN_IDS as readonly string[]).includes(id);
}

/**
 * POST /api/meeting-minutes 요청 본문의 `template` 필드를 파싱·검증한다.
 */
export function parseMeetingMinutesTemplateFromRequest(
  raw: unknown,
): ParseMeetingMinutesTemplateResult {
  if (raw === undefined || raw === null) {
    return { ok: true, value: DEFAULT_MEETING_MINUTES_TEMPLATE };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "invalid template" };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || o.id.length === 0) {
    return { ok: false, error: "invalid template" };
  }
  if (isBuiltInId(o.id)) {
    return { ok: true, value: { id: o.id } };
  }
  if (o.id === "custom") {
    if (typeof o.prompt !== "string") {
      return { ok: false, error: "invalid template" };
    }
    const trimmed = o.prompt.trim();
    if (trimmed.length > MEETING_MINUTES_MAX_CUSTOM_TEMPLATE_LENGTH) {
      return { ok: false, error: "template.prompt too long" };
    }
    if (trimmed.length === 0) {
      return { ok: true, value: DEFAULT_MEETING_MINUTES_TEMPLATE };
    }
    return { ok: true, value: { id: "custom", prompt: trimmed } };
  }
  return { ok: false, error: "invalid template" };
}
