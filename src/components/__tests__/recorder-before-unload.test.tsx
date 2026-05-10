/** @vitest-environment happy-dom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { SETTINGS_STORAGE_KEY } from "@/lib/settings/context";
import { Recorder } from "../recorder";

const useBeforeUnloadSpy = vi.hoisted(() =>
  vi.fn((active: boolean) => {
    return active;
  }),
);

vi.mock("@/hooks/use-before-unload", () => ({
  useBeforeUnload: (active: boolean) => {
    useBeforeUnloadSpy(active);
  },
}));

const mocks = vi.hoisted(() => ({
  transcription: {
    partial: "",
    finals: [] as string[],
    errorMessage: null as string | null,
    reconnectToast: null as string | null,
    prepareStreaming: vi.fn(async () => true),
    sendPcm: vi.fn(),
    finalizeStreaming: vi.fn(async () => undefined),
  },
  recorder: {
    status: "idle" as "idle" | "recording",
    errorMessage: null as string | null,
    elapsedMs: 0,
    level: 0,
    start: vi.fn(),
    stop: vi.fn(),
  },
  batch: {
    startRecording: vi.fn(),
    stopAndTranscribe: vi.fn(),
    retryTranscription: vi.fn(),
    status: "idle" as "idle" | "recording" | "transcribing" | "error" | "done",
    elapsedMs: 0,
    level: 0,
    transcript: "" as string,
    errorMessage: null as string | null,
    sessionRef: { current: null },
    completedCount: 0,
    totalCount: 0,
    segmentProgress: 0,
    softLimitMessage: null as string | null,
    failedSegments: [] as unknown[],
    retryTotalCount: 0,
    retryProcessedCount: 0,
    segments: [] as unknown[],
  },
  pipeline: {
    phase: "idle" as "idle" | "transcribing" | "summarizing" | "done" | "error",
    isBusy: false,
  },
}));

vi.mock("@/hooks/use-transcription", () => ({
  useTranscription: () => mocks.transcription,
}));

vi.mock("@/hooks/use-recorder", () => ({
  formatElapsed: (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `00:${String(s % 60).padStart(2, "0")}`;
  },
  useRecorder: () => mocks.recorder,
}));

vi.mock("@/hooks/use-batch-transcription", () => ({
  useBatchTranscription: () => mocks.batch,
}));

vi.mock("@/lib/post-recording-pipeline/context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/post-recording-pipeline/context")>();
  return {
    ...actual,
    usePostRecordingPipeline: () => ({
      phase: mocks.pipeline.phase,
      isBusy: mocks.pipeline.isBusy,
      errorMessage: null,
      summaryText: null,
      displayTranscript: null,
      completedSessionId: null,
      enqueue: vi.fn(),
    }),
  };
});

function renderRecorder() {
  return render(
    <MainAppProviders>
      <Recorder />
    </MainAppProviders>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("Recorder → useBeforeUnload 보호 조건", () => {
  beforeEach(() => {
    mocks.recorder.status = "idle";
    mocks.batch.status = "idle";
    mocks.pipeline.phase = "idle";
    mocks.pipeline.isBusy = false;
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

  it("녹음·전사·뒷단 모두 아니면 보호를 끈다", () => {
    renderRecorder();
    expect(useBeforeUnloadSpy).toHaveBeenLastCalledWith(false);
  });

  it("스트리밍 녹음 중이면 보호를 켠다", () => {
    mocks.recorder.status = "recording";
    renderRecorder();
    expect(useBeforeUnloadSpy).toHaveBeenLastCalledWith(true);
  });

  it("배치 모드에서 일괄 전사 중이면 보호를 켠다", () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        mode: "batch",
        batchModel: "whisper-1",
        language: "ko",
      }),
    );
    mocks.batch.status = "transcribing";
    renderRecorder();
    expect(useBeforeUnloadSpy).toHaveBeenLastCalledWith(true);
  });

  it("뒷단 파이프라인이 바쁘면 보호를 켠다", () => {
    mocks.pipeline.phase = "summarizing";
    mocks.pipeline.isBusy = true;
    renderRecorder();
    expect(useBeforeUnloadSpy).toHaveBeenLastCalledWith(true);
  });

  it("배치 일괄 전사가 아닐 때는 transcribing만으로는 보호하지 않는다", () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        mode: "realtime",
        realtimeEngine: "openai",
        batchModel: "whisper-1",
        language: "ko",
      }),
    );
    mocks.batch.status = "transcribing";
    mocks.recorder.status = "idle";
    mocks.pipeline.isBusy = false;
    renderRecorder();
    expect(useBeforeUnloadSpy).toHaveBeenLastCalledWith(false);
  });
});
