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
  it("노트 본문 tablist가 렌더링된다", () => {
    renderRecorder();
    expect(
      screen.getByRole("tablist", { name: "노트 본문" }),
    ).toBeInTheDocument();
  });

  it("AI 요약·스크립트 탭이 있다", () => {
    renderRecorder();
    expect(screen.getByRole("tab", { name: "AI 요약" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "스크립트" })).toBeInTheDocument();
  });

  it("idle에서는 AI 요약 탭이 선택되고 빈 partial 라이브 행은 렌더하지 않는다", () => {
    renderRecorder();
    expect(screen.getByTestId("note-tab-summary")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByTestId("transcript-partial")).toBeNull();
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
      errorMessage: "요약을 생성하지 못했습니다.",
    });
    expect(
      screen.getByTestId("recorder-pipeline-user-error"),
    ).toHaveTextContent("요약을 생성하지 못했습니다.");
  });
});
