/** @vitest-environment happy-dom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PostRecordingPipelineProvider,
  usePostRecordingPipeline,
} from "../context";
import { useEffect } from "react";

vi.mock("@/lib/db", () => ({
  updateSession: vi.fn(async () => {}),
}));

const fetchMock = vi.fn();

function EnqueueMeetingMinutes({
  partialText,
  meetingMinutesModel,
  glossary,
  sessionContext,
}: {
  partialText: string;
  meetingMinutesModel: string;
  glossary?: string[];
  sessionContext?: {
    participants: string;
    topic: string;
    keywords: string;
  } | null;
}) {
  const { enqueue } = usePostRecordingPipeline();
  useEffect(() => {
    enqueue({
      sessionId: "pipe-test",
      partialText,
      finalBlob: null,
      model: "whisper-1",
      language: "ko",
      meetingMinutesModel,
      glossary,
      sessionContext,
    });
  }, [enqueue, partialText, meetingMinutesModel, glossary, sessionContext]);
  return null;
}

function PhaseRow() {
  const { phase, completedSessionId } = usePostRecordingPipeline();
  return (
    <div data-testid="pipeline-phase">{`${phase}:${completedSessionId ?? ""}`}</div>
  );
}

describe("PostRecordingPipeline → /api/meeting-minutes", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("fetch가 회의록 API로 가고 body에 text·model이 포함된다", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ summary: "회의록" }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <PostRecordingPipelineProvider>
        <EnqueueMeetingMinutes
          partialText="스크립트 본문"
          meetingMinutesModel="gpt-4o-mini"
        />
      </PostRecordingPipelineProvider>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/meeting-minutes",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      text: "스크립트 본문",
      model: "gpt-4o-mini",
    });
  });

  it("enqueue에 glossary와 sessionContext를 전달하면 fetch body에 포함된다", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ summary: "회의록" }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <PostRecordingPipelineProvider>
        <EnqueueMeetingMinutes
          partialText="본문"
          meetingMinutesModel="gpt-4o-mini"
          glossary={["A"]}
          sessionContext={{
            participants: "p",
            topic: "t",
            keywords: "k",
          }}
        />
      </PostRecordingPipelineProvider>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      text: "본문",
      model: "gpt-4o-mini",
      glossary: ["A"],
      sessionContext: {
        participants: "p",
        topic: "t",
        keywords: "k",
      },
    });
  });

  it("phase가 done이 되면 completedSessionId가 설정되고 idle에서 null로 초기화된다", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ summary: "회의록" }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <PostRecordingPipelineProvider>
        <PhaseRow />
        <EnqueueMeetingMinutes
          partialText="본문"
          meetingMinutesModel="gpt-4o-mini"
        />
      </PostRecordingPipelineProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("pipeline-phase").textContent).toBe(
        "done:pipe-test",
      );
    });

    await new Promise((r) => setTimeout(r, 2600));

    await waitFor(() => {
      expect(screen.getByTestId("pipeline-phase").textContent).toBe("idle:");
    });
  }, 10_000);
});
