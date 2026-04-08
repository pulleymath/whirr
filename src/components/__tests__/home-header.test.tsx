/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomePageShell } from "../home-page-shell";

vi.mock("@/components/home-content", () => ({
  HomeContent: () => <div data-testid="home-content-stub" />,
}));

afterEach(() => {
  cleanup();
});

describe("HomePageShell 헤더", () => {
  it("Whirr 텍스트가 보인다", () => {
    render(<HomePageShell />);
    expect(screen.getByRole("heading", { name: "Whirr" })).toBeTruthy();
  });

  it("Whirr를 링크나 버튼으로 감싸지 않는다", () => {
    render(<HomePageShell />);
    const whirr = screen.getByText("Whirr");
    expect(whirr.closest("a")).toBeNull();
    expect(whirr.closest("button")).toBeNull();
  });
});
