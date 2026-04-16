/** @vitest-environment happy-dom */
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainTranscriptTabs } from "../main-transcript-tabs";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
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
    expect(screen.getByRole("tab", { name: "스크립트" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "회의록" })).toBeTruthy();
  });

  it("defaultActive가 summary이면 회의록 탭이 선택된다", () => {
    render(
      <MainTranscriptTabs
        defaultActive="summary"
        tabOrder="summary-first"
        transcriptPanel={<div data-testid="transcript-slot">T</div>}
        summaryPanel={<div data-testid="summary-slot">S</div>}
      />,
    );

    const summaryTab = screen.getByRole("tab", { name: "회의록" });
    expect(summaryTab.getAttribute("aria-selected")).toBe("true");
    const summaryPanel = screen
      .getByTestId("summary-slot")
      .closest('[role="tabpanel"]');
    expect(summaryPanel!.hasAttribute("hidden")).toBe(false);
  });

  it("tabOrder summary-first이면 회의록 탭이 tablist에서 먼저 온다", () => {
    render(
      <MainTranscriptTabs
        transcriptPanel={<div>T</div>}
        summaryPanel={<div>S</div>}
        tabOrder="summary-first"
      />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveTextContent("회의록");
    expect(tabs[1]).toHaveTextContent("스크립트");
  });

  it("기본은 실시간 스크립트 탭이 선택되어 transcript 패널이 보인다", () => {
    render(
      <MainTranscriptTabs
        transcriptPanel={<div data-testid="transcript-slot">T</div>}
        summaryPanel={<div data-testid="summary-slot">S</div>}
      />,
    );

    const transcriptTab = screen.getByRole("tab", {
      name: "스크립트",
    });
    expect(transcriptTab.getAttribute("aria-selected")).toBe("true");
    const transcriptPanel = screen
      .getByTestId("transcript-slot")
      .closest('[role="tabpanel"]');
    expect(transcriptPanel).toBeTruthy();
    expect(transcriptPanel!.hasAttribute("hidden")).toBe(false);
  });

  it("회의록 탭을 누르면 회의록 패널만 보인다", () => {
    render(
      <MainTranscriptTabs
        transcriptPanel={<div data-testid="transcript-slot">T</div>}
        summaryPanel={<div data-testid="summary-slot">S</div>}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "회의록" }));

    const summaryPanel = screen
      .getByTestId("summary-slot")
      .closest('[role="tabpanel"]');
    const transcriptTab = screen.getByRole("tab", {
      name: "스크립트",
    });
    const transcriptPanelId = transcriptTab.getAttribute("aria-controls");
    const transcriptPanel = document.getElementById(transcriptPanelId ?? "");
    expect(transcriptPanel).toBeTruthy();
    expect(summaryPanel!.hasAttribute("hidden")).toBe(false);
    expect(transcriptPanel!.hasAttribute("hidden")).toBe(true);
  });

  it("모션 허용 시 활성 패널 래퍼에 tab-panel-in 애니메이션이 설정된다", async () => {
    render(
      <MainTranscriptTabs
        transcriptPanel={<div data-testid="transcript-slot">T</div>}
        summaryPanel={<div data-testid="summary-slot">S</div>}
      />,
    );

    await waitFor(() => {
      const wrap = screen.getByTestId("tab-panel-motion-wrap");
      expect(wrap.getAttribute("style")).toMatch(/tab-panel-in/);
    });
  });

  it("reduced-motion이면 패널 래퍼에 애니메이션 스타일이 없다", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <MainTranscriptTabs
        transcriptPanel={<div data-testid="transcript-slot">T</div>}
        summaryPanel={<div data-testid="summary-slot">S</div>}
      />,
    );

    await waitFor(() => {
      const wrap = screen.getByTestId("tab-panel-motion-wrap");
      expect(wrap.getAttribute("style")).toBeNull();
    });
  });
});
