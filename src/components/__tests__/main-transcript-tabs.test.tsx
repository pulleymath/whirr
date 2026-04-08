/** @vitest-environment happy-dom */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MainTranscriptTabs } from "../main-transcript-tabs";

afterEach(() => {
  cleanup();
});

describe("MainTranscriptTabs", () => {
  it("탭 두 개와 tablist가 있다", () => {
    render(
      <MainTranscriptTabs
        transcriptPanel={<div data-testid="transcript-slot">T</div>}
        summaryPanel={<div data-testid="summary-slot">S</div>}
      />,
    );

    expect(screen.getByRole("tablist")).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "실시간 전사 텍스트" }),
    ).toBeTruthy();
    expect(screen.getByRole("tab", { name: "요약" })).toBeTruthy();
  });

  it("기본은 실시간 전사 탭이 선택되어 transcript 패널이 보인다", () => {
    render(
      <MainTranscriptTabs
        transcriptPanel={<div data-testid="transcript-slot">T</div>}
        summaryPanel={<div data-testid="summary-slot">S</div>}
      />,
    );

    const transcriptTab = screen.getByRole("tab", {
      name: "실시간 전사 텍스트",
    });
    expect(transcriptTab.getAttribute("aria-selected")).toBe("true");
    const transcriptPanel = screen
      .getByTestId("transcript-slot")
      .closest('[role="tabpanel"]');
    expect(transcriptPanel).toBeTruthy();
    expect(transcriptPanel!.hasAttribute("hidden")).toBe(false);
  });

  it("요약 탭을 누르면 요약 패널만 보인다", () => {
    render(
      <MainTranscriptTabs
        transcriptPanel={<div data-testid="transcript-slot">T</div>}
        summaryPanel={<div data-testid="summary-slot">S</div>}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "요약" }));

    const summaryPanel = screen
      .getByTestId("summary-slot")
      .closest('[role="tabpanel"]');
    const transcriptPanel = screen
      .getByTestId("transcript-slot")
      .closest('[role="tabpanel"]');
    expect(summaryPanel!.hasAttribute("hidden")).toBe(false);
    expect(transcriptPanel!.hasAttribute("hidden")).toBe(true);
  });
});
