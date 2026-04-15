/** @vitest-environment happy-dom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionList } from "@/components/session-list";
import { getAllSessions } from "@/lib/db";
import { RecordingActivityProvider } from "@/lib/recording-activity/context";

function wrapSessionList(node: ReactNode) {
  return <RecordingActivityProvider>{node}</RecordingActivityProvider>;
}

const pathnameRef = vi.hoisted(() => ({ current: "/" as string }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

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
    pathnameRef.current = "/";
    vi.mocked(getAllSessions).mockResolvedValue([]);
  });

  it("getAllSessions 결과를 날짜 그룹으로 렌더한다", async () => {
    const day = new Date(2024, 5, 15, 14, 30, 0).getTime();
    vi.mocked(getAllSessions).mockResolvedValue([
      { id: "a", createdAt: day, text: "첫 번째 메모" },
      { id: "b", createdAt: day + 3600_000, text: "두 번째 메모" },
    ]);

    render(wrapSessionList(<SessionList />));

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

    render(wrapSessionList(<SessionList />));

    await waitFor(() => {
      expect(screen.getByText("hello preview")).toBeTruthy();
    });
  });

  it("현재 경로와 id가 같으면 해당 링크에 aria-current=page가 있다", async () => {
    vi.mocked(getAllSessions).mockResolvedValue([
      {
        id: "abc",
        createdAt: new Date(2024, 5, 15, 14, 30, 0).getTime(),
        text: "메모",
      },
    ]);
    pathnameRef.current = "/sessions/abc";

    render(wrapSessionList(<SessionList />));

    await waitFor(() => {
      const link = screen.getByRole("link");
      expect(link.getAttribute("aria-current")).toBe("page");
    });
  });

  it("홈 경로일 때 세션 링크에 aria-current가 없다", async () => {
    pathnameRef.current = "/";
    vi.mocked(getAllSessions).mockResolvedValue([
      {
        id: "x",
        createdAt: new Date(2024, 5, 15, 9, 0, 0).getTime(),
        text: "t",
      },
    ]);

    render(wrapSessionList(<SessionList />));

    await waitFor(() => {
      const link = screen.getByRole("link");
      expect(link.getAttribute("aria-current")).toBeNull();
    });
  });

  it("활성 세션 링크에 포커스 링 클래스가 포함된다", async () => {
    vi.mocked(getAllSessions).mockResolvedValue([
      {
        id: "abc",
        createdAt: new Date(2024, 5, 15, 14, 30, 0).getTime(),
        text: "메모",
      },
    ]);
    pathnameRef.current = "/sessions/abc";

    render(wrapSessionList(<SessionList />));

    await waitFor(() => {
      const link = screen.getByRole("link");
      expect(link.className).toMatch(/focus-visible:ring/);
    });
  });

  it("refreshTrigger가 바뀌면 getAllSessions를 다시 호출한다", async () => {
    vi.mocked(getAllSessions).mockResolvedValue([]);

    const { rerender } = render(
      wrapSessionList(<SessionList refreshTrigger={0} />),
    );
    await waitFor(() => {
      expect(screen.queryByText("불러오는 중…")).toBeNull();
    });

    vi.mocked(getAllSessions).mockClear();
    rerender(wrapSessionList(<SessionList refreshTrigger={1} />));
    await waitFor(() => expect(getAllSessions).toHaveBeenCalledTimes(1));
  });
});
