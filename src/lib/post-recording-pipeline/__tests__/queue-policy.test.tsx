/** @vitest-environment happy-dom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, useRef } from "react";
import {
  PostRecordingPipelineProvider,
  usePostRecordingPipeline,
} from "../context";
import { updateSession } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  updateSession: vi.fn(async () => {}),
}));

const fetchMock = vi.fn();

const baseEnqueue = (sessionId: string, partialText: string) => ({
  sessionId,
  partialText,
  finalBlob: null as Blob | null,
  model: "whisper-1",
  language: "ko",
  meetingMinutesModel: "gpt-4o-mini",
  glossary: [] as string[],
  sessionContext: null,
  meetingTemplate: undefined,
  mode: "batch" as const,
  engine: undefined,
});

function FifoHarness() {
  const { enqueue } = usePostRecordingPipeline();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    enqueue(baseEnqueue("sess-fifo-a", "첫 번째"));
    enqueue(baseEnqueue("sess-fifo-b", "두 번째"));
  }, [enqueue]);
  return <div data-testid="fifo-mounted" />;
}

function DupInFlightHarness() {
  const { enqueue } = usePostRecordingPipeline();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const payload = baseEnqueue("sess-dup", "한 번만");
    enqueue(payload);
    enqueue(payload);
  }, [enqueue]);
  return <div data-testid="dup-mounted" />;
}

function DupPendingHarness() {
  const { enqueue } = usePostRecordingPipeline();
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          enqueue(baseEnqueue("sess-pend-a", "A"));
          enqueue(baseEnqueue("sess-pend-b", "B"));
          enqueue(baseEnqueue("sess-pend-a", "A중복"));
        }}
      >
        연속 enqueue
      </button>
    </div>
  );
}

describe("PostRecordingPipeline enqueue 정책", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.mocked(updateSession).mockReset();
    vi.mocked(updateSession).mockResolvedValue(undefined);
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ summary: "ok" }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("FIFO: 먼저 넣은 세션이 먼저 ready 상태로 저장된다", async () => {
    const readyOrder: string[] = [];
    vi.mocked(updateSession).mockImplementation(async (id, patch) => {
      if (patch.status === "ready") {
        readyOrder.push(id);
      }
    });

    render(
      <PostRecordingPipelineProvider>
        <FifoHarness />
      </PostRecordingPipelineProvider>,
    );

    await waitFor(
      () => {
        expect(readyOrder).toEqual(["sess-fifo-a", "sess-fifo-b"]);
      },
      { timeout: 15_000 },
    );
  }, 20_000);

  it("동일 sessionId를 처리 중에 다시 enqueue하면 무시한다", async () => {
    let readyCount = 0;
    vi.mocked(updateSession).mockImplementation(async (id, patch) => {
      if (id === "sess-dup" && patch.status === "ready") {
        readyCount += 1;
      }
    });

    render(
      <PostRecordingPipelineProvider>
        <DupInFlightHarness />
      </PostRecordingPipelineProvider>,
    );

    await waitFor(() => expect(readyCount).toBe(1), { timeout: 15_000 });
    expect(fetchMock.mock.calls.length).toBe(1);
  }, 20_000);

  it("대기열에 이미 있는 sessionId는 다시 넣지 않는다", async () => {
    const readyOrder: string[] = [];
    vi.mocked(updateSession).mockImplementation(async (id, patch) => {
      if (patch.status === "ready") {
        readyOrder.push(id);
      }
    });

    render(
      <PostRecordingPipelineProvider>
        <DupPendingHarness />
      </PostRecordingPipelineProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "연속 enqueue" }));

    await waitFor(
      () => {
        expect(readyOrder).toEqual(["sess-pend-a", "sess-pend-b"]);
      },
      { timeout: 15_000 },
    );
  }, 20_000);
});
