/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MeetingTemplateSelector } from "../meeting-template-selector";
import { DEFAULT_MEETING_MINUTES_TEMPLATE } from "@/lib/meeting-minutes/templates";

afterEach(() => {
  cleanup();
});

describe("MeetingTemplateSelector", () => {
  it("네 가지 템플릿 라디오가 렌더링된다", () => {
    const onChange = vi.fn();
    render(
      <MeetingTemplateSelector
        value={DEFAULT_MEETING_MINUTES_TEMPLATE}
        onChange={onChange}
        disabled={false}
      />,
    );
    expect(screen.getByTestId("meeting-template-default")).toBeTruthy();
    expect(
      screen.getByTestId("meeting-template-informationSharing"),
    ).toBeTruthy();
    expect(screen.getByTestId("meeting-template-business")).toBeTruthy();
    expect(screen.getByTestId("meeting-template-custom")).toBeTruthy();
  });

  it("informationSharing 선택 시 onChange가 호출된다", () => {
    const onChange = vi.fn();
    render(
      <MeetingTemplateSelector
        value={DEFAULT_MEETING_MINUTES_TEMPLATE}
        onChange={onChange}
        disabled={false}
      />,
    );
    fireEvent.click(screen.getByTestId("meeting-template-informationSharing"));
    expect(onChange).toHaveBeenCalledWith({ id: "informationSharing" });
  });

  it("custom 선택 시 텍스트 영역이 나타난다", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <MeetingTemplateSelector
        value={DEFAULT_MEETING_MINUTES_TEMPLATE}
        onChange={onChange}
        disabled={false}
      />,
    );
    fireEvent.click(screen.getByTestId("meeting-template-custom"));
    expect(onChange).toHaveBeenCalledWith({ id: "custom", prompt: "" });
    rerender(
      <MeetingTemplateSelector
        value={{ id: "custom", prompt: "" }}
        onChange={onChange}
        disabled={false}
      />,
    );
    expect(screen.getByTestId("meeting-template-custom-prompt")).toBeTruthy();
  });

  it("custom 프롬프트 입력 시 onChange가 호출된다", () => {
    const onChange = vi.fn();
    render(
      <MeetingTemplateSelector
        value={{ id: "custom", prompt: "a" }}
        onChange={onChange}
        disabled={false}
      />,
    );
    fireEvent.change(screen.getByTestId("meeting-template-custom-prompt"), {
      target: { value: "## 섹션\n" },
    });
    expect(onChange).toHaveBeenCalledWith({
      id: "custom",
      prompt: "## 섹션\n",
    });
  });

  it("disabled이면 필드가 비활성화된다", () => {
    const onChange = vi.fn();
    render(
      <MeetingTemplateSelector
        value={{ id: "custom", prompt: "x" }}
        onChange={onChange}
        disabled
      />,
    );
    expect(
      (screen.getByTestId("meeting-template-default") as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByTestId(
          "meeting-template-custom-prompt",
        ) as HTMLTextAreaElement
      ).disabled,
    ).toBe(true);
  });

  it("select variant는 라디오 대신 드롭다운을 렌더한다", () => {
    const onChange = vi.fn();
    render(
      <MeetingTemplateSelector
        value={DEFAULT_MEETING_MINUTES_TEMPLATE}
        onChange={onChange}
        variant="select"
      />,
    );
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByTestId("meeting-template-selector").tagName).toBe(
      "SELECT",
    );
  });

  it("select variant에서 business 선택 시 onChange가 호출된다", () => {
    const onChange = vi.fn();
    render(
      <MeetingTemplateSelector
        value={DEFAULT_MEETING_MINUTES_TEMPLATE}
        onChange={onChange}
        variant="select"
      />,
    );
    fireEvent.change(screen.getByTestId("meeting-template-selector"), {
      target: { value: "business" },
    });
    expect(onChange).toHaveBeenCalledWith({ id: "business" });
  });

  it("select variant에서는 custom 프롬프트 textarea를 렌더하지 않는다", () => {
    render(
      <MeetingTemplateSelector
        value={{ id: "custom", prompt: "hi" }}
        onChange={vi.fn()}
        variant="select"
      />,
    );
    expect(screen.queryByTestId("meeting-template-custom-prompt")).toBeNull();
  });
});
