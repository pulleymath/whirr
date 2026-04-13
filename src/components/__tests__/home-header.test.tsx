/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { HomePageShell } from "../home-page-shell";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

function renderShell() {
  return render(
    <MainAppProviders>
      <HomePageShell />
    </MainAppProviders>,
  );
}

describe("HomePageShell 헤더", () => {
  it("Whirr 텍스트가 보인다", () => {
    renderShell();
    expect(screen.getByRole("heading", { name: "Whirr" })).toBeTruthy();
  });

  it("Whirr는 홈(/)으로 가는 링크다", () => {
    renderShell();
    const whirr = screen.getByRole("link", { name: "Whirr" });
    expect(whirr.getAttribute("href")).toBe("/");
  });
});
