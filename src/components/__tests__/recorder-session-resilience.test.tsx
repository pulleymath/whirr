/** @vitest-environment happy-dom */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";

vi.mock("@/lib/stt", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/stt")>();
  return {
    ...mod,
    isWebSpeechApiSupported: () => true,
  };
});

import { Recorder } from "../recorder";

const SOFT_MS = 55 * 60 * 1000;

const resilienceState = vi.hoisted(() => ({
  reconnectToast: null as string | null,
  elapsedMs: 0,
  batchStatus: "idle" as
    | "idle"
    | "recording"
    | "transcribing"
    | "done"
    | "error",
  batchError: null as string | null,
  retryBatch: vi.fn(async () => null as string | null),
}));

const prepareStreaming = vi.fn(async () => true);
const finalizeStreaming = vi.fn(async () => {});
const sendPcm = vi.fn();

vi.mock("@/hooks/use-transcription", () => ({
  useTranscription: () => ({
    partial: "",
    finals: [],
    errorMessage: null,
    reconnectToast: resilienceState.reconnectToast,
    prepareStreaming,
    sendPcm,
    finalizeStreaming,
  }),
}));

const testRecorderState = vi.hoisted(() => ({
  status: "idle" as "idle" | "recording",
}));

vi.mock("@/hooks/use-recorder", () => ({
  formatElapsed: (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `00:${String(s).padStart(2, "0")}`;
  },
  useRecorder: () => ({
    get status() {
      return testRecorderState.status;
    },
    errorMessage: null,
    get elapsedMs() {
      return resilienceState.elapsedMs;
    },
    level: 0,
    start: async () => {
      testRecorderState.status = "recording";
    },
    stop: async () => {
      testRecorderState.status = "idle";
    },
  }),
}));

vi.mock("@/hooks/use-batch-transcription", () => ({
  useBatchTranscription: () => ({
    status: resilienceState.batchStatus,
    transcript: null,
    errorMessage: resilienceState.batchError,
    elapsedMs: 0,
    level: 0,
    softLimitMessage: null,
    segmentProgress: 0,
    segments: [],
    startRecording: vi.fn(),
    stopAndTranscribe: vi.fn(),
    retryTranscription: resilienceState.retryBatch,
  }),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

beforeEach(() => {
  resilienceState.reconnectToast = null;
  resilienceState.elapsedMs = 0;
  resilienceState.batchStatus = "idle";
  resilienceState.batchError = null;
  testRecorderState.status = "idle";
  vi.clearAllMocks();
  localStorage.setItem(
    "whirr:transcription-settings",
    JSON.stringify({
      mode: "realtime",
      realtimeEngine: "openai",
      batchModel: "whisper-1",
      language: "ko",
    }),
  );
});

function renderRecorder() {
  return render(
    <MainAppProviders>
      <Recorder />
    </MainAppProviders>,
  );
}

describe("Recorder 세션 복원력 UI", () => {
  it("실시간 녹음 중 55분 이상 경과 시 세션 갱신 안내를 표시한다", () => {
    testRecorderState.status = "recording";
    resilienceState.elapsedMs = SOFT_MS + 1000;
    renderRecorder();
    expect(screen.getByRole("button", { name: "녹음 중지" })).toBeDefined();
    expect(document.body.textContent).toContain("세션이 곧 갱신됩니다.");
  });

  it("Web Speech 모드에서 장시간 녹음 경고를 표시한다", async () => {
    localStorage.setItem(
      "whirr:transcription-settings",
      JSON.stringify({
        mode: "webSpeechApi",
        realtimeEngine: "openai",
        batchModel: "whisper-1",
        language: "ko",
      }),
    );
    testRecorderState.status = "recording";
    resilienceState.elapsedMs = SOFT_MS + 1000;
    renderRecorder();
    expect(screen.getByRole("button", { name: "녹음 중지" })).toBeDefined();
    expect(document.body.textContent).toContain(
      "녹음 시간이 길어지고 있습니다",
    );
  });

  it("재연결 토스트가 있으면 상태 영역에 표시한다", () => {
    resilienceState.reconnectToast = "연결을 복구하는 중입니다.";
    renderRecorder();
    expect(document.body.textContent).toContain("연결을 복구하는 중입니다.");
  });

  it("배치 스크립트 오류 시 다시 시도 버튼이 retryTranscription을 호출한다", async () => {
    localStorage.setItem(
      "whirr:transcription-settings",
      JSON.stringify({
        mode: "batch",
        realtimeEngine: "openai",
        batchModel: "whisper-1",
        language: "ko",
      }),
    );
    resilienceState.batchStatus = "error";
    resilienceState.batchError = "일시적 오류";
    renderRecorder();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(resilienceState.retryBatch).toHaveBeenCalledTimes(1);
  });
});
