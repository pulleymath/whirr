/** @vitest-environment happy-dom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSessionAudio,
  getSessionById,
  type Session,
  type SessionAudio,
} from "@/lib/db";
import { SettingsProvider } from "@/lib/settings/context";
import { SessionDetail } from "../session-detail";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "session-123" }),
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock("@/lib/db", () => ({
  getSessionById: vi.fn(),
  getSessionAudio: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock("@/lib/download-recording", () => ({
  downloadRecordingSegments: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SessionDetail 오디오 다운로드", () => {
  it("오디오가 있는 세션의 경우 다운로드 버튼을 표시한다", async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      id: "session-123",
      text: "스크립트 내용",
      createdAt: Date.now(),
    } as Session);
    vi.mocked(getSessionAudio).mockResolvedValue({
      sessionId: "session-123",
      segments: [new Blob(["audio"], { type: "audio/webm" })],
    } as SessionAudio);

    render(
      <SettingsProvider>
        <SessionDetail />
      </SettingsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("오디오 다운로드")).toBeTruthy();
    });
  });

  it("오디오가 없는 세션의 경우 다운로드 버튼을 표시하지 않는다", async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      id: "session-123",
      text: "스크립트 내용",
      createdAt: Date.now(),
    } as Session);
    vi.mocked(getSessionAudio).mockResolvedValue(undefined);

    render(
      <SettingsProvider>
        <SessionDetail />
      </SettingsProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByText("오디오 다운로드")).toBeNull();
    });
  });
});
