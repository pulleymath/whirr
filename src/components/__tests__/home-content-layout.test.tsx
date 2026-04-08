/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Recorder } from "../recorder";

afterEach(() => {
  cleanup();
});

const prepareStreaming = vi.fn(async () => true);
const finalizeStreaming = vi.fn(async () => {});
const sendPcm = vi.fn();

vi.mock("@/hooks/use-transcription", () => ({
  useTranscription: () => ({
    partial: "",
    finals: [],
    errorMessage: null,
    prepareStreaming,
    sendPcm,
    finalizeStreaming,
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

describe("HomeContent 레이아웃(Recorder)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("녹음 시작 버튼이 tablist보다 앞에 있다", () => {
    render(<Recorder />);

    const start = screen.getByRole("button", { name: "녹음 시작" });
    const tablist = screen.getByRole("tablist");
    const pos = start.compareDocumentPosition(tablist);
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("전사 영역은 tablist 뒤(탭 패널)에만 있다", () => {
    render(<Recorder />);

    const tablist = screen.getByRole("tablist");
    const partial = screen.getByTestId("transcript-partial");
    const pos = tablist.compareDocumentPosition(partial);
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
