/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecordButton } from "../record-button";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RecordButton", () => {
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

  it("mode='start'이면 원형 인디케이터(rounded-[50%])를 렌더링한다", () => {
    render(<RecordButton mode="start" onClick={() => {}} />);
    const el = screen.getByTestId("record-indicator");
    expect(el.className).toMatch(/rounded-\[50%\]/);
  });

  it("mode='stop'이면 둥근 사각형 인디케이터를 렌더링한다", () => {
    render(<RecordButton mode="stop" onClick={() => {}} />);
    const el = screen.getByTestId("record-indicator");
    expect(el.className).toMatch(/rounded-sm/);
    expect(el.className).not.toMatch(/rounded-\[50%\]/);
  });

  it("mode='start'이면 aria-label이 '녹음 시작'이다", () => {
    render(<RecordButton mode="start" onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "녹음 시작" })).toBeTruthy();
  });

  it("mode='stop'이면 aria-label이 '녹음 중지'이다", () => {
    render(<RecordButton mode="stop" onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "녹음 중지" })).toBeTruthy();
  });

  it("모션 허용 시 transition 클래스가 인디케이터에 적용된다", () => {
    render(<RecordButton mode="start" onClick={() => {}} />);
    expect(screen.getByTestId("record-indicator").className).toMatch(
      /transition/,
    );
  });

  it("prefers-reduced-motion이면 transition 클래스가 인디케이터에 없다", () => {
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
    render(<RecordButton mode="start" onClick={() => {}} />);
    expect(screen.getByTestId("record-indicator").className).not.toMatch(
      /transition-\[/,
    );
  });

  it("disabled이면 클릭 핸들러가 호출되지 않는다", () => {
    const onClick = vi.fn();
    render(<RecordButton mode="start" disabled onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("cursor-pointer 클래스가 적용된다", () => {
    render(<RecordButton mode="start" onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "녹음 시작" }).className).toMatch(
      /cursor-pointer/,
    );
  });

  it("클릭 시 onClick이 호출된다", () => {
    const onClick = vi.fn();
    render(<RecordButton mode="start" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
