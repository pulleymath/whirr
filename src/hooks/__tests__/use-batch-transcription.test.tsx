/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useBatchTranscription,
  type BatchStopResult,
} from "../use-batch-transcription";

const startSegmentedRecording = vi.hoisted(() =>
  vi.fn(async () => ({
    analyser: {
      frequencyBinCount: 128,
      getByteTimeDomainData: vi.fn(),
    },
    rotateSegment: vi.fn(
      async () => new Blob(["webm"], { type: "audio/webm" }),
    ),
    stopFinalSegment: vi.fn(
      async () => new Blob(["webm"], { type: "audio/webm" }),
    ),
    close: vi.fn(async () => {}),
  })),
);

vi.mock("@/lib/audio", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/audio")>();
  return {
    ...mod,
    startSegmentedRecording,
  };
});

describe("useBatchTranscription", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("startRecording 성공 시 status가 recording이 된다", async () => {
    const { result } = renderHook(() =>
      useBatchTranscription({ model: "whisper-1", language: "ko" }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe("recording");
    expect(startSegmentedRecording).toHaveBeenCalledTimes(1);
  });

  it("stopAndTranscribe 성공 시 idle이고 마지막 블롭만 반환·훅에서는 스크립트 fetch를 하지 않는다", async () => {
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

    let saved: BatchStopResult | null = null;
    await act(async () => {
      saved = await result.current.stopAndTranscribe();
    });

    expect(result.current.status).toBe("idle");
    expect(saved).not.toBeNull();
    expect(saved!.partialText).toBe("");
    expect(saved!.finalBlob).not.toBeNull();
    expect(saved!.segments).toHaveLength(1);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("5분 회전 후 백그라운드 스크립트 변환이 5xx로 끝나면 stop 시 error가 된다", async () => {
    vi.useFakeTimers();
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
      vi.advanceTimersByTime(5 * 60 * 1000 + 300);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    let stopPromise: ReturnType<typeof result.current.stopAndTranscribe>;
    await act(async () => {
      stopPromise = result.current.stopAndTranscribe();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    await act(async () => {
      await stopPromise!;
    });

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/스크립트|구간/);
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it("fetch가 연속 reject되면 백오프 후 재시도하고 실패 시 stop에서 error가 된다", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockRejectedValueOnce(new TypeError("network"))
      .mockRejectedValueOnce(
        new TypeError("network"),
      ) as unknown as typeof fetch;

    const { result } = renderHook(() => useBatchTranscription());

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 300);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    let stopPromise: ReturnType<typeof result.current.stopAndTranscribe>;
    await act(async () => {
      stopPromise = result.current.stopAndTranscribe();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    await act(async () => {
      await stopPromise!;
    });

    expect(result.current.status).toBe("error");
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it("4xx 오류 시 재시도 없이 회전 구간 스크립트 변환이 실패하고 stop 시 error가 된다", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "Audio file too large" }), {
        status: 413,
      });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useBatchTranscription());

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 300);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    await act(async () => {
      await result.current.stopAndTranscribe();
    });

    expect(result.current.status).toBe("error");
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it("retryTranscription으로 에러 후 Blob을 다시 스크립트로 변환한다", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "down" }), { status: 503 });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useBatchTranscription());

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 300);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    let stopPromise: ReturnType<typeof result.current.stopAndTranscribe>;
    await act(async () => {
      stopPromise = result.current.stopAndTranscribe();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    await act(async () => {
      await stopPromise!;
    });

    expect(result.current.status).toBe("error");

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ text: "수동 재시도" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    let retryPromise: Promise<BatchStopResult | null>;
    await act(async () => {
      retryPromise = result.current.retryTranscription();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    let retryOut: BatchStopResult | null = null;
    await act(async () => {
      retryOut = await retryPromise!;
    });

    expect(result.current.status).toBe("done");
    expect(result.current.transcript).toBe("수동 재시도 수동 재시도");
    expect(retryOut).not.toBeNull();
    expect(retryOut!.finalBlob).toBeNull();
    expect(retryOut!.segments.length).toBeGreaterThanOrEqual(2);
    expect(retryOut!.partialText).toContain("수동 재시도");
  });

  it("녹음 중 online 이벤트 시 실패한 세그먼트 전사를 다시 시도한다", async () => {
    vi.useFakeTimers();
    let n = 0;
    globalThis.fetch = vi.fn(async () => {
      n += 1;
      if (n <= 3) {
        return new Response(JSON.stringify({ error: "down" }), { status: 503 });
      }
      return new Response(JSON.stringify({ text: "온라인복구" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useBatchTranscription());

    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 300);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(result.current.failedSegments.length).toBeGreaterThan(0);

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(result.current.failedSegments.length).toBe(0);
    expect(result.current.transcript).toContain("온라인복구");
  });

  it("stopAndTranscribe 호출 시 진행 중인 백그라운드 스크립트 변환을 기다리고 partialText에만 합친다", async () => {
    vi.useFakeTimers();
    let fetchCount = 0;
    globalThis.fetch = vi.fn(async () => {
      fetchCount++;
      const currentCount = fetchCount;
      if (currentCount === 1) {
        await new Promise((r) => setTimeout(r, 2000));
        return new Response(JSON.stringify({ text: "첫번째" }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ text: "두번째" }), { status: 200 });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useBatchTranscription());

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 100);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    let stopPromise: ReturnType<typeof result.current.stopAndTranscribe>;
    await act(async () => {
      stopPromise = result.current.stopAndTranscribe();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    const out = await stopPromise!;
    expect(out?.partialText).toContain("첫번째");
    expect(out?.partialText).not.toContain("두번째");
    expect(out?.finalBlob).not.toBeNull();
    expect(result.current.status).toBe("idle");
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
      vi.advanceTimersByTime(235 * 60 * 1000 + 200);
    });

    expect(result.current.softLimitMessage).toContain("5분");

    vi.useRealTimers();
  });

  it("60분 경과 시 stopAndTranscribe가 호출되어 transcribe 요청이 발생할 수 있다", async () => {
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
      vi.advanceTimersByTime(240 * 60 * 1000 + 500);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/stt/transcribe",
      expect.objectContaining({ method: "POST" }),
    );

    vi.useRealTimers();
  });
});
