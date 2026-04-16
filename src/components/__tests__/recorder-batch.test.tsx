/** @vitest-environment happy-dom */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { saveSession } from "@/lib/db";
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
      enqueue: mockEnqueue,
    }),
  };
});

vi.mock("@/lib/db", () => ({
  saveSession: vi.fn(async () => "batch-saved-id"),
  saveSessionAudio: vi.fn(async () => {}),
}));

const prepareStreaming = vi.fn(async () => true);

vi.mock("@/hooks/use-transcription", () => ({
  useTranscription: () => ({
    partial: "",
    finals: [],
    errorMessage: null,
    prepareStreaming,
    sendPcm: vi.fn(),
    finalizeStreaming: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-recorder", () => ({
  formatElapsed: (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `00:${String(s).padStart(2, "0")}`;
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
    rotateSegment: vi.fn(async () => new Blob(["x"], { type: "audio/webm" })),
    stopFinalSegment: vi.fn(
      async () => new Blob(["x"], { type: "audio/webm" }),
    ),
    close: vi.fn(async () => {}),
  })),
);

vi.mock("@/lib/audio", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/audio")>();
  return { ...mod, startSegmentedRecording };
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("Recorder 배치 모드", () => {
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
      return new Response(JSON.stringify({ text: "배치 스크립트 결과" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
  });

  it("녹음 중 안내 문구를 표시한다", async () => {
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
      expect(
        screen.getByText(
          /녹음 중입니다\. 5분마다 스크립트 결과가 업데이트됩니다/,
        ),
      ).toBeTruthy();
    });
    expect(prepareStreaming).not.toHaveBeenCalled();
  });

  it("중지 시 세션을 먼저 저장하고 파이프라인 enqueue를 호출한다", async () => {
    render(
      <MainAppProviders>
        <Recorder onSessionSaved={vi.fn()} />
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
      expect(screen.getByRole("button", { name: "녹음 중지" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

    await vi.waitFor(() => {
      expect(saveSession).toHaveBeenCalledWith("", { status: "transcribing" });
    });
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "batch-saved-id",
        partialText: "",
        model: "whisper-1",
        language: "ko",
        meetingMinutesModel: "gpt-5.4-nano",
      }),
    );
  });
});
