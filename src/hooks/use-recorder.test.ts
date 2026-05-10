/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatElapsed, useRecorder } from "./use-recorder";
import { startPcmRecording, type PcmRecordingSession } from "@/lib/audio";

vi.mock("@/lib/audio", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/audio")>("@/lib/audio");
  return {
    ...actual,
    startPcmRecording: vi.fn(),
  };
});

describe("formatElapsed", () => {
  it("mm:ss로 포맷한다", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(59_000)).toBe("00:59");
    expect(formatElapsed(60_000)).toBe("01:00");
    expect(formatElapsed(125_000)).toBe("02:05");
  });
});

describe("useRecorder", () => {
  const mockStop = vi.fn().mockResolvedValue(undefined);
  const mockAnalyser = {
    fftSize: 256,
    frequencyBinCount: 128,
    getByteTimeDomainData: vi.fn((arr: Uint8Array) => {
      arr.fill(200);
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStop.mockResolvedValue(undefined);
    vi.mocked(startPcmRecording).mockImplementation(async () => ({
      stop: mockStop,
      analyser: mockAnalyser as unknown as AnalyserNode,
    }));
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("start 호출 시 recording 상태가 된다", async () => {
    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("recording");
    expect(startPcmRecording).toHaveBeenCalled();
  });

  it("타이머에 따라 elapsedMs가 증가한다", async () => {
    let t = 10_000;
    const spy = vi.spyOn(Date, "now").mockImplementation(() => t);
    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });
    t = 10_600;
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(600);
    spy.mockRestore();
  });

  it("stop 호출 시 세션을 종료하고 idle이다", async () => {
    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.stop();
    });
    expect(mockStop).toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("시작 실패 시 error와 메시지를 설정한다", async () => {
    vi.mocked(startPcmRecording).mockRejectedValueOnce({
      name: "NotAllowedError",
    });
    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/권한/);
  });

  it("마이크 권한 거부 후 재시도하면 recording 상태가 된다", async () => {
    vi.mocked(startPcmRecording)
      .mockRejectedValueOnce({ name: "NotAllowedError" })
      .mockResolvedValueOnce({
        stop: mockStop,
        analyser: mockAnalyser as unknown as AnalyserNode,
      });
    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("error");
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("recording");
  });

  it("진행 중 중복 start는 startPcmRecording을 한 번만 호출한다", async () => {
    let resolveSession!: (value: PcmRecordingSession) => void;

    vi.mocked(startPcmRecording).mockImplementation(
      () =>
        new Promise<PcmRecordingSession>((resolve) => {
          resolveSession = resolve;
        }),
    );

    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      const first = result.current.start();
      await result.current.start();
      resolveSession({
        stop: mockStop as PcmRecordingSession["stop"],
        analyser: mockAnalyser as unknown as AnalyserNode,
      });
      await first;
    });

    expect(startPcmRecording).toHaveBeenCalledTimes(1);
  });
});
