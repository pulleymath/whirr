/** @vitest-environment happy-dom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeContent } from "../home-content";
import { getAllSessions } from "@/lib/db";

vi.mock("@/lib/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...mod,
    getAllSessions: vi.fn(),
  };
});

vi.mock("@/hooks/use-transcription", () => ({
  useTranscription: () => ({
    partial: "",
    finals: [],
    errorMessage: null,
    prepareStreaming: vi.fn(async () => true),
    sendPcm: vi.fn(),
    finalizeStreaming: vi.fn(async () => {}),
  }),
}));

vi.mock("@/hooks/use-recorder", () => ({
  formatElapsed: () => "00:00",
  useRecorder: () => ({
    status: "idle",
    errorMessage: null,
    elapsedMs: 0,
    level: 0,
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

describe("History 사이드바", () => {
  beforeEach(() => {
    vi.mocked(getAllSessions).mockResolvedValue([]);
  });

  it("데스크톱용 aside는 md 이상에서만 보이도록 클래스가 있다", () => {
    const { container } = render(
      <HomeContent drawerOpen={false} onCloseDrawer={vi.fn()}>
        <div data-testid="main-slot" />
      </HomeContent>,
    );
    const aside = container.querySelector("aside");
    expect(aside).toBeTruthy();
    expect(aside?.className).toMatch(/hidden/);
    expect(aside?.className).toMatch(/md:block/);
  });
});
