/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { SETTINGS_STORAGE_KEY } from "@/lib/settings/context";
import { Recorder } from "../recorder";

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
    status: "idle" as "idle" | "recording" | "transcribing" | "error",
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
    displayTranscript: null as string | null,
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
      displayTranscript: mocks.pipeline.displayTranscript,
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

describe("Recorder 단계별 UI", () => {
  beforeEach(() => {
    mocks.recorder.status = "idle";
    mocks.batch.status = "idle";
    mocks.batch.transcript = "";
    mocks.transcription.partial = "";
    mocks.transcription.finals = [];
    mocks.transcription.errorMessage = null;
    mocks.pipeline.displayTranscript = null;
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

  it("idle 상태에서도 reveal-session-context가 보인다", () => {
    renderRecorder();
    expect(screen.getByTestId("reveal-session-context")).not.toHaveAttribute(
      "aria-hidden",
    );
  });

  it("idle 상태에서 AI 요약 탭이 선택되어 있다", () => {
    renderRecorder();
    expect(screen.getByTestId("note-tab-summary")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("idle 상태에서 마이크 녹음 영역은 보인다", () => {
    renderRecorder();
    expect(screen.getByRole("region", { name: "마이크 녹음" })).toBeTruthy();
  });

  it("스트리밍 녹음 중이면 session-context reveal이 aria-hidden이 아니다", () => {
    mocks.recorder.status = "recording";
    renderRecorder();
    expect(screen.getByTestId("reveal-session-context")).not.toHaveAttribute(
      "aria-hidden",
    );
  });

  it("스트리밍 녹음 중 스크립트가 없으면 partial 라이브 행이 없다", () => {
    mocks.recorder.status = "recording";
    mocks.transcription.partial = "";
    mocks.transcription.finals = [];
    renderRecorder();
    expect(screen.queryByTestId("transcript-partial")).toBeNull();
  });

  it("스트리밍 녹음 중 partial이 있으면 transcript partial 행이 렌더된다", () => {
    mocks.recorder.status = "recording";
    mocks.transcription.partial = "안녕";
    renderRecorder();
    expect(screen.getByTestId("transcript-partial")).toHaveTextContent("안녕");
  });

  it("스트리밍 녹음 중 finals만 있으면 transcript textarea에 반영된다", () => {
    mocks.recorder.status = "recording";
    mocks.transcription.partial = "";
    mocks.transcription.finals = ["확정 문장"];
    renderRecorder();
    expect(screen.getByTestId("transcript-textarea")).toHaveValue("확정 문장");
  });

  it("스트리밍 녹음 중 스크립트 없이 오류만 있으면 transcript 영역에 오류를 넣지 않고 카드에 표시한다", () => {
    mocks.recorder.status = "recording";
    mocks.transcription.errorMessage = "연결 실패";
    renderRecorder();
    expect(
      screen.getByTestId("transcript-view-card").querySelector('[role="alert"]'),
    ).toBeNull();
    expect(screen.getByText("연결 실패")).toBeInTheDocument();
  });

  it("Web Speech 모드에서도 녹음 중 partial이 있으면 transcript partial 행이 렌더된다", () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        mode: "webSpeechApi",
        batchModel: "whisper-1",
        language: "ko",
      }),
    );
    mocks.recorder.status = "recording";
    mocks.transcription.partial = "음성";
    renderRecorder();
    expect(screen.getByTestId("transcript-partial")).toHaveTextContent("음성");
  });

  it("배치 녹음 중이면 session-context reveal이 보인다", () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        mode: "batch",
        batchModel: "whisper-1",
        language: "ko",
      }),
    );
    mocks.batch.status = "recording";
    renderRecorder();
    expect(screen.getByTestId("reveal-session-context")).not.toHaveAttribute(
      "aria-hidden",
    );
  });

  it("배치 녹음 중 transcript가 비어 있으면 partial 라이브 행이 없다", () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        mode: "batch",
        batchModel: "whisper-1",
        language: "ko",
      }),
    );
    mocks.batch.status = "recording";
    mocks.batch.transcript = "";
    renderRecorder();
    expect(screen.queryByTestId("transcript-partial")).toBeNull();
  });

  it("배치 녹음 중 transcript가 있으면 textarea에 반영된다", () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        mode: "batch",
        batchModel: "whisper-1",
        language: "ko",
      }),
    );
    mocks.batch.status = "recording";
    mocks.batch.transcript = "첫 세그먼트";
    renderRecorder();
    expect(screen.getByTestId("transcript-textarea")).toHaveValue("첫 세그먼트");
  });

  it("배치 녹음 중 pipeline.displayTranscript만 있으면 textarea에 반영된다", () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        mode: "batch",
        batchModel: "whisper-1",
        language: "ko",
      }),
    );
    mocks.batch.status = "recording";
    mocks.batch.transcript = "";
    mocks.pipeline.displayTranscript = "파이프라인 표시";
    renderRecorder();
    expect(screen.getByTestId("transcript-textarea")).toHaveValue(
      "파이프라인 표시",
    );
  });

  it("보이는 reveal 래퍼에 transition·duration 클래스가 포함된다", () => {
    mocks.recorder.status = "recording";
    renderRecorder();
    const wrap = screen.getByTestId("reveal-session-context");
    expect(wrap.className).toMatch(/duration-300/);
    expect(wrap.className).toMatch(/ease-out/);
  });
});
