/** @vitest-environment happy-dom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { saveSession, saveSessionAudio } from "@/lib/db";
import { SETTINGS_STORAGE_KEY } from "@/lib/settings/context";
import { Recorder } from "../recorder";

const mockEnqueue = vi.hoisted(() => vi.fn());

vi.mock("@/lib/post-recording-pipeline/context", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/post-recording-pipeline/context")
    >();
  return {
    ...actual,
    usePostRecordingPipeline: () => ({
      phase: "idle" as const,
      isBusy: false,
      errorMessage: null,
      summaryText: null,
      displayTranscript: null,
      completedSessionId: null,
      enqueue: mockEnqueue,
    }),
  };
});

vi.mock("@/lib/db", () => ({
  saveSession: vi.fn(async () => "saved-id"),
  saveSessionAudio: vi.fn(async () => {}),
  saveSessionAudioSegment: vi.fn(async () => {}),
  updateSession: vi.fn(async () => {}),
}));

const prepareStreaming = vi.fn(async () => true);

vi.mock("@/hooks/use-transcription", () => ({
  useTranscription: () => ({
    partial: "",
    finals: [],
    errorMessage: null,
    reconnectToast: null,
    prepareStreaming,
    sendPcm: vi.fn(),
    finalizeStreaming: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-recorder", () => ({
  formatElapsed: (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `00:${String(s % 60).padStart(2, "0")}`;
  },
  useRecorder: () => ({
    status: "idle" as const,
    errorMessage: null,
    elapsedMs: 0,
    level: 0,
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

const startSegmentedRecording = vi.hoisted(() =>
  vi.fn(async () => ({
    analyser: {
      frequencyBinCount: 128,
      getByteTimeDomainData: vi.fn(),
    },
    rotateSegment: vi.fn(
      async () => new Blob(["rotated"], { type: "audio/webm" }),
    ),
    stopFinalSegment: vi.fn(async () => new Blob([], { type: "audio/webm" })),
    getFullAudioBlob: vi.fn(async () => new Blob([], { type: "audio/webm" })),
    close: vi.fn(async () => {}),
  })),
);

vi.mock("@/lib/audio", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/audio")>();
  return { ...mod, startSegmentedRecording };
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("Recorder: 빈 녹음(배치)", () => {
  beforeEach(() => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        mode: "batch",
        batchModel: "whisper-1",
        language: "ko",
      }),
    );
    prepareStreaming.mockImplementation(async () => true);
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ text: "스크립트" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
  });

  it("마지막 세그먼트가 비어 있으면 세션을 저장하지 않고 enqueue도 하지 않는다", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => {});

    render(
      <MainAppProviders>
        <Recorder onSessionSaved={vi.fn()} />
      </MainAppProviders>,
    );

    await waitFor(() => {
      expect(
        screen
          .getByTestId("recorder-root")
          .getAttribute("data-transcription-mode"),
      ).toBe("batch");
    });

    fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "녹음 중지" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

    await waitFor(() => {
      expect(saveSession).not.toHaveBeenCalled();
      expect(saveSessionAudio).not.toHaveBeenCalled();
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "녹음 시작" })).toBeEnabled();
    });
  });
});
