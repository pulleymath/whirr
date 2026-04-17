/** @vitest-environment happy-dom */
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { updateSession } from "@/lib/db";
import {
  PostRecordingPipelineProvider,
  usePostRecordingPipeline,
} from "../context";

vi.mock("@/lib/db", () => ({
  updateSession: vi.fn(async () => {}),
}));

const fetchMock = vi.fn();

function EnqueueOnce() {
  const { enqueue } = usePostRecordingPipeline();
  useEffect(() => {
    enqueue({
      sessionId: "s1",
      partialText: "hello",
      finalBlob: null,
      model: "whisper-1",
      language: "ko",
      meetingMinutesModel: "gpt-4o-mini",
      mode: "batch",
      engine: undefined,
    });
  }, [enqueue]);
  return null;
}

describe("PostRecordingPipeline scriptMeta persistence", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.mocked(updateSession).mockClear();
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  it("회의록 완료 시 updateSession에 scriptMeta가 포함된다", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ summary: "요약" }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <PostRecordingPipelineProvider>
        <EnqueueOnce />
      </PostRecordingPipelineProvider>,
    );

    await waitFor(() => {
      const last = vi.mocked(updateSession).mock.calls.at(-1);
      expect(last?.[0]).toBe("s1");
      expect(last?.[1]).toMatchObject({
        summary: "요약",
        status: "ready",
        scriptMeta: {
          mode: "batch",
          batchModel: "whisper-1",
          language: "ko",
          minutesModel: "gpt-4o-mini",
        },
      });
    });
  });
});
