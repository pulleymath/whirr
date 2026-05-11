/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { saveSession, saveSessionAudio } from "@/lib/db";
import { SETTINGS_STORAGE_KEY } from "@/lib/settings/context";
import { Recorder } from "../recorder";

const mockEnqueue = vi.hoisted(() => vi.fn());

const mocks = vi.hoisted(() => ({
  pipeline: {
    isBusy: false,
  },
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
    start: vi.fn(async () => {
      mocks.recorder.status = "recording";
    }),
    stop: vi.fn(async () => {
      mocks.recorder.status = "idle";
    }),
  },
  batch: {
    startRecording: vi.fn(async () => {
      mocks.batch.status = "recording";
    }),
    stopAndTranscribe: vi.fn(async () => ({
      partialText: "배치 스크립트 결과",
      finalBlob: new Blob(["final"], { type: "audio/webm" }),
      segments: [new Blob(["seg"], { type: "audio/webm" })],
    })),
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
      isBusy: mocks.pipeline.isBusy,
      errorMessage: null,
      summaryText: null,
      displayTranscript: null,
      completedSessionId: null,
      enqueue: mockEnqueue,
    }),
  };
});

vi.mock("@/lib/db", () => ({
  saveSession: vi.fn(async () => "saved-id"),
  saveSessionAudio: vi.fn(async () => undefined),
}));

function renderRecorder() {
  return render(
    <MainAppProviders>
      <Recorder />
    </MainAppProviders>,
  );
}

function setBatchMode() {
  localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      mode: "batch",
      batchModel: "whisper-1",
      language: "ko",
    }),
  );
}

function setRealtimeMode() {
  localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      mode: "realtime",
      realtimeEngine: "openai",
      batchModel: "whisper-1",
      language: "ko",
    }),
  );
}

