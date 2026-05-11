import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMeetingMinutesSummary } from "../fetch-meeting-minutes-client";

describe("fetchMeetingMinutesSummary", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("200이면 summary 문자열을 반환한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ summary: "회의록 본문" }), {
        status: 200,
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const out = await fetchMeetingMinutesSummary("스크립트", "gpt-4o");
    expect(out).toBe("회의록 본문");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/meeting-minutes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "스크립트", model: "gpt-4o" }),
      }),
    );
  });

  it("glossary와 sessionContext가 주어지면 fetch body에 포함된다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ summary: "s" }), {
        status: 200,
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchMeetingMinutesSummary("t", "m", undefined, {
      glossary: ["x"],
      sessionContext: { participants: "a", topic: "b", keywords: "c" },
    });

    expect(
      JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string),
    ).toEqual({
      text: "t",
      model: "m",
      glossary: ["x"],
      sessionContext: { participants: "a", topic: "b", keywords: "c" },
    });
  });

  it("template이 주어지면 fetch body에 포함된다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ summary: "s" }), {
        status: 200,
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchMeetingMinutesSummary("t", "m", undefined, {
      template: { id: "business" },
    });

    expect(
      JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string),
    ).toEqual({
      text: "t",
      model: "m",
      template: { id: "business" },
    });
  });

  it("ok가 아니면 에러를 던진다", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "text too long" }), {
        status: 413,
      }),
    ) as unknown as typeof fetch;

    await expect(fetchMeetingMinutesSummary("x", "m")).rejects.toThrow(
      "text too long",
    );
  });

  it("ok가 아니고 JSON에 error가 없으면 한글 기본 메시지를 던진다", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("{}", { status: 500 }),
      ) as unknown as typeof fetch;

    await expect(fetchMeetingMinutesSummary("x", "m")).rejects.toThrow(
      "요약 요청에 실패했습니다.",
    );
  });

  it("429면 서버 error 문자열과 무관하게 한국어 레이트 리밋 안내를 던진다", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Too many meeting minutes requests" }), {
        status: 429,
      }),
    ) as unknown as typeof fetch;

    await expect(fetchMeetingMinutesSummary("x", "m")).rejects.toThrow(
      "요청이 많아 잠시 후 다시 시도해 주세요.",
    );
  });
});
