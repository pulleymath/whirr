import {
  MEETING_MINUTES_MAX_GLOSSARY_ITEMS,
  MEETING_MINUTES_MAX_GLOSSARY_TERM_LENGTH,
  MEETING_MINUTES_MAX_SESSION_CONTEXT_FIELD_LENGTH,
  MEETING_MINUTES_MAX_TEXT_LENGTH,
} from "@/lib/api/meeting-minutes-api-constants";
import { isMeetingMinutesRateLimited } from "@/lib/api/meeting-minutes-rate-limit";
import { getClientKeyFromRequest } from "@/lib/api/stt-token-rate-limit";
import type { MeetingContext, SessionContext } from "@/lib/glossary/types";
import {
  generateMeetingMinutes,
  openAiChatCompletion,
} from "@/lib/meeting-minutes/map-reduce";
import {
  DEFAULT_MEETING_MINUTES_MODEL,
  isAllowedMeetingMinutesModelId,
} from "@/lib/settings/types";
import { NextResponse } from "next/server";

export type MeetingMinutesResponseBody = {
  summary: string;
};

function parseGlossary(
  raw: unknown,
): { ok: true; value: string[] } | { ok: false; error: string } {
  if (raw === undefined) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: "invalid glossary" };
  }
  if (raw.length > MEETING_MINUTES_MAX_GLOSSARY_ITEMS) {
    return { ok: false, error: "glossary too long" };
  }
  for (const item of raw) {
    if (typeof item !== "string") {
      return { ok: false, error: "invalid glossary item" };
    }
    if (item.length > MEETING_MINUTES_MAX_GLOSSARY_TERM_LENGTH) {
      return { ok: false, error: "glossary item too long" };
    }
  }
  return { ok: true, value: raw as string[] };
}

function parseSessionContext(
  raw: unknown,
): { ok: true; value: SessionContext | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "invalid sessionContext" };
  }
  const o = raw as Record<string, unknown>;
  const read = (key: string): string =>
    typeof o[key] === "string" ? (o[key] as string) : "";
  const participants = read("participants");
  const topic = read("topic");
  const keywords = read("keywords");
  if (participants.length > MEETING_MINUTES_MAX_SESSION_CONTEXT_FIELD_LENGTH) {
    return { ok: false, error: "sessionContext.participants too long" };
  }
  if (topic.length > MEETING_MINUTES_MAX_SESSION_CONTEXT_FIELD_LENGTH) {
    return { ok: false, error: "sessionContext.topic too long" };
  }
  if (keywords.length > MEETING_MINUTES_MAX_SESSION_CONTEXT_FIELD_LENGTH) {
    return { ok: false, error: "sessionContext.keywords too long" };
  }
  return {
    ok: true,
    value: { participants, topic, keywords },
  };
}

export async function POST(request: Request) {
  const clientKey = getClientKeyFromRequest(request);
  if (isMeetingMinutesRateLimited(clientKey)) {
    return NextResponse.json(
      { error: "Too many meeting minutes requests" },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("text" in body) ||
    typeof (body as { text: unknown }).text !== "string"
  ) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  const text = (body as { text: string }).text.trim();
  if (!text) {
    return NextResponse.json({ error: "text empty" }, { status: 400 });
  }
  if (text.length > MEETING_MINUTES_MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "text too long" }, { status: 413 });
  }

  const rawModel = (body as { model?: unknown }).model;
  let model: string;
  if (typeof rawModel === "string" && rawModel.length > 0) {
    if (!isAllowedMeetingMinutesModelId(rawModel)) {
      return NextResponse.json({ error: "Unsupported model" }, { status: 400 });
    }
    model = rawModel;
  } else {
    model = DEFAULT_MEETING_MINUTES_MODEL;
  }

  const glossaryResult = parseGlossary(
    (body as { glossary?: unknown }).glossary,
  );
  if (!glossaryResult.ok) {
    return NextResponse.json({ error: glossaryResult.error }, { status: 400 });
  }

  const sessionResult = parseSessionContext(
    (body as { sessionContext?: unknown }).sessionContext,
  );
  if (!sessionResult.ok) {
    return NextResponse.json({ error: sessionResult.error }, { status: 400 });
  }

  const meetingContext: MeetingContext = {
    glossary: glossaryResult.value,
    sessionContext: sessionResult.value,
  };

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Meeting minutes service unavailable" },
        { status: 503 },
      );
    }
    await new Promise((r) => setTimeout(r, 200));
    const snippet = text.slice(0, 100);
    const summary = `[Mock 회의록] ${snippet}${text.length > 100 ? "…" : ""}`;
    return NextResponse.json({ summary } satisfies MeetingMinutesResponseBody);
  }

  try {
    const summary = await generateMeetingMinutes(text, {
      model,
      completeChat: (args) => openAiChatCompletion(apiKey, args),
      context: meetingContext,
    });
    return NextResponse.json({ summary } satisfies MeetingMinutesResponseBody);
  } catch (e) {
    console.error("[api/meeting-minutes]", e);
    return NextResponse.json(
      { error: "Meeting minutes generation failed" },
      { status: 502 },
    );
  }
}
