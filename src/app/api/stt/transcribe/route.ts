import { NextResponse } from "next/server";
import {
  getClientKeyFromRequest,
  isSttTokenRateLimited,
} from "@/lib/api/stt-token-rate-limit";
import {
  isAllowedTranscribeAudioMime,
  isAllowedTranscribeModel,
  STT_TRANSCRIBE_MAX_BYTES,
} from "@/lib/api/stt-transcribe-constants";

export const maxDuration = 300;

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
      { error: "STT transcription service unavailable" },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Empty audio file" }, { status: 400 });
  }

  if (file.size > STT_TRANSCRIBE_MAX_BYTES) {
    return NextResponse.json(
      { error: "Audio file too large" },
      { status: 413 },
    );
  }

  if (!isAllowedTranscribeAudioMime(file.type)) {
    return NextResponse.json(
      { error: "Unsupported audio type" },
      { status: 415 },
    );
  }

  const modelRaw = form.get("model");
  if (typeof modelRaw !== "string" || !modelRaw.trim()) {
    return NextResponse.json({ error: "Missing model" }, { status: 400 });
  }
  const model = modelRaw.trim();
  if (!isAllowedTranscribeModel(model)) {
    return NextResponse.json(
      { error: "Unsupported transcription model" },
      { status: 400 },
    );
  }

  const languageRaw = form.get("language");
  const upstream = new FormData();
  upstream.append("file", file, file.name || "audio.webm");
  upstream.append("model", model);
  if (
    typeof languageRaw === "string" &&
    languageRaw.trim() &&
    languageRaw.trim().toLowerCase() !== "auto"
  ) {
    upstream.append("language", languageRaw.trim());
  }

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: upstream,
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    console.error(
      "[stt/transcribe] OpenAI transcriptions failed:",
      res.status,
      detail.slice(0, 500),
    );
    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 502 },
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid transcription response" },
      { status: 502 },
    );
  }

  const text =
    data &&
    typeof data === "object" &&
    data !== null &&
    "text" in data &&
    typeof (data as { text: unknown }).text === "string"
      ? (data as { text: string }).text
      : null;

  if (text == null) {
    return NextResponse.json(
      { error: "Invalid transcription response" },
      { status: 502 },
    );
  }

  return NextResponse.json({ text });
}
