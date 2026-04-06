/** @vitest-environment happy-dom */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Recorder } from "../recorder";

afterEach(() => {
  cleanup();
});

const callOrder: string[] = [];

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
    partial: "",
    finals: [],
    errorMessage: null,
    prepareStreaming,
    sendPcm,
    finalizeStreaming,
  }),
}));

const startRecording = vi.fn(async () => {
  callOrder.push("startRecording");
});

const stopRecording = vi.fn(async () => {
  callOrder.push("stopRecording");
});

vi.mock("@/hooks/use-recorder", () => ({
  formatElapsed: (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `00:${String(s).padStart(2, "0")}`;
  },
  useRecorder: (onPcm?: (b: ArrayBuffer) => void) => ({
    status: "idle",
    errorMessage: null,
    elapsedMs: 0,
    level: 0,
    start: async () => {
      await startRecording();
      onPcm?.(new ArrayBuffer(4));
    },
    stop: stopRecording,
  }),
}));

describe("Recorder STT 통합", () => {
  beforeEach(() => {
    callOrder.length = 0;
    vi.clearAllMocks();
  });

  it("녹음 시작 시 prepareStreaming 후 녹음이 시작된다", async () => {
    render(<Recorder />);

    fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));

    await vi.waitFor(() => {
      expect(callOrder).toEqual(["prepareStreaming", "startRecording"]);
    });
  });

  it("PCM 청크가 sendPcm으로 전달된다", async () => {
    render(<Recorder />);

    fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));

    await vi.waitFor(() => {
      expect(sendPcm).toHaveBeenCalled();
    });
  });
});
