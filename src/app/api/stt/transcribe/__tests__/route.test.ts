import { resetSttTokenRateLimitForTests } from "@/lib/api/stt-token-rate-limit";
import { STT_TRANSCRIBE_MAX_BYTES } from "@/lib/api/stt-transcribe-constants";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

function transcribePost(body: FormData, headers?: Record<string, string>) {
  return new Request("http://localhost/api/stt/transcribe", {
    method: "POST",
    headers: headers ?? { "x-forwarded-for": "10.0.0.2" },
    body,
  });
}

function smallWebmFile() {
  return new File([new Uint8Array([1, 2, 3])], "rec.webm", {
    type: "audio/webm",
  });
}

describe("POST /api/stt/transcribe", () => {
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
    const fd = new FormData();
    fd.set("file", smallWebmFile());
    fd.set("model", "whisper-1");
    const res = await POST(transcribePost(fd));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: "STT transcription service unavailable" });
  });

  it("정상 multipart면 OpenAI transcriptions 로 프록시하고 text 를 반환한다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ text: "안녕" }), { status: 200 }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const fd = new FormData();
    fd.set("file", smallWebmFile());
    fd.set("model", "whisper-1");
    fd.set("language", "ko");

    const res = await POST(transcribePost(fd));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "안녕" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-secret",
        }),
      }),
    );
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init).toMatchObject({ method: "POST" });
    expect(init?.body).toBeInstanceOf(FormData);
  });

  it("허용되지 않은 model이면 400을 반환한다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    const fd = new FormData();
    fd.set("file", smallWebmFile());
    fd.set("model", "malicious-model-id");
    const res = await POST(transcribePost(fd));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "Unsupported transcription model" });
  });

  it("업스트림 본문이 JSON이 아니면 502를 반환한다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    globalThis.fetch = vi.fn(async () => {
      return new Response("not json", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }) as unknown as typeof fetch;

    const fd = new FormData();
    fd.set("file", smallWebmFile());
    fd.set("model", "whisper-1");
    const res = await POST(transcribePost(fd));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "Invalid transcription response",
    });
  });

  it("파일 필드가 없으면 400을 반환한다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    const fd = new FormData();
    fd.set("model", "whisper-1");
    const res = await POST(transcribePost(fd));
    expect(res.status).toBe(400);
  });

  it("빈 파일이면 400을 반환한다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    const fd = new FormData();
    fd.set("file", new File([], "empty.webm", { type: "audio/webm" }));
    fd.set("model", "whisper-1");
    const res = await POST(transcribePost(fd));
    expect(res.status).toBe(400);
  });

  it("25MB 초과면 413을 반환한다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    const big = new File(
      [new Blob([new Uint8Array(STT_TRANSCRIBE_MAX_BYTES + 1)])],
      "big.webm",
      {
        type: "audio/webm",
      },
    );
    const fd = new FormData();
    fd.set("file", big);
    fd.set("model", "whisper-1");
    const res = await POST(transcribePost(fd));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Audio file too large" });
  });

  it("비허용 MIME이면 415를 반환한다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    const fd = new FormData();
    fd.set(
      "file",
      new File([new Uint8Array([1])], "x.bin", {
        type: "application/octet-stream",
      }),
    );
    fd.set("model", "whisper-1");
    const res = await POST(transcribePost(fd));
    expect(res.status).toBe(415);
  });

  it("레이트 리밋 초과 시 429를 반환한다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    vi.stubEnv("STT_TOKEN_RATE_LIMIT_MAX", "2");
    vi.stubEnv("STT_TOKEN_RATE_LIMIT_WINDOW_MS", "60000");
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ text: "a" }), { status: 200 });
    }) as unknown as typeof fetch;

    const mk = () => {
      const fd = new FormData();
      fd.set("file", smallWebmFile());
      fd.set("model", "whisper-1");
      return transcribePost(fd, { "x-forwarded-for": "10.0.0.9" });
    };

    expect((await POST(mk())).status).toBe(200);
    expect((await POST(mk())).status).toBe(200);
    const res = await POST(mk());
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: "Too many STT token requests",
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("업스트림 5xx 오류 시 502를 반환한다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 500 }),
      ) as unknown as typeof fetch;

    const fd = new FormData();
    fd.set("file", smallWebmFile());
    fd.set("model", "whisper-1");
    const res = await POST(transcribePost(fd));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Failed to transcribe audio" });
  });

  it("업스트림 4xx(corrupted file 등) 시 422를 반환한다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message: "Audio file might be corrupted or unsupported",
              type: "invalid_request_error",
              param: "file",
              code: "invalid_value",
            },
          }),
          { status: 400 },
        ),
      ) as unknown as typeof fetch;

    const fd = new FormData();
    fd.set("file", smallWebmFile());
    fd.set("model", "whisper-1");
    const res = await POST(transcribePost(fd));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "Failed to transcribe audio" });
  });

  it("업스트림 JSON에 text 가 없으면 502를 반환한다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 }),
      ) as unknown as typeof fetch;

    const fd = new FormData();
    fd.set("file", smallWebmFile());
    fd.set("model", "whisper-1");
    const res = await POST(transcribePost(fd));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "Invalid transcription response",
    });
  });
});
