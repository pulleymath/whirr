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
import { SETTINGS_STORAGE_KEY } from "@/lib/settings/context";
import { Recorder } from "../recorder";

const mockEnqueue = vi.hoisted(() => vi.fn());
const pcmAttempt = vi.hoisted(() => ({ n: 0 }));

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
  saveSessionAudioSegment: vi.fn(async () => {}),
  updateSession: vi.fn(async () => {}),
}));

vi.mock("@/hooks/use-transcription", () => ({
  useTranscription: () => ({
    partial: "",
    finals: [],
    errorMessage: null,
    reconnectToast: null,
    prepareStreaming: vi.fn(async () => true),
    sendPcm: vi.fn(),
    finalizeStreaming: vi.fn(async () => undefined),
  }),
}));

vi.mock("@/hooks/use-batch-transcription", () => ({
  useBatchTranscription: () => ({
    startRecording: vi.fn(),
    stopAndTranscribe: vi.fn(),
    retryTranscription: vi.fn(),
    status: "idle" as const,
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

vi.mock("@/lib/audio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audio")>();
  return {
    ...actual,
    startPcmRecording: vi.fn(async () => {
      pcmAttempt.n += 1;
      if (pcmAttempt.n === 1) {
        throw new DOMException("", "NotAllowedError");
      }
      return {
        stop: vi.fn().mockResolvedValue(undefined),
        analyser: {
          frequencyBinCount: 128,
          getByteTimeDomainData: vi.fn(),
        } as unknown as AnalyserNode,
      };
    }),
  };
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  pcmAttempt.n = 0;
});

describe("Recorder: 마이크 권한 거부 후 재시도", () => {
  beforeEach(() => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        mode: "realtime",
        realtimeEngine: "openai",
        batchModel: "whisper-1",
        language: "ko",
      }),
    );
  });

  it("거부 시 권한 안내가 보이고, 다시 시작하면 녹음 중지가 나타난다", async () => {
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
      ).toBe("realtime");
    });

    fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));

    await waitFor(() => {
      expect(
        screen.getByText(/마이크 권한이 거부되었습니다/),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "녹음 중지" }),
      ).toBeInTheDocument();
    });
  });
});
