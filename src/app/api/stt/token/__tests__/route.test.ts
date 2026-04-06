import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

describe("POST /api/stt/token", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("ASSEMBLYAI_API_KEY가 없으면 503과 에러 본문을 반환한다", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "");
    const res = await POST();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: "STT token service unavailable" });
  });

  it("AssemblyAI에 올바른 URL·Authorization으로 POST한다", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "secret-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ token: "t1" }), { status: 200 }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await POST();
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.assemblyai.com/v2/realtime/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "secret-key",
        }),
      }),
    );
    expect(await res.json()).toEqual({ token: "t1" });
  });

  it("업스트림이 token 없이 오면 502를 반환한다", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "k");
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 }),
      ) as unknown as typeof fetch;

    const res = await POST();
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

    const res = await POST();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Failed to obtain STT token" });
  });
});
