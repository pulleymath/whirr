import { MEETING_MINUTES_MAX_TEXT_LENGTH } from "@/lib/api/meeting-minutes-api-constants";
import { resetMeetingMinutesRateLimitForTests } from "@/lib/api/meeting-minutes-rate-limit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

function jsonPost(body: unknown, headers?: Record<string, string>) {
  return new Request("http://localhost/api/meeting-minutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/meeting-minutes", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    resetMeetingMinutesRateLimitForTests();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    resetMeetingMinutesRateLimitForTests();
  });

  it("JSON이 아니면 400", async () => {
    const res = await POST(
      new Request("http://localhost/api/meeting-minutes", {
        method: "POST",
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("text 없으면 400", async () => {
    const res = await POST(jsonPost({}));
    expect(res.status).toBe(400);
  });

  it("text가 빈 문자열이면 400", async () => {
    const res = await POST(jsonPost({ text: "  " }));
    expect(res.status).toBe(400);
  });

  it("text가 너무 길면 413", async () => {
    const res = await POST(
      jsonPost({ text: "a".repeat(MEETING_MINUTES_MAX_TEXT_LENGTH + 1) }),
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "text too long" });
  });

  it("허용되지 않은 model이면 400", async () => {
    const res = await POST(
      jsonPost({ text: "내용", model: "not-a-allowed-model" }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Unsupported model" });
  });

  it("레이트 리밋 초과면 429", async () => {
    vi.stubEnv("MEETING_MINUTES_RATE_LIMIT_MAX", "2");
    vi.stubEnv("MEETING_MINUTES_RATE_LIMIT_WINDOW_MS", "60000");
    const headers = { "x-forwarded-for": "198.51.100.9" };
    expect((await POST(jsonPost({ text: "a" }, headers))).status).toBe(200);
    expect((await POST(jsonPost({ text: "b" }, headers))).status).toBe(200);
    const third = await POST(jsonPost({ text: "c" }, headers));
    expect(third.status).toBe(429);
    expect(await third.json()).toEqual({
      error: "Too many meeting minutes requests",
    });
  });

  it("OPENAI_API_KEY 없고 production이면 503", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(jsonPost({ text: "내용" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "Meeting minutes service unavailable",
    });
  });

  it("OPENAI_API_KEY 없고 비프로덕션이면 Mock 회의록", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("NODE_ENV", "test");
    const res = await POST(jsonPost({ text: "회의 내용입니다." }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { summary: string };
    expect(body.summary).toMatch(/^\[Mock 회의록\]/);
    expect(body.summary).toContain("회의 내용");
  });

  it("OPENAI_API_KEY 있으면 Chat Completions 호출 후 summary 반환", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("NODE_ENV", "test");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "완성된 회의록" } }],
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await POST(jsonPost({ text: "짧은 전사", model: "gpt-4o" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ summary: "완성된 회의록" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test",
        }),
      }),
    );
    const [, init] = fetchMock.mock.calls[0]!;
    const parsed = JSON.parse(init?.body as string) as { model: string };
    expect(parsed.model).toBe("gpt-4o");
  });

  it("model 생략 시 기본 모델", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("NODE_ENV", "test");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "x" } }],
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await POST(jsonPost({ text: "내용" }));
    const [, init] = fetchMock.mock.calls[0]!;
    const parsed = JSON.parse(init?.body as string) as { model: string };
    expect(parsed.model).toBe("gpt-5.4-nano");
  });
});
