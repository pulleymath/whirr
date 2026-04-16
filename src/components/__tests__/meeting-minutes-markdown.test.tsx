/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MeetingMinutesMarkdown } from "../meeting-minutes-markdown";

afterEach(() => {
  cleanup();
});

describe("MeetingMinutesMarkdown", () => {
  it("제목·목록 등 마크다운을 렌더한다", () => {
    render(
      <MeetingMinutesMarkdown
        markdown={`## 논의 요지
- 첫째 항목
- **강조** 텍스트`}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "논의 요지" }),
    ).toBeTruthy();
    expect(screen.getByText("첫째 항목")).toBeTruthy();
    expect(screen.getByText("강조")).toBeTruthy();
  });

  it("GFM 테이블을 렌더한다", () => {
    const md = `| a | b |
|---|---|
| 1 | 2 |`;
    render(<MeetingMinutesMarkdown markdown={md} />);
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "a" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "2" })).toBeTruthy();
  });
});
