/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RevealSection } from "../recorder-reveal-section";

function mockReducedMotion(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query === "(prefers-reduced-motion: reduce)" ? matches : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RevealSection", () => {
  it("모션 허용 시 숨김 상태에 blur·translate 클래스가 있다", () => {
    mockReducedMotion(false);
    render(
      <RevealSection visible={false} testId="reveal-test">
        <span>내용</span>
      </RevealSection>,
    );
    const el = screen.getByTestId("reveal-test");
    expect(el.className).toMatch(/blur-sm/);
    expect(el.className).toMatch(/translate-y-2/);
  });

  it("prefers-reduced-motion이면 blur·translate·transition 보조 클래스가 없다", () => {
    mockReducedMotion(true);
    render(
      <RevealSection visible={false} testId="reveal-test">
        <span>내용</span>
      </RevealSection>,
    );
    const el = screen.getByTestId("reveal-test");
    expect(el.className).not.toMatch(/blur-sm/);
    expect(el.className).not.toMatch(/translate-y-2/);
    expect(el.className).not.toMatch(/motion-safe:transition/);
  });
});
