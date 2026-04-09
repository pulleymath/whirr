/** @vitest-environment happy-dom */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { saveSession } from "@/lib/db";
import { SETTINGS_STORAGE_KEY } from "@/lib/settings/context";
import { Recorder } from "../recorder";

vi.mock("@/lib/db", () => ({
  saveSession: vi.fn(async () => "batch-saved-id"),
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

const startBlobRecording = vi.hoisted(() =>
  vi.fn(async () => ({
    analyser: {
      frequencyBinCount: 128,
      getByteTimeDomainData: vi.fn(),
    },
    stop: vi.fn(async () => new Blob(["x"], { type: "audio/webm" })),
  })),
);

vi.mock("@/lib/audio", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/audio")>();
  return { ...mod, startBlobRecording };
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
      return new Response(JSON.stringify({ text: "배치 전사 결과" }), {
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
        screen.getByText(/녹음 중입니다\. 녹음을 종료하면 전사가 시작됩니다/),
      ).toBeTruthy();
    });
    expect(prepareStreaming).not.toHaveBeenCalled();
  });

  it("전사 중 로딩 문구를 표시한다", async () => {
    let resolveStop: (() => void) | undefined;
    const stopPromise = new Promise<Blob>((resolve) => {
      resolveStop = () => resolve(new Blob(["a"], { type: "audio/webm" }));
    });
    const stopDeferred = vi.fn(() => stopPromise);
    startBlobRecording.mockImplementationOnce(async () => ({
      analyser: {
        frequencyBinCount: 128,
        getByteTimeDomainData: vi.fn(),
      },
      stop: stopDeferred,
    }));

    let resolveFetch: ((v: Response) => void) | undefined;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    globalThis.fetch = vi.fn(() => fetchPromise) as unknown as typeof fetch;

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
      expect(screen.getByRole("button", { name: "녹음 중지" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));
    resolveStop?.();
    await vi.waitFor(() => {
      expect(stopDeferred).toHaveBeenCalled();
    });

    await vi.waitFor(() => {
      expect(screen.getByTestId("transcript-loading").textContent).toContain(
        "전사 중...",
      );
    });

    resolveFetch?.(
      new Response(JSON.stringify({ text: "완료" }), { status: 200 }),
    );

    await vi.waitFor(() => {
      expect(saveSession).toHaveBeenCalledWith("완료");
    });
  });

  it("전사 완료 후 세션을 저장한다", async () => {
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
      expect(saveSession).toHaveBeenCalledWith("배치 전사 결과");
    });
  });
});
