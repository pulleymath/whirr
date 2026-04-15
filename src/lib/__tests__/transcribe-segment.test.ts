import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  transcribeBlobOnce,
  transcribeBlobWithRetries,
  shouldRetryBatchTranscribeStatus,
} from "../transcribe-segment";

describe("transcribe-segment", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shouldRetryBatchTranscribeStatus: 0과 5xx는 재시도", () => {
    expect(shouldRetryBatchTranscribeStatus(0)).toBe(true);
    expect(shouldRetryBatchTranscribeStatus(500)).toBe(true);
    expect(shouldRetryBatchTranscribeStatus(400)).toBe(false);
  });

  it("transcribeBlobOnce — 성공 시 ok와 text", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ text: "  hello  " }), { status: 200 }),
    );
    const r = await transcribeBlobOnce(new Blob(), {
      model: "m",
      language: "ko",
    });
    expect(r.ok).toBe(true);
    expect(r.text).toBe("hello");
  });

  it("transcribeBlobOnce — 서버 에러 시 ok false", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "bad" }), { status: 502 }),
    );
    const r = await transcribeBlobOnce(new Blob(), {
      model: "m",
      language: "ko",
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(502);
  });

  it("transcribeBlobOnce — 네트워크 에러 시 status 0", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));
    const r = await transcribeBlobOnce(new Blob(), {
      model: "m",
      language: "ko",
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(0);
  });

  it("transcribeBlobOnce — AbortSignal로 중단", async () => {
    const ac = new AbortController();
    ac.abort();
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          reject(new DOMException("Aborted", "AbortError"));
        }),
    );
    const r = await transcribeBlobOnce(new Blob(), {
      model: "m",
      language: "ko",
      signal: ac.signal,
    });
    expect(r.ok).toBe(false);
    expect(r.errRaw).toBe("ABORTED");
  });

  it("transcribeBlobWithRetries — 첫 시도 성공", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ text: "ok" }), { status: 200 }),
    );
    const r = await transcribeBlobWithRetries(new Blob(), {
      model: "m",
      language: "ko",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe("ok");
  });

  it("transcribeBlobWithRetries — 500 후 재시도 성공", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "x" }), { status: 500 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ text: "retry ok" }), { status: 200 }),
      );
    const r = await transcribeBlobWithRetries(new Blob(), {
      model: "m",
      language: "ko",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe("retry ok");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("transcribeBlobWithRetries — 401은 재시도 없이 실패", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "nope" }), { status: 401 }),
    );
    const r = await transcribeBlobWithRetries(new Blob(), {
      model: "m",
      language: "ko",
    });
    expect(r.ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
