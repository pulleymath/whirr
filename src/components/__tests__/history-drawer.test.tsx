/** @vitest-environment happy-dom */
import {
  cleanup,
  render,
  screen,
  fireEvent,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeContent } from "../home-content";
import { getAllSessions } from "@/lib/db";

vi.mock("@/lib/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...mod,
    getAllSessions: vi.fn(),
  };
});

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

describe("History drawer", () => {
  it("drawerOpen이면 dialog와 세션 목록 영역이 보인다", async () => {
    vi.mocked(getAllSessions).mockResolvedValue([]);

    render(<HomeContent drawerOpen onCloseDrawer={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    await vi.waitFor(() => {
      expect(within(dialog).getByText("저장된 세션이 없습니다.")).toBeTruthy();
    });
  });

  it("스크림 클릭 시 onCloseDrawer가 호출된다", async () => {
    vi.mocked(getAllSessions).mockResolvedValue([]);
    const onClose = vi.fn();

    render(<HomeContent drawerOpen onCloseDrawer={onClose} />);

    const scrim = screen.getByLabelText("History 닫기");
    fireEvent.click(scrim);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
