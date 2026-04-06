import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSttTokenRateLimitForTests } from "@/lib/api/stt-token-rate-limit";
import { POST } from "../route";

function tokenPost(headers?: Record<string, string>) {
  return new Request("http://localhost/api/stt/token", {
    method: "POST",
    headers: headers ?? { "x-forwarded-for": "10.0.0.1" },
  });
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

  it("ASSEMBLYAI_API_KEY가 없으면 503과 에러 본문을 반환한다", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "");
    const res = await POST(tokenPost());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: "STT token service unavailable" });
  });

  it("AssemblyAI streaming에 v3/token GET·Authorization으로 요청한다", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "secret-key");
    vi.stubEnv("STT_TOKEN_EXPIRES_SECONDS", "90");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ token: "t1" }), { status: 200 }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await POST(tokenPost());
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://streaming.assemblyai.com/v3/token?expires_in_seconds=90",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "secret-key",
        }),
      }),
    );
    expect(await res.json()).toEqual({ token: "t1" });
  });

  it("ASSEMBLYAI_STREAMING_API_BASE가 있으면 해당 origin으로 v3/token을 호출한다", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "k");
    vi.stubEnv(
      "ASSEMBLYAI_STREAMING_API_BASE",
      "https://streaming.eu.assemblyai.com/",
    );
    vi.stubEnv("STT_TOKEN_EXPIRES_SECONDS", "60");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ token: "eu" }), { status: 200 }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await POST(tokenPost());
    expect(fetchMock).toHaveBeenCalledWith(
      "https://streaming.eu.assemblyai.com/v3/token?expires_in_seconds=60",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("업스트림이 token 없이 오면 502를 반환한다", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "k");
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 }),
      ) as unknown as typeof fetch;

    const res = await POST(tokenPost());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Invalid token response" });
  });

  it("업스트림 오류 시 502를 반환한다", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "k");
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 500 }),
      ) as unknown as typeof fetch;

    const res = await POST(tokenPost());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Failed to obtain STT token" });
  });

  it("짧은 시간에 반복 요청이 많으면 429를 반환한다", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "k");
    vi.stubEnv("STT_TOKEN_RATE_LIMIT_MAX", "2");
    vi.stubEnv("STT_TOKEN_RATE_LIMIT_WINDOW_MS", "60000");
    globalThis.fetch = vi
      .fn()
      .mockImplementation(
        () => new Response(JSON.stringify({ token: "t" }), { status: 200 }),
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
