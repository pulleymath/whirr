import { NextResponse } from "next/server";
import {
  getClientKeyFromRequest,
  isSttTokenRateLimited,
} from "@/lib/api/stt-token-rate-limit";
import { OPENAI_REALTIME_TRANSCRIBE_MODEL } from "@/lib/stt/openai-realtime";

function buildTranscriptionSessionBody(): Record<string, unknown> {
  return {
    input_audio_format: "pcm16",
    input_audio_transcription: {
      model: OPENAI_REALTIME_TRANSCRIBE_MODEL,
      language: "ko",
    },
    turn_detection: {
      type: "server_vad",
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
    },
    input_audio_noise_reduction: {
      type: "near_field",
    },
  };
}

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
    "https://api.openai.com/v1/realtime/transcription_sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildTranscriptionSessionBody()),
    },
  );

  if (!upstream.ok) {
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

  const secret =
    data && typeof data === "object" && data !== null && "client_secret" in data
      ? (data as { client_secret?: unknown }).client_secret
      : null;

  const token =
    secret &&
    typeof secret === "object" &&
    secret !== null &&
    "value" in secret &&
    typeof (secret as { value: unknown }).value === "string"
      ? (secret as { value: string }).value
      : null;

  if (!token) {
    return NextResponse.json(
      { error: "Invalid token response" },
      { status: 502 },
    );
  }

  return NextResponse.json({ token });
}
