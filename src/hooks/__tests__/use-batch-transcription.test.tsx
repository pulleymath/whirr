/** @vitest-environment happy-dom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBatchTranscription } from "../use-batch-transcription";

const startBlobRecording = vi.hoisted(() =>
  vi.fn(async () => ({
    analyser: {
      frequencyBinCount: 128,
      getByteTimeDomainData: vi.fn(),
    },
    stop: vi.fn(async () => new Blob(["webm"], { type: "audio/webm" })),
  })),
);

vi.mock("@/lib/audio", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/audio")>();
  return {
    ...mod,
    startBlobRecording,
  };
});

describe("useBatchTranscription", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("startRecording 성공 시 status가 recording이 된다", async () => {
    const { result } = renderHook(() =>
      useBatchTranscription({ model: "whisper-1", language: "ko" }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe("recording");
    expect(startBlobRecording).toHaveBeenCalledTimes(1);
  });

  it("stopAndTranscribe 성공 시 transcribing을 거쳐 done과 transcript를 설정한다", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ text: "  안녕  " }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useBatchTranscription({ model: "whisper-1", language: "ko" }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    let saved: string | null = null;
    await act(async () => {
      saved = await result.current.stopAndTranscribe();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("done");
    });
    expect(saved).toBe("안녕");
    expect(result.current.transcript).toBe("안녕");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/stt/transcribe",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("HTTP 오류 시 error 상태와 메시지를 설정한다", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: "Failed to transcribe audio" }),
        { status: 502 },
      );
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useBatchTranscription());

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      await result.current.stopAndTranscribe();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    expect(result.current.errorMessage).toMatch(/전사/);
  });

  it("startBlobRecording 실패 시 error 상태가 된다", async () => {
    startBlobRecording.mockRejectedValueOnce(
      new DOMException("", "NotAllowedError"),
    );

    const { result } = renderHook(() => useBatchTranscription());

    await act(async () => {
      await result.current.startRecording();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    expect(result.current.errorMessage).toMatch(/권한/);
  });
});

describe("useBatchTranscription 녹음 시간 제한", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("55분 경과 시 softLimitMessage를 한 번 설정한다", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useBatchTranscription({ model: "whisper-1", language: "ko" }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      vi.advanceTimersByTime(55 * 60 * 1000 + 200);
    });

    expect(result.current.softLimitMessage).toContain("5분");

    vi.useRealTimers();
  });

  it("60분 경과 시 전사 API를 자동으로 호출한다", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ text: "자동" }), { status: 200 });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useBatchTranscription({ model: "whisper-1", language: "ko" }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      vi.advanceTimersByTime(60 * 60 * 1000 + 500);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/stt/transcribe",
      expect.objectContaining({ method: "POST" }),
    );

    vi.useRealTimers();
  });
});
