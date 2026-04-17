/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { GlossaryProvider } from "@/lib/glossary/context";
import { Recorder } from "../recorder";
import {
  PostRecordingPipelineContext,
  type PostRecordingPipelineContextValue,
} from "@/lib/post-recording-pipeline/context";
import { RecordingActivityProvider } from "@/lib/recording-activity/context";
import { SettingsProvider } from "@/lib/settings/context";

vi.mock("@/hooks/use-transcription", () => ({
  useTranscription: () => ({
    partial: "",
    finals: [],
    errorMessage: null,
    reconnectToast: null,
    prepareStreaming: vi.fn().mockResolvedValue(true),
    sendPcm: vi.fn(),
    finalizeStreaming: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/hooks/use-recorder", () => ({
  formatElapsed: (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `00:${String(s % 60).padStart(2, "0")}`;
  },
  useRecorder: () => ({
    status: "idle",
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
    stopAndTranscribe: vi.fn(),
    retryTranscription: vi.fn(),
    status: "idle",
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

function renderRecorder() {
  return render(
    <MainAppProviders>
      <Recorder />
    </MainAppProviders>,
  );
}

const basePipeline: PostRecordingPipelineContextValue = {
  phase: "idle",
  isBusy: false,
  errorMessage: null,
  summaryText: null,
  displayTranscript: null,
  completedSessionId: null,
  enqueue: vi.fn(),
};

function renderRecorderWithPipeline(value: PostRecordingPipelineContextValue) {
  return render(
    <PostRecordingPipelineContext.Provider value={value}>
      <SettingsProvider>
        <GlossaryProvider>
          <RecordingActivityProvider>
            <Recorder />
          </RecordingActivityProvider>
        </GlossaryProvider>
      </SettingsProvider>
    </PostRecordingPipelineContext.Provider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("Recorder 홈 UI", () => {
  it("tablist가 렌더링되지 않는다", () => {
    renderRecorder();
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("회의록 탭 버튼이 존재하지 않는다", () => {
    renderRecorder();
    expect(screen.queryByRole("tab", { name: "회의록" })).toBeNull();
  });

  it("idle에서는 스크립트 reveal이 숨겨지고 partial 영역은 DOM에 남는다", () => {
    renderRecorder();
    expect(screen.getByTestId("reveal-transcript")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByTestId("transcript-partial")).toBeInTheDocument();
  });

  it("파이프라인 처리 중이면 안내 문구를 표시한다", () => {
    renderRecorderWithPipeline({
      ...basePipeline,
      phase: "summarizing",
      isBusy: true,
    });
    expect(screen.getByText(/이전 녹음을 처리 중입니다/)).toBeInTheDocument();
  });

  it("파이프라인 오류 메시지를 스크립트 영역 위에 표시한다", () => {
    renderRecorderWithPipeline({
      ...basePipeline,
      phase: "error",
      isBusy: false,
      errorMessage: "회의록을 생성하지 못했습니다.",
    });
    expect(
      screen.getByTestId("recorder-pipeline-user-error"),
    ).toHaveTextContent("회의록을 생성하지 못했습니다.");
  });
});
