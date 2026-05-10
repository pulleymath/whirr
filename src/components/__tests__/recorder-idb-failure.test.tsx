/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { saveSession, saveSessionAudio } from "@/lib/db";
import { SETTINGS_STORAGE_KEY } from "@/lib/settings/context";
import { Recorder } from "../recorder";

const mockEnqueue = vi.hoisted(() => vi.fn());

vi.mock("@/lib/post-recording-pipeline/context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/post-recording-pipeline/context")>();
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
  saveSession: vi.fn(),
  saveSessionAudio: vi.fn(),
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
      async () => new Blob(["rotated-segment"], { type: "audio/webm" }),
    ),
    stopFinalSegment: vi.fn(
      async () => new Blob(["final-segment"], { type: "audio/webm" }),
    ),
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

describe("Recorder: IndexedDB 저장 실패(배치 종료)", () => {
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
    vi.mocked(saveSession).mockReset();
    vi.mocked(saveSessionAudio).mockReset();
    vi.mocked(saveSession).mockResolvedValue("batch-saved-id");
    vi.mocked(saveSessionAudio).mockResolvedValue(undefined);
  });

  it("saveSession이 거부되면 오류를 알리고 파이프라인 enqueue는 호출되지 않는다", async () => {
    vi.mocked(saveSession).mockRejectedValueOnce(new Error("quota exceeded"));

    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => {});

    render(
      <MainAppProviders>
        <Recorder onSessionSaved={vi.fn()} />
      </MainAppProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("recorder-root").getAttribute("data-transcription-mode"),
      ).toBe("batch");
    });

    fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "녹음 중지" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

    await waitFor(() => {
      const alert = screen.getByTestId("recorder-pipeline-user-error");
      expect(alert).toHaveAttribute("role", "alert");
      expect(alert).toHaveTextContent("세션을 저장하지 못했습니다.");
    });

    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});
