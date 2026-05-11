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
import { fetchMeetingMinutesSummary } from "@/lib/meeting-minutes/fetch-meeting-minutes-client";
import { getSessionAudio, getSessionById, updateSession } from "@/lib/db";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "sess-1" }),
}));

vi.mock("@/lib/meeting-minutes/fetch-meeting-minutes-client", () => ({
  fetchMeetingMinutesSummary: vi.fn(),
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...mod,
    getSessionById: vi.fn(),
    getSessionAudio: vi.fn(),
    updateSession: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
});

describe("SessionDetail: IndexedDB 저장 실패(요약 생성)", () => {
  beforeEach(() => {
    vi.mocked(getSessionById).mockReset();
    vi.mocked(getSessionAudio).mockResolvedValue(undefined);
    vi.mocked(updateSession).mockReset();
    vi.mocked(fetchMeetingMinutesSummary).mockReset();
    vi.mocked(fetchMeetingMinutesSummary).mockResolvedValue("생성된 요약");
  });

  it("요약 저장용 updateSession이 거부되면 오류 문구를 보이고 다시 생성할 수 있다", async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      id: "sess-1",
      createdAt: 1,
      text: "스크립트 본문",
    });

    let updateCalls = 0;
    vi.mocked(updateSession).mockImplementation(async () => {
      updateCalls += 1;
      if (updateCalls === 2) {
        throw new Error("idb write failed");
      }
    });

    render(<SessionDetail />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "AI 요약" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "스크립트" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /요약 생성/ }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /요약 생성/ }));

    await waitFor(() => {
      expect(screen.getByText("요약을 만들지 못했습니다.")).toBeInTheDocument();
    });

    vi.mocked(updateSession).mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: /요약 생성/ }));

    await waitFor(() => {
      expect(
        screen.queryByText("요약을 만들지 못했습니다."),
      ).not.toBeInTheDocument();
    });
  });
});
