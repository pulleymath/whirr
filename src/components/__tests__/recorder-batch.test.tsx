/** @vitest-environment happy-dom */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import {
  saveSession,
  saveSessionAudio,
  saveSessionAudioSegment,
  updateSession,
} from "@/lib/db";
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
      completedSessionId: null,
      enqueue: mockEnqueue,
    }),
  };
});

vi.mock("@/lib/db", () => ({
  saveSession: vi.fn(async () => "batch-saved-id"),
  saveSessionAudio: vi.fn(async () => {}),
  saveSessionAudioSegment: vi.fn(async () => {}),
  updateSession: vi.fn(async () => {}),
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
    rotateSegment: vi.fn(
      async () => new Blob(["rotated-segment"], { type: "audio/webm" }),
    ),
    stopFinalSegment: vi.fn(
      async () => new Blob(["final-segment"], { type: "audio/webm" }),
    ),
    getFullAudioBlob: vi.fn(
      async () => new Blob(["full-recording"], { type: "audio/webm" }),
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
        screen.getByPlaceholderText(
          /녹음 중입니다\. 3분마다 스크립트 결과가 업데이트됩니다/,
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
      expect(saveSession).toHaveBeenCalledWith(
        "",
        expect.objectContaining({
          status: "transcribing",
          scriptMeta: expect.objectContaining({ mode: "batch" }),
        }),
      );
    });
    await vi.waitFor(() => {
      expect(saveSessionAudio).toHaveBeenCalledWith(
        "batch-saved-id",
        expect.any(Array),
        expect.any(Blob),
      );
    });
    const savedAudioCall = vi.mocked(saveSessionAudio).mock.calls.at(-1);
    const savedAudioSegments = savedAudioCall?.[1];
    const savedFullBlob = savedAudioCall?.[2];
    expect(savedAudioSegments).toBeDefined();
    expect(savedAudioSegments).toHaveLength(1);
    if (!savedAudioSegments || !savedFullBlob) {
      throw new Error("저장된 오디오가 없습니다.");
    }
    await expect(savedAudioSegments[0].text()).resolves.toBe("final-segment");
    await expect(savedFullBlob.text()).resolves.toBe("full-recording");
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "batch-saved-id",
        partialText: "",
        model: "whisper-1",
        language: "ko",
        meetingMinutesModel: "gpt-5.4-nano",
        glossary: [],
        sessionContext: null,
        meetingTemplate: { id: "default" },
        mode: "batch",
        engine: undefined,
      }),
    );
  });

  it("정보전달 템플릿을 선택한 뒤 중지하면 enqueue에 meetingTemplate이 반영된다", async () => {
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

    fireEvent.change(screen.getByTestId("meeting-template-selector"), {
      target: { value: "informationSharing" },
    });

    fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

    await vi.waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          meetingTemplate: { id: "informationSharing" },
        }),
      );
    });
  });

  it("3분 경과 시 녹음 중 saveSession과 saveSessionAudioSegment가 호출된다", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.useFakeTimers();

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

    await vi.advanceTimersByTimeAsync(3 * 60 * 1000 + 1_000);
    await vi.waitFor(() => {
      expect(vi.mocked(saveSession).mock.calls.length).toBeGreaterThan(0);
    });
    await vi.waitFor(() => {
      expect(vi.mocked(saveSessionAudioSegment).mock.calls.length).toBeGreaterThan(
        0,
      );
    });
  });

  it("3분 후 제목을 수정하고 중지하면 updateSession에 최신 title이 반영된다", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.useFakeTimers();

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

    await vi.advanceTimersByTimeAsync(3 * 60 * 1000 + 1_000);
    await vi.waitFor(() => {
      expect(vi.mocked(saveSession).mock.calls.length).toBeGreaterThan(0);
    });

    vi.mocked(updateSession).mockClear();
    fireEvent.change(screen.getByTestId("recorder-note-title"), {
      target: { value: "수정된 제목" },
    });

    await vi.waitFor(() => {
      expect(updateSession).toHaveBeenCalledWith(
        "batch-saved-id",
        expect.objectContaining({ title: "수정된 제목" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

    await vi.waitFor(() => {
      expect(updateSession).toHaveBeenCalledWith(
        "batch-saved-id",
        expect.objectContaining({
          title: "수정된 제목",
          status: "transcribing",
        }),
      );
    });
  });

  it("3분 경과 후 중지하면 saveSessionAudio에 회전 세그먼트와 마지막 세그먼트가 모두 저장된다", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.useFakeTimers();

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

    await vi.advanceTimersByTimeAsync(3 * 60 * 1000 + 1_000);
    await vi.waitFor(() => {
      expect(vi.mocked(globalThis.fetch).mock.calls.length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

    await vi.waitFor(() => {
      const savedAudioSegments = vi
        .mocked(saveSessionAudio)
        .mock.calls.at(-1)?.[1];
      expect(savedAudioSegments).toBeDefined();
      expect(savedAudioSegments).toHaveLength(2);
    });

    const savedAudioSegments = vi
      .mocked(saveSessionAudio)
      .mock.calls.at(-1)?.[1];
    if (!savedAudioSegments) {
      throw new Error("저장된 오디오 세그먼트가 없습니다.");
    }
    await expect(savedAudioSegments[0].text()).resolves.toBe("rotated-segment");
    await expect(savedAudioSegments[1].text()).resolves.toBe("final-segment");
  });

  it("배치 전사 실패 후 중지해도 오디오는 저장되고 enqueue는 하지 않는다", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.useFakeTimers();

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "down" }), { status: 503 });
    }) as unknown as typeof fetch;

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

    await vi.advanceTimersByTimeAsync(3 * 60 * 1000 + 1_000);
    await vi.waitFor(() => {
      expect(vi.mocked(globalThis.fetch).mock.calls.length).toBeGreaterThan(0);
    });
    await vi.advanceTimersByTimeAsync(35_000);

    const enqueueCallsBeforeStop = mockEnqueue.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));
    await vi.advanceTimersByTimeAsync(40_000);

    await vi.waitFor(() => {
      expect(vi.mocked(saveSessionAudio).mock.calls.length).toBeGreaterThan(0);
    });
    expect(mockEnqueue.mock.calls.length).toBe(enqueueCallsBeforeStop);
    await vi.waitFor(() => {
      expect(vi.mocked(updateSession).mock.calls.some((c) => c[1]?.status === "error")).toBe(
        true,
      );
    });
  });

  it("배치 전사 실패 후 다시 시도하면 세션 저장과 파이프라인 enqueue가 호출된다", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.useFakeTimers();

    let sttFail = true;
    globalThis.fetch = vi.fn(async () => {
      if (sttFail) {
        return new Response(JSON.stringify({ error: "down" }), { status: 503 });
      }
      return new Response(JSON.stringify({ text: "복구 스크립트" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

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

    await vi.advanceTimersByTimeAsync(3 * 60 * 1000 + 1_000);
    await vi.waitFor(() => {
      expect(vi.mocked(globalThis.fetch).mock.calls.length).toBeGreaterThan(0);
    });
    await vi.advanceTimersByTimeAsync(35_000);

    const enqueueCallsBeforeStop = mockEnqueue.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));
    await vi.advanceTimersByTimeAsync(40_000);

    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: /다시 시도/ })).toBeTruthy();
    });

    expect(vi.mocked(saveSessionAudio).mock.calls.length).toBeGreaterThan(0);
    expect(mockEnqueue.mock.calls.length).toBe(enqueueCallsBeforeStop);

    sttFail = false;
    fireEvent.click(screen.getByRole("button", { name: /다시 시도/ }));
    await vi.advanceTimersByTimeAsync(40_000);

    await vi.waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalled();
    });
  });
});
