/** @vitest-environment happy-dom */
import { cleanup, render } from "@testing-library/react";
import { useMemo } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PipelineToastNotifier } from "../pipeline-toast-notifier";
import {
  PostRecordingPipelineContext,
  type PostRecordingPipelineContextValue,
} from "@/lib/post-recording-pipeline/context";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

function mkValue(
  partial: Partial<PostRecordingPipelineContextValue>,
): PostRecordingPipelineContextValue {
  return {
    phase: "idle",
    isBusy: false,
    errorMessage: null,
    summaryText: null,
    displayTranscript: null,
    completedSessionId: null,
    enqueue: vi.fn(),
    ...partial,
  };
}

function Harness({
  phase,
  completedSessionId,
}: {
  phase: PostRecordingPipelineContextValue["phase"];
  completedSessionId: string | null;
}) {
  const value = useMemo(
    () =>
      mkValue({
        phase,
        completedSessionId,
        isBusy: phase === "done",
      }),
    [phase, completedSessionId],
  );
  return (
    <PostRecordingPipelineContext.Provider value={value}>
      <PipelineToastNotifier />
    </PostRecordingPipelineContext.Provider>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PipelineToastNotifier", () => {
  it("phase가 done으로 전환되고 completedSessionId가 있으면 toast.success가 호출된다", () => {
    const { rerender } = render(
      <Harness phase="summarizing" completedSessionId={null} />,
    );
    rerender(<Harness phase="done" completedSessionId="abc" />);
    expect(toast.success).toHaveBeenCalledWith(
      "회의록이 완성되었습니다",
      expect.objectContaining({
        id: "pipeline-meeting-done",
        duration: 8000,
        action: expect.objectContaining({ label: "바로 보기" }),
      }),
    );
  });

  it("마운트 시점부터 phase가 done이면 토스트가 호출되지 않는다", () => {
    vi.mocked(toast.success).mockClear();
    render(<Harness phase="done" completedSessionId="sid-0" />);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("completedSessionId가 null이면 토스트가 호출되지 않는다", () => {
    const { rerender } = render(
      <Harness phase="summarizing" completedSessionId={null} />,
    );
    vi.mocked(toast.success).mockClear();
    rerender(<Harness phase="done" completedSessionId={null} />);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("토스트 action onClick 시 세션 상세 경로로 이동한다", () => {
    const assignSpy = vi
      .spyOn(window.location, "assign")
      .mockImplementation(() => {});
    const { rerender } = render(
      <Harness phase="summarizing" completedSessionId={null} />,
    );
    rerender(<Harness phase="done" completedSessionId="sid-1" />);
    const opts = vi.mocked(toast.success).mock.calls[0]![1] as unknown as {
      action: { onClick: () => void };
    };
    opts.action.onClick();
    expect(assignSpy).toHaveBeenCalledWith("/sessions/sid-1");
    assignSpy.mockRestore();
  });

  it("null을 렌더링한다", () => {
    const { container } = render(
      <Harness phase="idle" completedSessionId={null} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
