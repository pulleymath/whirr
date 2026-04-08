/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SummaryTabPanel } from "../summary-tab-panel";

afterEach(() => {
  cleanup();
});

describe("SummaryTabPanel", () => {
  it("idle이면 녹음 전 안내를 보여준다", () => {
    render(<SummaryTabPanel state="idle" />);
    expect(screen.getByText(/녹음을 시작하면 전사가 쌓이고/)).toBeTruthy();
    expect(screen.getByTestId("tab-panel-body")).toBeTruthy();
  });

  it("recording이면 녹음 중 안내를 보여준다", () => {
    render(<SummaryTabPanel state="recording" />);
    expect(screen.getByText(/녹음 중입니다/)).toBeTruthy();
  });

  it("summarizing이면 요약 생성 중 문구를 보여준다", () => {
    render(<SummaryTabPanel state="summarizing" />);
    expect(screen.getByText(/요약을 생성하는 중/)).toBeTruthy();
  });

  it("complete이면 요약 본문 영역이 있다", () => {
    render(<SummaryTabPanel state="complete" summaryText="요약 결과 텍스트" />);
    expect(screen.getByTestId("summary-body").textContent).toContain(
      "요약 결과 텍스트",
    );
  });

  it("error이면 오류 메시지를 보여준다", () => {
    render(<SummaryTabPanel state="error" errorMessage="실패함" />);
    expect(screen.getByText("실패함")).toBeTruthy();
  });
});
