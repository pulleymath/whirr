/** @vitest-environment happy-dom */
import {
  cleanup,
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
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
  vi.restoreAllMocks();
});

function mockMatchMedia(matchesReduce: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches:
      query === "(prefers-reduced-motion: reduce)" ? matchesReduce : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("History drawer", () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  it("drawerOpen이면 dialog와 세션 목록 영역이 보인다", async () => {
    vi.mocked(getAllSessions).mockResolvedValue([]);

    render(
      <HomeContent drawerOpen onCloseDrawer={vi.fn()}>
        <div data-testid="main-slot" />
      </HomeContent>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    await vi.waitFor(() => {
      expect(within(dialog).getByText("저장된 세션이 없습니다.")).toBeTruthy();
    });
  });

  it("열린 drawer 패널·백드롭에 전환용 클래스가 붙는다", async () => {
    vi.mocked(getAllSessions).mockResolvedValue([]);

    render(
      <HomeContent drawerOpen onCloseDrawer={vi.fn()}>
        <div data-testid="main-slot" />
      </HomeContent>,
    );

    await waitFor(() => {
      const panel = screen.getByTestId("history-drawer-panel");
      expect(panel.className).toMatch(/transition-transform/);
    });

    const backdrop = screen.getByTestId("history-drawer-backdrop");
    expect(backdrop.className).toMatch(/transition-opacity/);
  });

  it("prefers-reduced-motion이면 패널에 transition-transform이 없다", async () => {
    mockMatchMedia(true);
    vi.mocked(getAllSessions).mockResolvedValue([]);

    render(
      <HomeContent drawerOpen onCloseDrawer={vi.fn()}>
        <div data-testid="main-slot" />
      </HomeContent>,
    );

    await waitFor(() => {
      const panel = screen.getByTestId("history-drawer-panel");
      expect(panel.className).not.toMatch(/transition-transform/);
    });
  });

  it("스크림 클릭 시 onCloseDrawer가 호출된다", async () => {
    vi.mocked(getAllSessions).mockResolvedValue([]);
    const onClose = vi.fn();

    render(
      <HomeContent drawerOpen onCloseDrawer={onClose}>
        <div data-testid="main-slot" />
      </HomeContent>,
    );

    const scrim = screen.getByLabelText("History 닫기");
    fireEvent.click(scrim);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
