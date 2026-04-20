/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionContextInput } from "../session-context-input";

const base = { participants: "", topic: "", keywords: "" };

afterEach(() => {
  cleanup();
});

describe("SessionContextInput", () => {
  it("참석자, 주제, 키워드 입력 필드가 렌더링된다", () => {
    const onChange = vi.fn();
    render(
      <SessionContextInput value={base} onChange={onChange} disabled={false} />,
    );
    expect(screen.getByTestId("session-context-participants")).toBeTruthy();
    expect(screen.getByTestId("session-context-topic")).toBeTruthy();
    expect(screen.getByTestId("session-context-keywords")).toBeTruthy();
  });

  it("입력 가이드 플레이스홀더가 표시된다", () => {
    const onChange = vi.fn();
    render(
      <SessionContextInput value={base} onChange={onChange} disabled={false} />,
    );
    expect(
      (
        screen.getByTestId(
          "session-context-participants",
        ) as HTMLTextAreaElement
      ).placeholder,
    ).toContain("고풀리 PM");
    expect(
      (screen.getByTestId("session-context-topic") as HTMLInputElement)
        .placeholder,
    ).toContain("2분기 제품 로드맵");
    expect(
      (screen.getByTestId("session-context-keywords") as HTMLInputElement)
        .placeholder,
    ).toContain("우선순위");
  });

  it("값 입력 시 onChange 콜백이 호출된다", () => {
    const onChange = vi.fn();
    render(
      <SessionContextInput value={base} onChange={onChange} disabled={false} />,
    );
    fireEvent.change(screen.getByTestId("session-context-topic"), {
      target: { value: "주제1" },
    });
    expect(onChange).toHaveBeenCalledWith({
      ...base,
      topic: "주제1",
    });
  });

  it("disabled=true이면 모든 입력이 비활성화된다", () => {
    const onChange = vi.fn();
    render(<SessionContextInput value={base} onChange={onChange} disabled />);
    expect(
      (
        screen.getByTestId(
          "session-context-participants",
        ) as HTMLTextAreaElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByTestId("session-context-topic") as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByTestId("session-context-keywords") as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });

  it("disabled=true이면 회의록 생성 중 안내가 표시된다", () => {
    const onChange = vi.fn();
    render(<SessionContextInput value={base} onChange={onChange} disabled />);
    expect(
      screen.getByText("회의록 생성 중에는 수정할 수 없습니다."),
    ).toBeTruthy();
  });

  it("접기/펼치기 토글이 동작한다", () => {
    const onChange = vi.fn();
    render(
      <SessionContextInput value={base} onChange={onChange} disabled={false} />,
    );
    expect(screen.getByTestId("session-context-topic")).toBeTruthy();
    const toggle = screen.getByRole("button", { name: /회의 정보/ });
    fireEvent.click(toggle);
    expect(screen.queryByTestId("session-context-topic")).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByTestId("session-context-topic")).toBeTruthy();
  });
});
