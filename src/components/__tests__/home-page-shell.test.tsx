/** @vitest-environment happy-dom */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAllSessions } from "@/lib/db";
import { HomePageShell } from "../home-page-shell";

vi.mock("@/lib/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...mod,
    getAllSessions: vi.fn(),
  };
});

const pathnameRef = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

vi.mock("@/hooks/use-transcription", () => ({
  useTranscription: () => ({
    partial: "",
    finals: [],
    errorMessage: null,
    prepareStreaming: vi.fn(async () => true),
    sendPcm: vi.fn(),
    finalizeStreaming: vi.fn(async () => {}),
  }),
}));

vi.mock("@/hooks/use-recorder", () => ({
  formatElapsed: () => "00:00",
  useRecorder: () => ({
    status: "idle",
    errorMessage: null,
    elapsedMs: 0,
    level: 0,
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

describe("HomePageShell", () => {
  beforeEach(() => {
    pathnameRef.current = "/";
    vi.mocked(getAllSessions).mockResolvedValue([]);
  });

  it("History 트리거로 drawer를 연 뒤 pathname이 바뀌면 drawer가 닫힌다", async () => {
    const { rerender } = render(<HomePageShell />);

    fireEvent.click(screen.getByRole("button", { name: "History 열기" }));
    expect(screen.getByRole("dialog")).toBeTruthy();

    pathnameRef.current = "/sessions/test-id";
    rerender(<HomePageShell />);

    await vi.waitFor(
      () => {
        expect(screen.queryByRole("dialog")).toBeNull();
      },
      { timeout: 500 },
    );
  });

  it("햄버거 트리거는 md:hidden 클래스로 데스크톱에서 숨김 처리된다", () => {
    render(<HomePageShell />);
    const trigger = screen.getByRole("button", { name: "History 열기" });
    expect(trigger.className).toMatch(/md:hidden/);
  });
});
