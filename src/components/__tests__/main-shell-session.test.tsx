/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { MainShell } from "../main-shell";
import { SessionDetail } from "@/components/session-detail";
import { getAllSessions } from "@/lib/db";

vi.mock("@/components/session-detail", () => ({
  SessionDetail: () => <div data-testid="session-detail-stub">세션 본문</div>,
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...mod,
    getAllSessions: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/sessions/abc",
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("MainShell + 세션 본문", () => {
  beforeEach(() => {
    vi.mocked(getAllSessions).mockResolvedValue([]);
  });

  it("헤더 Whirr와 세션 상세 슬롯이 함께 렌더된다", () => {
    render(
      <MainAppProviders>
        <MainShell>
          <div className="flex w-full justify-center">
            <SessionDetail />
          </div>
        </MainShell>
      </MainAppProviders>,
    );

    expect(screen.getByRole("heading", { name: "Whirr" })).toBeTruthy();
    expect(screen.getByTestId("session-detail-stub")).toBeTruthy();
  });
});
