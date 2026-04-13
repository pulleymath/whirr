/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { MainShell } from "../main-shell";
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
});

describe("MainShell 사이드바 레이아웃", () => {
  beforeEach(() => {
    vi.mocked(getAllSessions).mockResolvedValue([]);
  });

  it("데스크톱용 aside는 md 이상에서만 보이도록 클래스가 있다", () => {
    const { container } = render(
      <MainAppProviders>
        <MainShell>
          <div data-testid="main-slot" />
        </MainShell>
      </MainAppProviders>,
    );
    const aside = container.querySelector("aside");
    expect(aside).toBeTruthy();
    expect(aside?.className).toMatch(/hidden/);
    expect(aside?.className).toMatch(/md:flex/);
  });

  it("사이드바 내부에 History 제목이 있다", () => {
    render(
      <MainAppProviders>
        <MainShell>
          <div data-testid="main-slot" />
        </MainShell>
      </MainAppProviders>,
    );
    // desktop aside 내부의 History
    const historyHeading = screen
      .getAllByText("History")
      .find((el) => el.closest("aside")?.className.includes("md:flex"));
    expect(historyHeading).toBeTruthy();
  });
});
