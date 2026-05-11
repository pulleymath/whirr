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
const stopResult = vi.hoisted(() => ({
  value: {
    partialText: "",
    finalBlob: null as Blob | null,
    segments: [] as Blob[],
  },
}));

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
  saveSession: vi.fn(async () => "id"),
  saveSessionAudio: vi.fn(async () => {}),
}));

vi.mock("@/hooks/use-transcription", () => ({
  useTranscription: () => ({
    partial: "",
    finals: [],
    errorMessage: null,
    reconnectToast: null,
    prepareStreaming: vi.fn(async () => true),
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

vi.mock("@/hooks/use-batch-transcription", () => ({
  useBatchTranscription: () => ({
    startRecording: vi.fn(),
    stopAndTranscribe: vi.fn(async () => stopResult.value),
    retryTranscription: vi.fn(),
    status: "recording" as const,
    elapsedMs: 0,
    level: 0,
    transcript: "",
    errorMessage: null,
    sessionRef: { current: null },
    completedCount: 0,
    totalCount: 0,
    segmentProgress: 0,
    softLimitMessage: null,
    failedSegments: [],
    retryTotalCount: 0,
    retryProcessedCount: 0,
    segments: [],
  }),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("Recorder: persistBatchResult 빈 결과", () => {
  beforeEach(() => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        mode: "batch",
        batchModel: "whisper-1",
        language: "ko",
      }),
    );
    stopResult.value = {
      partialText: "",
      finalBlob: null,
      segments: [],
    };
  });

  it("partialText trim 후 비어 있고 세그먼트가 없으면 저장·enqueue 하지 않는다", async () => {
    stopResult.value = {
      partialText: "  \n\t",
      finalBlob: null,
      segments: [],
    };

    render(
      <MainAppProviders>
        <Recorder />
      </MainAppProviders>,
    );

    await waitFor(() => {
      expect(
        screen
          .getByTestId("recorder-root")
          .getAttribute("data-transcription-mode"),
      ).toBe("batch");
    });

    fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

    await waitFor(() => {
      expect(saveSession).not.toHaveBeenCalled();
      expect(mockEnqueue).not.toHaveBeenCalled();
    });
  });

  it("partialText는 비어 있어도 세그먼트가 있으면 저장을 시도한다", async () => {
    const seg = new Blob(["x"], { type: "audio/webm" });
    stopResult.value = {
      partialText: "",
      finalBlob: null,
      segments: [seg],
    };

    render(
      <MainAppProviders>
        <Recorder />
      </MainAppProviders>,
    );

    await waitFor(() => {
      expect(
        screen
          .getByTestId("recorder-root")
          .getAttribute("data-transcription-mode"),
      ).toBe("batch");
    });

    fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

    await waitFor(() => {
      expect(saveSession).toHaveBeenCalled();
    });
    expect(saveSessionAudio).toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalled();
  });
});
