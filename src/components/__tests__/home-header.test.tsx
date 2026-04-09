/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { HomePageShell } from "../home-page-shell";

vi.mock("@/components/home-content", () => ({
  HomeContent: () => <div data-testid="home-content-stub" />,
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

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

  it("Whirr를 링크나 버튼으로 감싸지 않는다", () => {
    renderShell();
    const whirr = screen.getByText("Whirr");
    expect(whirr.closest("a")).toBeNull();
    expect(whirr.closest("button")).toBeNull();
  });
});
