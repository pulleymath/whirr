import { NextResponse } from "next/server";
import {
  getClientKeyFromRequest,
  isSttTokenRateLimited,
} from "@/lib/api/stt-token-rate-limit";

/**
 * Universal Streaming v3 임시 토큰.
 * @see https://www.assemblyai.com/docs/api-reference/streaming-api/generate-streaming-token
 */
function streamingApiOrigin(): string {
  const raw = process.env.ASSEMBLYAI_STREAMING_API_BASE?.trim();
  if (raw) {
    return raw.replace(/\/$/, "");
  }
  return "https://streaming.assemblyai.com";
}

function tokenExpiresSeconds(): number {
  const n = Number(process.env.STT_TOKEN_EXPIRES_SECONDS ?? 120);
  if (!Number.isFinite(n)) {
    return 120;
  }
  return Math.min(600, Math.max(1, Math.floor(n)));
}

export async function POST(request: Request) {
  const clientKey = getClientKeyFromRequest(request);
  if (isSttTokenRateLimited(clientKey)) {
    return NextResponse.json(
      { error: "Too many STT token requests" },
      { status: 429 },
    );
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "STT token service unavailable" },
      { status: 503 },
    );
  }

  const origin = streamingApiOrigin();
  const tokenUrl = new URL("/v3/token", origin);
  tokenUrl.searchParams.set("expires_in_seconds", String(tokenExpiresSeconds()));

  const upstream = await fetch(tokenUrl.toString(), {
    method: "GET",
    headers: {
      Authorization: apiKey,
    },
  });

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

  const token =
    data &&
    typeof data === "object" &&
    "token" in data &&
    typeof (data as { token: unknown }).token === "string"
      ? (data as { token: string }).token
      : null;

  if (!token) {
    return NextResponse.json(
      { error: "Invalid token response" },
      { status: 502 },
    );
  }

  return NextResponse.json({ token });
}
