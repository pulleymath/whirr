/** @vitest-environment happy-dom */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { SETTINGS_STORAGE_KEY } from "@/lib/settings/context";
import { Recorder } from "../recorder";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderRecorder() {
  return render(
    <MainAppProviders>
      <Recorder />
    </MainAppProviders>,
  );
}

async function renderRecorderRealtime() {
  const out = renderRecorder();
  await vi.waitFor(() => {
    expect(
      document.querySelector('[data-transcription-mode="realtime"]'),
    ).toBeTruthy();
  });
  return out;
}

const callOrder: string[] = [];

const testRecorderState = vi.hoisted(() => ({
  status: "idle" as "idle" | "recording",
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
    partial: "",
    finals: [],
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

describe("Recorder STT 통합", () => {
  beforeEach(() => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ mode: "realtime", realtimeEngine: "openai" }),
    );
    callOrder.length = 0;
    testRecorderState.status = "idle";
    vi.clearAllMocks();
  });

  it("녹음 시작 시 prepareStreaming 후 녹음이 시작된다", async () => {
    await renderRecorderRealtime();

    fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));

    await vi.waitFor(() => {
      expect(callOrder).toEqual(["prepareStreaming", "startRecording"]);
    });
  });

  it("PCM 청크가 sendPcm으로 전달된다", async () => {
    await renderRecorderRealtime();

    fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));

    await vi.waitFor(() => {
      expect(sendPcm).toHaveBeenCalled();
    });
  });

  it("녹음 중지 시 stopRecording 후 finalizeStreaming이 호출된다", async () => {
    const { rerender } = await renderRecorderRealtime();

    fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
    await vi.waitFor(() => {
      expect(callOrder).toEqual(["prepareStreaming", "startRecording"]);
    });

    rerender(
      <MainAppProviders>
        <Recorder />
      </MainAppProviders>,
    );
    expect(screen.getByRole("button", { name: "녹음 중지" })).toBeTruthy();

    callOrder.length = 0;
    fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

    await vi.waitFor(() => {
      expect(callOrder).toEqual(["stopRecording", "finalizeStreaming"]);
    });
  });
});