beforeEach(() => {
  mocks.recorder.status = "idle";
  mocks.batch.status = "idle";
  mocks.batch.transcript = "";
  mocks.pipeline.isBusy = false;
  mocks.transcription.partial = "";
  mocks.transcription.finals = [];
  mocks.transcription.errorMessage = null;
  mocks.batch.stopAndTranscribe.mockImplementation(async () => ({
    partialText: "배치 스크립트 결과",
    finalBlob: new Blob(["final"], { type: "audio/webm" }),
    segments: [new Blob(["seg"], { type: "audio/webm" })],
  }));
  vi.mocked(saveSession).mockReset();
  vi.mocked(saveSession).mockResolvedValue("saved-id");
  vi.mocked(saveSessionAudio).mockReset();
  vi.mocked(saveSessionAudio).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("Recorder 녹음 전 회의 컨텍스트 입력", () => {
  describe("Step 1: idle 상태에서도 회의 정보·회의록 형식 노출", () => {
    it("idle 상태에서 reveal-session-context가 보인다(aria-hidden이 아니다)", () => {
      setBatchMode();
      renderRecorder();
      expect(screen.getByTestId("reveal-session-context")).not.toHaveAttribute(
        "aria-hidden",
      );
    });

    it("idle 상태에서 session-context-input과 meeting-template-selector가 DOM에 렌더링된다", () => {
      setBatchMode();
      renderRecorder();
      expect(screen.getByTestId("session-context-input")).toBeInTheDocument();
      expect(
        screen.getByTestId("meeting-template-selector"),
      ).toBeInTheDocument();
    });
  });

  describe("Step 3: 회의 정보가 비어 있어도 녹음 시작 가능", () => {
    it("회의 정보가 모두 비어 있어도 시작 버튼은 활성화되어 있고 클릭하면 startRecording이 호출된다", async () => {
      setBatchMode();
      renderRecorder();

      const startButton = screen.getByRole("button", { name: "녹음 시작" });
      expect(startButton).not.toBeDisabled();
      fireEvent.click(startButton);

      await vi.waitFor(() => {
        expect(mocks.batch.startRecording).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("Step 4: 녹음 전 입력 → enqueue payload 반영", () => {
    it("배치 모드 — 녹음 전 입력한 참석자·주제·키워드가 enqueue payload의 sessionContext에 들어간다", async () => {
      setBatchMode();
      const { rerender } = renderRecorder();

      fireEvent.change(screen.getByTestId("session-context-participants"), {
        target: { value: "고풀리 PM, 이풀리 엔지니어" },
      });
      fireEvent.change(screen.getByTestId("session-context-topic"), {
        target: { value: "2분기 로드맵" },
      });
      fireEvent.change(screen.getByTestId("session-context-keywords"), {
        target: { value: "우선순위, 리스크" },
      });

      fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
      await vi.waitFor(() => {
        expect(mocks.batch.startRecording).toHaveBeenCalled();
      });

      mocks.batch.status = "recording";
      rerender(
        <MainAppProviders>
          <Recorder />
        </MainAppProviders>,
      );

      fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

      await vi.waitFor(() => {
        expect(mockEnqueue).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionContext: {
              participants: "고풀리 PM, 이풀리 엔지니어",
              topic: "2분기 로드맵",
              keywords: "우선순위, 리스크",
            },
          }),
        );
      });
    });

    it("배치 모드 — 녹음 전에 선택한 회의록 형식이 enqueue payload의 meetingTemplate에 들어간다", async () => {
      setBatchMode();
      const { rerender } = renderRecorder();

      fireEvent.change(screen.getByTestId("meeting-template-selector"), {
        target: { value: "informationSharing" },
      });

      fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
      await vi.waitFor(() => {
        expect(mocks.batch.startRecording).toHaveBeenCalled();
      });

      mocks.batch.status = "recording";
      rerender(
        <MainAppProviders>
          <Recorder />
        </MainAppProviders>,
      );

      fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

      await vi.waitFor(() => {
        expect(mockEnqueue).toHaveBeenCalledWith(
          expect.objectContaining({
            meetingTemplate: { id: "informationSharing" },
          }),
        );
      });
    });

    it("배치 모드 — saveSession 옵션에 노트 제목이 포함된다", async () => {
      setBatchMode();
      const { rerender } = renderRecorder();

      fireEvent.change(screen.getByTestId("recorder-note-title"), {
        target: { value: "주간 제품 회의" },
      });

      fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
      await vi.waitFor(() => {
        expect(mocks.batch.startRecording).toHaveBeenCalled();
      });

      mocks.batch.status = "recording";
      rerender(
        <MainAppProviders>
          <Recorder />
        </MainAppProviders>,
      );

      fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

      await vi.waitFor(() => {
        expect(vi.mocked(saveSession)).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            title: "주간 제품 회의",
            status: "transcribing",
          }),
        );
      });
    });

    it("배치 모드 — 노트 제목을 비워 두면 saveSession에 '새로운 노트'가 넘어간다", async () => {
      setBatchMode();
      const { rerender } = renderRecorder();

      fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
      await vi.waitFor(() => {
        expect(mocks.batch.startRecording).toHaveBeenCalled();
      });

      mocks.batch.status = "recording";
      rerender(
        <MainAppProviders>
          <Recorder />
        </MainAppProviders>,
      );

      fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

      await vi.waitFor(() => {
        expect(vi.mocked(saveSession)).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            title: "새로운 노트",
            status: "transcribing",
          }),
        );
      });
    });
  });

  describe("Step 5: 배치 모드 — enqueue 성공 후 입력 초기화", () => {
    it("enqueue 성공 후 sessionContext 입력 필드가 빈 값으로 초기화된다", async () => {
      setBatchMode();
      const { rerender } = renderRecorder();

      const participants = screen.getByTestId(
        "session-context-participants",
      ) as HTMLInputElement;
      const topic = screen.getByTestId(
        "session-context-topic",
      ) as HTMLInputElement;
      const keywords = screen.getByTestId(
        "session-context-keywords",
      ) as HTMLInputElement;

      fireEvent.change(participants, { target: { value: "고풀리 PM" } });
      fireEvent.change(topic, { target: { value: "로드맵" } });
      fireEvent.change(keywords, { target: { value: "리스크" } });

      fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
      await vi.waitFor(() => {
        expect(mocks.batch.startRecording).toHaveBeenCalled();
      });

      mocks.batch.status = "recording";
      rerender(
        <MainAppProviders>
          <Recorder />
        </MainAppProviders>,
      );

      fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

      await vi.waitFor(() => {
        expect(mockEnqueue).toHaveBeenCalled();
      });
      await vi.waitFor(() => {
        expect(
          (
            screen.getByTestId(
              "session-context-participants",
            ) as HTMLInputElement
          ).value,
        ).toBe("");
      });
      expect(
        (screen.getByTestId("session-context-topic") as HTMLInputElement).value,
      ).toBe("");
      expect(
        (screen.getByTestId("session-context-keywords") as HTMLInputElement)
          .value,
      ).toBe("");
    });

    it("enqueue 성공 후 meetingTemplate이 기본값으로 초기화된다", async () => {
      setBatchMode();
      const { rerender } = renderRecorder();

      fireEvent.change(screen.getByTestId("meeting-template-selector"), {
        target: { value: "informationSharing" },
      });
      expect(
        (screen.getByTestId("meeting-template-selector") as HTMLSelectElement)
          .value,
      ).toBe("informationSharing");

      fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
      await vi.waitFor(() => {
        expect(mocks.batch.startRecording).toHaveBeenCalled();
      });

      mocks.batch.status = "recording";
      rerender(
        <MainAppProviders>
          <Recorder />
        </MainAppProviders>,
      );

      fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

      await vi.waitFor(() => {
        expect(mockEnqueue).toHaveBeenCalled();
      });
      await vi.waitFor(() => {
        expect(
          (screen.getByTestId("meeting-template-selector") as HTMLSelectElement)
            .value,
        ).toBe("default");
      });
    });
  });

  describe("Step 6: 스트리밍 모드 — enqueue 성공 후 입력 초기화", () => {
    it("enqueue 성공 후 sessionContext 입력 필드가 빈 값으로 초기화된다", async () => {
      setRealtimeMode();
      const { rerender } = renderRecorder();

      fireEvent.change(screen.getByTestId("session-context-participants"), {
        target: { value: "이풀리 엔지니어" },
      });
      fireEvent.change(screen.getByTestId("session-context-topic"), {
        target: { value: "기술 회의" },
      });

      fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
      await vi.waitFor(() => {
        expect(mocks.recorder.start).toHaveBeenCalled();
      });

      mocks.recorder.status = "recording";
      mocks.transcription.finals = ["오늘 회의 시작합니다"];
      rerender(
        <MainAppProviders>
          <Recorder />
        </MainAppProviders>,
      );

      fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

      await vi.waitFor(() => {
        expect(mockEnqueue).toHaveBeenCalled();
      });
      await vi.waitFor(() => {
        expect(
          (
            screen.getByTestId(
              "session-context-participants",
            ) as HTMLInputElement
          ).value,
        ).toBe("");
      });
      expect(
        (screen.getByTestId("session-context-topic") as HTMLInputElement).value,
      ).toBe("");
    });

    it("enqueue 성공 후 meetingTemplate이 기본값으로 초기화된다", async () => {
      setRealtimeMode();
      const { rerender } = renderRecorder();

      fireEvent.change(screen.getByTestId("meeting-template-selector"), {
        target: { value: "business" },
      });

      fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
      await vi.waitFor(() => {
        expect(mocks.recorder.start).toHaveBeenCalled();
      });

      mocks.recorder.status = "recording";
      mocks.transcription.finals = ["회의 시작"];
      rerender(
        <MainAppProviders>
          <Recorder />
        </MainAppProviders>,
      );

      fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

      await vi.waitFor(() => {
        expect(mockEnqueue).toHaveBeenCalled();
      });
      await vi.waitFor(() => {
        expect(
          (screen.getByTestId("meeting-template-selector") as HTMLSelectElement)
            .value,
        ).toBe("default");
      });
    });
  });

  describe("Phase 5 보강: pipeline.isBusy=true 분기에서 회의 정보 입력 비활성·안내 노출", () => {
    it("배치 모드 — pipeline.isBusy일 때 참석자·주제·키워드와 회의록 형식 선택이 disabled가 되고 안내 문구가 노출된다", () => {
      setBatchMode();
      mocks.pipeline.isBusy = true;
      renderRecorder();

      expect(screen.getByTestId("session-context-participants")).toBeDisabled();
      expect(screen.getByTestId("session-context-topic")).toBeDisabled();
      expect(screen.getByTestId("session-context-keywords")).toBeDisabled();
      expect(screen.getByTestId("meeting-template-selector")).toBeDisabled();
      expect(
        screen.getByText("요약 생성 중에는 수정할 수 없습니다."),
      ).toBeInTheDocument();
    });

    it("배치 모드 — pipeline이 idle이면 동일 필드가 모두 활성 상태이고 안내 문구가 보이지 않는다", () => {
      setBatchMode();
      mocks.pipeline.isBusy = false;
      renderRecorder();

      expect(
        screen.getByTestId("session-context-participants"),
      ).not.toBeDisabled();
      expect(screen.getByTestId("session-context-topic")).not.toBeDisabled();
      expect(screen.getByTestId("session-context-keywords")).not.toBeDisabled();
      expect(
        screen.getByTestId("meeting-template-selector"),
      ).not.toBeDisabled();
      expect(
        screen.queryByText("요약 생성 중에는 수정할 수 없습니다."),
      ).not.toBeInTheDocument();
    });
  });

  describe("Step 7: 저장 실패 시 입력값 유지 및 오류 표시", () => {
    it("배치 모드 — saveSession 실패 시 sessionContext·meetingTemplate이 유지되고 오류 문구가 표시된다", async () => {
      setBatchMode();
      vi.mocked(saveSession).mockRejectedValueOnce(new Error("quota exceeded"));

      const { rerender } = renderRecorder();

      fireEvent.change(screen.getByTestId("session-context-participants"), {
        target: { value: "고풀리 PM" },
      });
      fireEvent.change(screen.getByTestId("session-context-topic"), {
        target: { value: "긴급 이슈 점검" },
      });
      fireEvent.change(screen.getByTestId("recorder-note-title"), {
        target: { value: "실패 후 유지 제목" },
      });
      fireEvent.change(screen.getByTestId("meeting-template-selector"), {
        target: { value: "business" },
      });

      fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
      await vi.waitFor(() => {
        expect(mocks.batch.startRecording).toHaveBeenCalled();
      });

      mocks.batch.status = "recording";
      rerender(
        <MainAppProviders>
          <Recorder />
        </MainAppProviders>,
      );

      fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));

      await vi.waitFor(() => {
        const alert = screen.getByTestId("recorder-pipeline-user-error");
        expect(alert).toHaveTextContent("세션을 저장하지 못했습니다.");
      });

      expect(mockEnqueue).not.toHaveBeenCalled();
      expect(
        (screen.getByTestId("session-context-participants") as HTMLInputElement)
          .value,
      ).toBe("고풀리 PM");
      expect(
        (screen.getByTestId("session-context-topic") as HTMLInputElement).value,
      ).toBe("긴급 이슈 점검");
      expect(
        (screen.getByTestId("recorder-note-title") as HTMLInputElement).value,
      ).toBe("실패 후 유지 제목");
      expect(
        (screen.getByTestId("meeting-template-selector") as HTMLSelectElement)
          .value,
      ).toBe("business");
    });
  });
});
