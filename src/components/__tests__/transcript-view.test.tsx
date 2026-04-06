/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TranscriptView } from "../transcript-view";

afterEach(() => {
  cleanup();
});

describe("TranscriptView", () => {
  it("partial만 있으면 라이브 영역에 표시한다", () => {
    render(<TranscriptView partial="안녕" finals={[]} />);
    expect(screen.getByTestId("transcript-partial").textContent).toContain(
      "안녕",
    );
  });

  it("final이 여러 개면 순서대로 목록에 표시한다", () => {
    render(<TranscriptView partial="" finals={["첫째.", "둘째."]} />);
    const list = screen.getByTestId("transcript-finals");
    expect(list.textContent).toContain("첫째.");
    expect(list.textContent).toContain("둘째.");
  });

  it("partial 없이 final만 있을 때 확정 목록만 보인다", () => {
    render(<TranscriptView partial="" finals={["완료 문장"]} />);
    expect(screen.getByTestId("transcript-partial").textContent).not.toContain(
      "완료 문장",
    );
    expect(screen.getByTestId("transcript-finals").textContent).toContain(
      "완료 문장",
    );
  });

  it("aria-live가 partial 영역에 있다", () => {
    render(<TranscriptView partial="진행 중" finals={[]} />);
    const live = screen.getByTestId("transcript-partial");
    expect(live.getAttribute("aria-live")).toBe("polite");
  });
});
