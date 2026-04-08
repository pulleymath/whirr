/** @vitest-environment happy-dom */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveSession } from "@/lib/db";
import { Recorder } from "../recorder";

vi.mock("@/lib/db", () => ({
  saveSession: vi.fn(async () => "saved-id"),
}));

afterEach(() => {
  cleanup();
});

const callOrder: string[] = [];

const testRecorderState = vi.hoisted(() => ({
  status: "idle" as "idle" | "recording",
}));

const transcriptionState = vi.hoisted(() => ({
  partial: "",
  finals: [] as string[],
}));

const prepareStreaming = vi.fn(async () => {
  callOrder.push("prepareStreaming");
  return true;
});

const finalizeStreaming = vi.fn(async () => {
  callOrder.push("finalizeStreaming");
});

const sendPcm = vi.fn();

vi.mock("@/hooks/use-transcription", () => ({
  useTranscription: () => ({
    get partial() {
      return transcriptionState.partial;
    },
    get finals() {
      return transcriptionState.finals;
    },
    errorMessage: null,
    prepareStreaming,
    sendPcm,
    finalizeStreaming,
  }),
}));

vi.mock("@/hooks/use-recorder", () => ({
  formatElapsed: (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `00:${String(s).padStart(2, "0")}`;
  },
  useRecorder: (onPcm?: (b: ArrayBuffer) => void) => ({
    get status() {
      return testRecorderState.status;
    },
    errorMessage: null,
    elapsedMs: 0,
    level: 0,
    start: async () => {
      callOrder.push("startRecording");
      testRecorderState.status = "recording";
      onPcm?.(new ArrayBuffer(4));
    },
    stop: async () => {
      callOrder.push("stopRecording");
      testRecorderState.status = "idle";
    },
  }),
}));

describe("Recorder 세션 저장", () => {
  beforeEach(() => {
    callOrder.length = 0;
    testRecorderState.status = "idle";
    transcriptionState.partial = "";
    transcriptionState.finals = [];
    vi.clearAllMocks();
  });

  it("중지 시 전사 스냅샷이 비어 있지 않으면 saveSession을 한 번 호출한다", async () => {
    const { rerender } = render(<Recorder />);

    fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
    await vi.waitFor(() => {
      expect(callOrder).toEqual(["prepareStreaming", "startRecording"]);
    });

    transcriptionState.finals = ["hello"];
    transcriptionState.partial = " world";
    rerender(<Recorder />);

    callOrder.length = 0;
    fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

    await vi.waitFor(() => {
      expect(callOrder).toEqual(["stopRecording", "finalizeStreaming"]);
    });

    expect(saveSession).toHaveBeenCalledTimes(1);
    expect(saveSession).toHaveBeenCalledWith("hello world");
  });

  it("finals와 partial이 모두 비어 있으면 saveSession을 호출하지 않는다", async () => {
    const { rerender } = render(<Recorder />);

    fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
    await vi.waitFor(() => {
      expect(testRecorderState.status).toBe("recording");
    });

    transcriptionState.finals = [];
    transcriptionState.partial = "";
    rerender(<Recorder />);

    fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));
    await vi.waitFor(() => {
      expect(finalizeStreaming).toHaveBeenCalled();
    });

    expect(saveSession).not.toHaveBeenCalled();
  });
});
