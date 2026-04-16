import {
  generateMeetingMinutes,
  openAiChatCompletion,
} from "@/lib/meeting-minutes/map-reduce";
import { DEFAULT_MEETING_MINUTES_MODEL } from "@/lib/settings/types";
import { NextResponse } from "next/server";

export type MeetingMinutesResponseBody = {
  summary: string;
};

export async function POST(request: Request) {
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

  const rawModel = (body as { model?: unknown }).model;
  const model =
    typeof rawModel === "string" && rawModel.length > 0
      ? rawModel
      : DEFAULT_MEETING_MINUTES_MODEL;

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
