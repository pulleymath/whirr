import { NextResponse } from "next/server";
import {
  getClientKeyFromRequest,
  isSttTokenRateLimited,
} from "@/lib/api/stt-token-rate-limit";
import { openAiGaTranscriptionSession } from "@/lib/stt/openai-realtime";

export async function POST(request: Request) {
  const clientKey = getClientKeyFromRequest(request);
  if (isSttTokenRateLimited(clientKey)) {
    return NextResponse.json(
      { error: "Too many STT token requests" },
      { status: 429 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "STT token service unavailable" },
      { status: 503 },
    );
  }

  const upstream = await fetch(
    "https://api.openai.com/v1/realtime/client_secrets",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session: openAiGaTranscriptionSession() }),
    },
  );

  if (!upstream.ok) {
    let detail = "";
    try {
      detail = await upstream.text();
    } catch {
      /* ignore */
    }
    console.error(
      "[stt/token] OpenAI client_secrets failed:",
      upstream.status,
      detail.slice(0, 500),
    );
    return NextResponse.json(
      { error: "Failed to obtain STT token" },
      { status: 502 },
    );
  }

  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid token response" },
      { status: 502 },
    );
  }

  let token: string | null = null;
  if (data && typeof data === "object" && data !== null) {
    const d = data as { value?: unknown; client_secret?: unknown };
    if (typeof d.value === "string") {
      token = d.value;
    } else {
      const secret = d.client_secret;
      if (
        secret &&
        typeof secret === "object" &&
        secret !== null &&
        "value" in secret &&
        typeof (secret as { value: unknown }).value === "string"
      ) {
        token = (secret as { value: string }).value;
      }
    }
  }

  if (!token) {
    return NextResponse.json(
      { error: "Invalid token response" },
      { status: 502 },
    );
  }

  return NextResponse.json({ token });
}
