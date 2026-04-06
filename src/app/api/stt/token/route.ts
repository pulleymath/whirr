import { NextResponse } from "next/server";
import {
  getClientKeyFromRequest,
  isSttTokenRateLimited,
} from "@/lib/api/stt-token-rate-limit";

const ASSEMBLYAI_REALTIME_TOKEN_URL =
  "https://api.assemblyai.com/v2/realtime/token";

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

  const upstream = await fetch(ASSEMBLYAI_REALTIME_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
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
