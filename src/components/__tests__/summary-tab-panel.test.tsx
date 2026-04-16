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
    expect(screen.getByText(/녹음을 시작하면 스크립트가 쌓이고/)).toBeTruthy();
    expect(screen.getByTestId("tab-panel-body")).toBeTruthy();
  });

  it("recording이면 녹음 중 안내를 보여준다", () => {
    render(<SummaryTabPanel state="recording" />);
    expect(screen.getByText(/녹음 중입니다/)).toBeTruthy();
  });

  it("summarizing이면 회의록 생성 중 문구를 보여준다", () => {
    render(<SummaryTabPanel state="summarizing" />);
    expect(screen.getByText(/회의록을 생성하는 중/)).toBeTruthy();
  });

  it("complete이면 회의록 본문 영역이 있다", () => {
    render(
      <SummaryTabPanel state="complete" summaryText="회의록 결과 텍스트" />,
    );
    expect(screen.getByTestId("summary-body").textContent).toContain(
      "회의록 결과 텍스트",
    );
  });

  it("complete에서 패널 상단의 중복 '회의록' 제목 문단이 없다", () => {
    render(<SummaryTabPanel state="complete" summaryText="본문만 있는 경우" />);
    const region = screen.getByRole("region", { name: "회의록 결과" });
    const paras = Array.from(region.querySelectorAll("p")).map((p) =>
      p.textContent?.trim(),
    );
    expect(paras).not.toContain("회의록");
  });

  it("error이면 오류 메시지를 보여준다", () => {
    render(<SummaryTabPanel state="error" errorMessage="실패함" />);
    expect(screen.getByText("실패함")).toBeTruthy();
  });
});
