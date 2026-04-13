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
import { MainShell } from "../main-shell";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { getAllSessions } from "@/lib/db";

vi.mock("@/lib/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...mod,
    getAllSessions: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
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

describe("MainShell History drawer (Mobile)", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    vi.mocked(getAllSessions).mockResolvedValue([]);
  });

  it("햄버거 버튼 클릭 시 drawer dialog와 세션 목록이 보인다", async () => {
    render(
      <MainAppProviders>
        <MainShell>
          <div data-testid="main-slot" />
        </MainShell>
      </MainAppProviders>,
    );

    const openBtn = screen.getByLabelText("History 열기");
    fireEvent.click(openBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    await vi.waitFor(() => {
      expect(within(dialog).getByText("저장된 세션이 없습니다.")).toBeTruthy();
    });
  });

  it("열린 drawer 패널·백드롭에 전환용 클래스가 붙는다", async () => {
    render(
      <MainAppProviders>
        <MainShell>
          <div data-testid="main-slot" />
        </MainShell>
      </MainAppProviders>,
    );

    fireEvent.click(screen.getByLabelText("History 열기"));

    await waitFor(() => {
      const panel = screen.getByTestId("history-drawer-panel");
      expect(panel.className).toMatch(/transition-transform/);
    });

    const backdrop = screen.getByTestId("history-drawer-backdrop");
    expect(backdrop.className).toMatch(/transition-opacity/);
  });

  it("스크림 클릭 시 drawer가 닫힌다", async () => {
    render(
      <MainAppProviders>
        <MainShell>
          <div data-testid="main-slot" />
        </MainShell>
      </MainAppProviders>,
    );

    fireEvent.click(screen.getByLabelText("History 열기"));
    const scrim = screen.getByLabelText("History 닫기");
    fireEvent.click(scrim);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
