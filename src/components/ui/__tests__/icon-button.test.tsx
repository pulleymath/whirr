/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Copy } from "lucide-react";
import { IconButton } from "../icon-button";

afterEach(() => {
  cleanup();
});

describe("IconButton", () => {
  it("아이콘과 aria-label을 렌더링한다", () => {
    render(<IconButton icon={Copy} ariaLabel="복사" />);
    const btn = screen.getByRole("button", { name: "복사" });
    expect(btn.querySelector("svg")).toBeTruthy();
  });

  it("label prop이 있으면 아이콘 옆에 텍스트를 표시한다", () => {
    render(<IconButton icon={Copy} ariaLabel="복사" label="복사" />);
    expect(screen.getByText("복사")).toBeTruthy();
  });

  it("label이 없으면 아이콘만 표시하고 텍스트 라벨 노드가 없다", () => {
    render(<IconButton icon={Copy} ariaLabel="스크립트 텍스트 복사" />);
    expect(screen.queryByText("복사")).toBeNull();
  });

  it("disabled이면 클릭 핸들러가 호출되지 않는다", () => {
    const onClick = vi.fn();
    render(
      <IconButton icon={Copy} ariaLabel="복사" disabled onClick={onClick} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "복사" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("cursor-pointer 클래스가 기본 적용된다", () => {
    render(<IconButton icon={Copy} ariaLabel="복사" />);
    expect(screen.getByRole("button", { name: "복사" }).className).toMatch(
      /cursor-pointer/,
    );
  });

  it("disabled이면 cursor-not-allowed이다", () => {
    render(<IconButton icon={Copy} ariaLabel="복사" disabled />);
    expect(screen.getByRole("button", { name: "복사" }).className).toMatch(
      /cursor-not-allowed/,
    );
  });

  it("variant='ghost'이면 border-transparent가 있다", () => {
    render(<IconButton icon={Copy} ariaLabel="복사" variant="ghost" />);
    expect(screen.getByRole("button", { name: "복사" }).className).toMatch(
      /border-transparent/,
    );
  });

  it("variant='outline'이면 border가 있다", () => {
    render(<IconButton icon={Copy} ariaLabel="복사" variant="outline" />);
    expect(screen.getByRole("button", { name: "복사" }).className).toMatch(
      /\bborder\b/,
    );
  });

  it("variant='primary'이면 sky 배경이다(시스템 액센트)", () => {
    render(<IconButton icon={Copy} ariaLabel="복사" variant="primary" />);
    expect(screen.getByRole("button", { name: "복사" }).className).toMatch(
      /bg-sky-600/,
    );
  });
});
