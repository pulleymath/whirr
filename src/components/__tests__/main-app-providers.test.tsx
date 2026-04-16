/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { useGlossary } from "@/lib/glossary/context";
import { usePostRecordingPipeline } from "@/lib/post-recording-pipeline/context";

function GlossaryConsumer() {
  const { glossary } = useGlossary();
  return <span data-testid="glossary-count">{glossary.terms.length}</span>;
}

function PipelineConsumer() {
  const { completedSessionId } = usePostRecordingPipeline();
  return <span data-testid="completed-id">{completedSessionId ?? "none"}</span>;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("MainAppProviders", () => {
  it("GlossaryProvider 하위에서 useGlossary를 사용할 수 있다", async () => {
    render(
      <MainAppProviders>
        <GlossaryConsumer />
      </MainAppProviders>,
    );
    await vi.waitFor(() => {
      expect(screen.getByTestId("glossary-count").textContent).toBe("0");
    });
  });

  it("PostRecordingPipelineProvider 하위에서 파이프라인 훅을 사용할 수 있다", async () => {
    render(
      <MainAppProviders>
        <PipelineConsumer />
      </MainAppProviders>,
    );
    await vi.waitFor(() => {
      expect(screen.getByTestId("completed-id").textContent).toBe("none");
    });
  });
});
