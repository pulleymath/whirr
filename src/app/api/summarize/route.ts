import { SUMMARIZE_MAX_TEXT_LENGTH } from "@/lib/api/summarize-constants";
import { NextResponse } from "next/server";

export type SummarizeResponseBody = {
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
  if (text.length > SUMMARIZE_MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "text too long" }, { status: 413 });
  }

  if (process.env.NODE_ENV !== "production") {
    await new Promise((r) => setTimeout(r, 200));
  }
  const snippet = text.slice(0, 100);
  const summary = `[Mock 요약] ${snippet}${text.length > 100 ? "…" : ""}`;
  return NextResponse.json({ summary } satisfies SummarizeResponseBody);
}
