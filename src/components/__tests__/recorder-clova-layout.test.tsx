/** @vitest-environment happy-dom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { Recorder } from "../recorder";
import {
  PostRecordingPipelineContext,
  type PostRecordingPipelineContextValue,
} from "@/lib/post-recording-pipeline/context";
import { GlossaryProvider } from "@/lib/glossary/context";
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

describe("Recorder 홈 레이아웃 (노트 작업면 + RecordingCard)", () => {
  it("마이크 녹음(RecordingCard)이 하단 플로팅 래퍼 안에 있다", () => {
    renderRecorder();
    const dock = screen.getByTestId("recording-card-dock");
    expect(
      within(dock).getByRole("region", { name: "마이크 녹음" }),
    ).toBeInTheDocument();
  });

  it("idle에서도 노트 제목·회의 필드·녹음 시작이 접근 가능하다", () => {
    renderRecorder();
    expect(screen.getByTestId("recorder-note-title")).toBeInTheDocument();
    expect(screen.getByTestId("session-context-input")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "녹음 시작" }),
    ).toBeInTheDocument();
  });

  it("파이프라인 처리 중 안내는 RecordingCard에 한 번만 노출된다", () => {
    renderRecorderWithPipeline({
      ...basePipeline,
      phase: "summarizing",
      isBusy: true,
    });
    const matches = screen.queryAllByText(/이전 녹음을 처리 중입니다/);
    expect(matches).toHaveLength(1);
  });

  it("요약 형식은 라디오가 아니라 select 드롭다운이다", () => {
    renderRecorder();
    expect(screen.queryByTestId("meeting-template-default")).toBeNull();
    expect(screen.getByTestId("meeting-template-selector").tagName).toBe(
      "SELECT",
    );
  });

  it("기본 선택된 탭은 AI 요약이다", () => {
    renderRecorder();
    expect(screen.getByRole("tab", { name: "AI 요약" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("요약 형식을 비즈니스 미팅으로 바꾸면 AI 요약 미리보기에 해당 구조가 보인다", () => {
    renderRecorder();
    fireEvent.change(screen.getByTestId("meeting-template-selector"), {
      target: { value: "business" },
    });
    expect(
      screen.getByTestId("meeting-minutes-template-preview"),
    ).toHaveTextContent("목적 / 상대 니즈");
  });

  it("스크립트 탭을 누르면 스크립트 카드가 보이고 요약 미리보기 패널은 숨긴다", () => {
    renderRecorder();
    fireEvent.click(screen.getByTestId("note-tab-script"));
    expect(screen.getByTestId("note-tab-script")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("transcript-view-card")).toBeInTheDocument();
    const preview = screen.getByTestId("meeting-minutes-template-preview");
    const summaryPanel = preview.closest('[role="tabpanel"]');
    expect(summaryPanel).toHaveAttribute("hidden");
  });

  it("직접입력 선택 시 AI 요약 탭에 형식 지침 textarea가 나타난다", () => {
    renderRecorder();
    fireEvent.change(screen.getByTestId("meeting-template-selector"), {
      target: { value: "custom" },
    });
    const editor = screen.getByTestId(
      "meeting-minutes-custom-prompt-editor",
    ) as HTMLTextAreaElement;
    expect(editor).toBeInTheDocument();
    fireEvent.change(editor, { target: { value: "## 나만의 섹션" } });
    expect(editor.value).toBe("## 나만의 섹션");
  });
});
