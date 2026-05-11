/** @vitest-environment happy-dom */
import {
  act,
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

const beforeUnloadSpy = vi.hoisted(() =>
  vi.fn((active: boolean) => {
    return active;
  }),
);

vi.mock("@/hooks/use-before-unload", () => ({
  useBeforeUnload: (active: boolean) => {
    beforeUnloadSpy(active);
  },
}));

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
  vi.clearAllMocks();
});

describe("SessionDetail: 요약 생성 중 beforeunload", () => {
  beforeEach(() => {
    vi.mocked(getSessionById).mockResolvedValue({
      id: "sess-1",
      createdAt: 1,
      text: "본문",
    });
    vi.mocked(getSessionAudio).mockResolvedValue(undefined);
    vi.mocked(updateSession).mockResolvedValue(undefined);
    beforeUnloadSpy.mockClear();
  });

  it("생성 요청이 끝날 때까지 보호를 켠다", async () => {
    let resolveSummary!: (value: string) => void;
    vi.mocked(fetchMeetingMinutesSummary).mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveSummary = resolve;
        }),
    );

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
      expect(beforeUnloadSpy).toHaveBeenLastCalledWith(true);
    });

    await act(async () => {
      resolveSummary("요약");
    });

    await waitFor(() => {
      expect(beforeUnloadSpy).toHaveBeenLastCalledWith(false);
    });
  });
});
