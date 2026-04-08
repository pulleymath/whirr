import { resetSttTokenRateLimitForTests } from "@/lib/api/stt-token-rate-limit";
import {
  OPENAI_REALTIME_TRANSCRIBE_MODEL,
  OPENAI_REALTIME_TRANSCRIPTION_LANGUAGE,
  OPENAI_REALTIME_TRANSCRIPTION_PROMPT,
} from "@/lib/stt/openai-realtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

function tokenPost(headers?: Record<string, string>) {
  return new Request("http://localhost/api/stt/token", {
    method: "POST",
    headers: headers ?? { "x-forwarded-for": "10.0.0.1" },
  });
}

function openAiSuccessResponse(secret = "ek_test") {
  return new Response(
    JSON.stringify({
      value: secret,
      expires_at: "2026-01-01T00:00:00Z",
      session: {},
    }),
    { status: 200 }
  );
}

describe("POST /api/stt/token", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    resetSttTokenRateLimitForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    resetSttTokenRateLimitForTests();
  });

  it("OPENAI_API_KEY가 없으면 503과 에러 본문을 반환한다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const res = await POST(tokenPost());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: "STT token service unavailable" });
  });

  it("OpenAI realtime/client_secrets에 POST·Bearer로 요청한다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-secret");
    const fetchMock = vi.fn().mockResolvedValue(openAiSuccessResponse("t1"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await POST(tokenPost());
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/client_secrets",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-secret",
          "Content-Type": "application/json",
        }),
      })
    );
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as { body: string }).body) as {
      session: {
        type: string;
        audio: {
          input: {
            transcription: { model: string; language: string; prompt: string };
          };
        };
      };
    };
    expect(body.session.type).toBe("transcription");
    expect(body.session.audio.input.transcription.model).toBe(
      OPENAI_REALTIME_TRANSCRIBE_MODEL
    );
    expect(body.session.audio.input.transcription.language).toBe(
      OPENAI_REALTIME_TRANSCRIPTION_LANGUAGE
    );
    expect(body.session.audio.input.transcription.prompt).toBe(
      OPENAI_REALTIME_TRANSCRIPTION_PROMPT
    );
    expect(await res.json()).toEqual({ token: "t1" });
  });

  it("업스트림이 value 없이 오면 502를 반환한다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 })
      ) as unknown as typeof fetch;

    const res = await POST(tokenPost());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Invalid token response" });
  });

  it("업스트림 오류 시 502를 반환한다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 500 })
      ) as unknown as typeof fetch;

    const res = await POST(tokenPost());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Failed to obtain STT token" });
  });

  it("짧은 시간에 반복 요청이 많으면 429를 반환한다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    vi.stubEnv("STT_TOKEN_RATE_LIMIT_MAX", "2");
    vi.stubEnv("STT_TOKEN_RATE_LIMIT_WINDOW_MS", "60000");
    globalThis.fetch = vi
      .fn()
      .mockImplementation(() =>
        openAiSuccessResponse()
      ) as unknown as typeof fetch;

    expect((await POST(tokenPost())).status).toBe(200);
    expect((await POST(tokenPost())).status).toBe(200);
    const res = await POST(tokenPost());
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: "Too many STT token requests",
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
