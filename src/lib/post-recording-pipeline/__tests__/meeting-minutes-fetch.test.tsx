/** @vitest-environment happy-dom */
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
}: {
  partialText: string;
  meetingMinutesModel: string;
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
    });
  }, [enqueue, partialText, meetingMinutesModel]);
  return null;
}

describe("PostRecordingPipeline → /api/meeting-minutes", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  it("fetch가 회의록 API로 가고 body에 text·model이 포함된다", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ summary: "회의록" }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <PostRecordingPipelineProvider>
        <EnqueueMeetingMinutes
          partialText="전사 본문"
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
      text: "전사 본문",
      model: "gpt-4o-mini",
    });
  });
});
