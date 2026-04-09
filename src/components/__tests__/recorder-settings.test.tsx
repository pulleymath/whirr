/** @vitest-environment happy-dom */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { Recorder } from "../recorder";
import { SETTINGS_STORAGE_KEY } from "@/lib/settings/context";

const lastTranscriptionOptions = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

const prepareStreaming = vi.fn(async () => true);

vi.mock("@/hooks/use-transcription", () => ({
  useTranscription: (opts?: Record<string, unknown>) => {
    lastTranscriptionOptions.current = opts ?? null;
    return {
      partial: "",
      finals: [],
      errorMessage: null,
      prepareStreaming,
      sendPcm: vi.fn(),
      finalizeStreaming: vi.fn(),
    };
  },
}));

vi.mock("@/hooks/use-recorder", () => ({
  formatElapsed: () => "00:00",
  useRecorder: () => ({
    status: "idle",
    errorMessage: null,
    elapsedMs: 0,
    level: 0,
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  lastTranscriptionOptions.current = null;
  vi.clearAllMocks();
});

describe("Recorder + 설정", () => {
  beforeEach(() => {
    localStorage.clear();
    prepareStreaming.mockImplementation(async () => true);
  });

  it("realtime + openai일 때 prepareStreaming이 녹음 시작 시 호출된다", async () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ mode: "realtime", realtimeEngine: "openai" }),
    );

    render(
      <MainAppProviders>
        <Recorder />
      </MainAppProviders>,
    );

    await vi.waitFor(() => {
      expect(lastTranscriptionOptions.current).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));

    await vi.waitFor(() => {
      expect(prepareStreaming).toHaveBeenCalled();
    });
  });

  it("assemblyai 엔진이면 useTranscription에 PCM 프레이밍이 켜진다", async () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ mode: "realtime", realtimeEngine: "assemblyai" }),
    );

    render(
      <MainAppProviders>
        <Recorder />
      </MainAppProviders>,
    );

    await vi.waitFor(() => {
      expect(lastTranscriptionOptions.current?.useAssemblyAiPcmFraming).toBe(
        true,
      );
    });
  });

  it("batch 모드면 미지원 메시지를 보이고 prepareStreaming을 호출하지 않는다", async () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ mode: "batch" }),
    );

    render(
      <MainAppProviders>
        <Recorder />
      </MainAppProviders>,
    );

    await vi.waitFor(() => {
      expect(
        screen
          .getByTestId("recorder-root")
          .getAttribute("data-transcription-mode"),
      ).toBe("batch");
    });

    fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));

    await vi.waitFor(() => {
      expect(screen.getByText(/아직 지원되지 않는 모드/)).toBeTruthy();
    });
    expect(prepareStreaming).not.toHaveBeenCalled();
  });
});
