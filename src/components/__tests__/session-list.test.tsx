/** @vitest-environment happy-dom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionList } from "@/components/session-list";
import { getAllSessions } from "@/lib/db";

vi.mock("@/lib/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...mod,
    getAllSessions: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
});

describe("SessionList", () => {
  beforeEach(() => {
    vi.mocked(getAllSessions).mockResolvedValue([]);
  });

  it("getAllSessions 결과를 날짜 그룹으로 렌더한다", async () => {
    const day = new Date(2024, 5, 15, 14, 30, 0).getTime();
    vi.mocked(getAllSessions).mockResolvedValue([
      { id: "a", createdAt: day, text: "첫 번째 메모" },
      { id: "b", createdAt: day + 3600_000, text: "두 번째 메모" },
    ]);

    render(<SessionList />);

    await waitFor(() => {
      expect(screen.getAllByRole("link").length).toBe(2);
    });

    const links = screen.getAllByRole("link");
    expect(links[0]!.getAttribute("href")).toBe("/sessions/a");
    expect(links[1]!.getAttribute("href")).toBe("/sessions/b");
  });

  it("미리보기 텍스트가 보인다", async () => {
    vi.mocked(getAllSessions).mockResolvedValue([
      {
        id: "x",
        createdAt: new Date(2024, 5, 15, 9, 0, 0).getTime(),
        text: "hello preview",
      },
    ]);

    render(<SessionList />);

    await waitFor(() => {
      expect(screen.getByText("hello preview")).toBeTruthy();
    });
  });

  it("refreshTrigger가 바뀌면 getAllSessions를 다시 호출한다", async () => {
    vi.mocked(getAllSessions).mockResolvedValue([]);

    const { rerender } = render(<SessionList refreshTrigger={0} />);
    await waitFor(() => {
      expect(screen.queryByText("불러오는 중…")).toBeNull();
    });

    vi.mocked(getAllSessions).mockClear();
    rerender(<SessionList refreshTrigger={1} />);
    await waitFor(() => expect(getAllSessions).toHaveBeenCalledTimes(1));
  });
});
