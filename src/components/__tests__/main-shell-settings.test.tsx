/** @vitest-environment happy-dom */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { MainShell } from "../main-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("MainShell 설정", () => {
  it("설정 버튼이 있고 aria-label을 만족한다", () => {
    render(
      <MainAppProviders>
        <MainShell>
          <span>child</span>
        </MainShell>
      </MainAppProviders>,
    );

    const btn = screen.getByRole("button", { name: "설정" });
    expect(btn).toBeTruthy();
  });

  it("설정 클릭 시 패널이 열리고 닫기로 닫힌다", async () => {
    render(
      <MainAppProviders>
        <MainShell>
          <span>child</span>
        </MainShell>
      </MainAppProviders>,
    );

    fireEvent.click(screen.getByRole("button", { name: "설정" }));

    await vi.waitFor(() => {
      expect(screen.getByRole("dialog", { name: "설정" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "설정" })).toBeNull();
    });
  });
});
