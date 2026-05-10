/** @vitest-environment happy-dom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionDetail } from "@/components/session-detail";
import { getSessionAudio, getSessionById } from "@/lib/db";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "%" }),
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

describe("SessionDetail: 잘못된 URL id", () => {
  it("decodeURIComponent 실패 시 세션 없음 안내를 보인다", async () => {
    render(<SessionDetail />);

    await waitFor(() => {
      expect(screen.getByText("세션을 찾을 수 없습니다.")).toBeInTheDocument();
    });

    expect(getSessionById).not.toHaveBeenCalled();
    expect(getSessionAudio).not.toHaveBeenCalled();
  });
});
