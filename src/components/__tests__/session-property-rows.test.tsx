/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SessionPropertyRowsEditable,
  SessionPropertyRowsReadOnly,
} from "@/components/session-property-rows";
import type { SessionContext } from "@/lib/glossary/types";
import type { MeetingMinutesTemplate } from "@/lib/meeting-minutes/templates";

const EMPTY_CTX: SessionContext = {
  participants: "",
  topic: "",
  keywords: "",
};

afterEach(() => {
  cleanup();
});

describe("SessionPropertyRowsReadOnly", () => {
  it("참석자·주제·키워드·요약 형식 값을 텍스트로 렌더한다", () => {
    const ctx: SessionContext = {
      participants: "김 PM",
      topic: "로드맵",
      keywords: "리스크",
    };
    const template: MeetingMinutesTemplate = { id: "default" };
    render(
      <SessionPropertyRowsReadOnly
        sessionContext={ctx}
        meetingTemplate={template}
      />,
    );
    expect(screen.getByText("김 PM")).toBeInTheDocument();
    expect(screen.getByText("로드맵")).toBeInTheDocument();
    expect(screen.getByText("리스크")).toBeInTheDocument();
    expect(screen.getByText("기본회의")).toBeInTheDocument();
  });

  it("빈 값은 — 로 표시한다", () => {
    render(
      <SessionPropertyRowsReadOnly
        sessionContext={EMPTY_CTX}
        meetingTemplate={{ id: "default" }}
      />,
    );
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("편집용 textbox·combobox가 없다", () => {
    render(
      <SessionPropertyRowsReadOnly
        sessionContext={{
          participants: "a",
          topic: "b",
          keywords: "c",
        }}
        meetingTemplate={{ id: "default" }}
      />,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("SessionPropertyRowsEditable", () => {
  it("인풋 변경 시 onSessionContextChange가 호출된다", () => {
    const onSessionContextChange = vi.fn();
    render(
      <SessionPropertyRowsEditable
        sessionContext={EMPTY_CTX}
        onSessionContextChange={onSessionContextChange}
        meetingTemplate={{ id: "default" }}
        onMeetingTemplateChange={vi.fn()}
        disabled={false}
      />,
    );
    fireEvent.change(screen.getByTestId("session-context-participants"), {
      target: { value: "이 엔지니어" },
    });
    expect(onSessionContextChange).toHaveBeenCalledWith({
      ...EMPTY_CTX,
      participants: "이 엔지니어",
    });
  });

  it("disabled이면 인풋이 비활성이다", () => {
    render(
      <SessionPropertyRowsEditable
        sessionContext={{
          participants: "x",
          topic: "y",
          keywords: "z",
        }}
        onSessionContextChange={vi.fn()}
        meetingTemplate={{ id: "default" }}
        onMeetingTemplateChange={vi.fn()}
        disabled={true}
      />,
    );
    expect(screen.getByTestId("session-context-participants")).toBeDisabled();
    expect(screen.getByTestId("session-context-topic")).toBeDisabled();
    expect(screen.getByTestId("session-context-keywords")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "요약 형식" })).toBeDisabled();
  });

  it("요약 형식에 MeetingTemplateSelector(select)가 있다", () => {
    render(
      <SessionPropertyRowsEditable
        sessionContext={EMPTY_CTX}
        onSessionContextChange={vi.fn()}
        meetingTemplate={{ id: "informationSharing" }}
        onMeetingTemplateChange={vi.fn()}
        disabled={false}
      />,
    );
    const sel = screen.getByRole("combobox", { name: "요약 형식" });
    expect(sel).toBeInTheDocument();
    expect(sel).toHaveValue("informationSharing");
  });
});
