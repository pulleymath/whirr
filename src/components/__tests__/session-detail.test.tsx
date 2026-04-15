/** @vitest-environment happy-dom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionDetail } from "@/components/session-detail";
import { getSessionAudio, getSessionById } from "@/lib/db";

const mockBack = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "sess-1" }),
  useRouter: () => ({ back: mockBack }),
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...mod,
    getSessionById: vi.fn(),
    getSessionAudio: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
});

describe("SessionDetail", () => {
  beforeEach(() => {
    mockBack.mockClear();
    vi.mocked(getSessionById).mockReset();
    vi.mocked(getSessionAudio).mockResolvedValue(undefined);
  });

  it("세션이 있으면 전체 텍스트를 보여준다", async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      id: "sess-1",
      createdAt: 1,
      text: "전체 전사 본문",
    });

    render(<SessionDetail />);

    await waitFor(() => {
      expect(screen.getByText("전체 전사 본문")).toBeTruthy();
    });
  });

  it("세션이 없으면 안내와 홈 링크를 보여준다", async () => {
    vi.mocked(getSessionById).mockResolvedValue(undefined);

    render(<SessionDetail />);

    await waitFor(() => {
      expect(screen.getByText("세션을 찾을 수 없습니다.")).toBeTruthy();
    });

    expect(
      screen.getByRole("link", { name: "홈으로" }).getAttribute("href"),
    ).toBe("/");
  });

  it("getSessionById가 거부되면 오류 UI를 보이고 다시 시도 시 로드한다", async () => {
    vi.mocked(getSessionById)
      .mockRejectedValueOnce(new Error("idb"))
      .mockResolvedValueOnce({
        id: "sess-1",
        createdAt: 1,
        text: "재시도 후 본문",
      });

    render(<SessionDetail />);

    await waitFor(() => {
      expect(screen.getByText("세션을 불러오지 못했습니다.")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() => {
      expect(screen.getByText("재시도 후 본문")).toBeTruthy();
    });
  });

  it("뒤로 버튼이 router.back을 호출한다", async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      id: "sess-1",
      createdAt: 1,
      text: "t",
    });

    render(<SessionDetail />);

    await waitFor(() => {
      expect(screen.getByText("t")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "뒤로" }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("전사 복사 버튼이 클립보드에 텍스트를 넣는다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    });

    vi.mocked(getSessionById).mockResolvedValue({
      id: "sess-1",
      createdAt: 1,
      text: "복사할 내용",
    });

    render(<SessionDetail />);

    await waitFor(() => {
      expect(screen.getByText("복사할 내용")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "전사 텍스트 복사" }));
    expect(writeText).toHaveBeenCalledWith("복사할 내용");

    vi.unstubAllGlobals();
  });
});
