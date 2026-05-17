/** @vitest-environment happy-dom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSessionAudio,
  getSessionById,
  type Session,
  type SessionAudio,
} from "@/lib/db";
import {
  downloadRecordingAudio,
  downloadRecordingZip,
} from "@/lib/download-recording";
import { SettingsProvider } from "@/lib/settings/context";
import { SessionDetail } from "../session-detail";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "session-123" }),
}));

vi.mock("@/lib/db", () => ({
  getSessionById: vi.fn(),
  getSessionAudio: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock("@/lib/download-recording", () => ({
  downloadRecordingAudio: vi.fn(),
  downloadRecordingZip: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SessionDetail 오디오 다운로드", () => {
  it("fullBlob이 있으면 단일 WebM 다운로드 유틸을 호출한다", async () => {
    const fullBlob = new Blob(["full-audio"], { type: "audio/webm" });
    vi.mocked(getSessionById).mockResolvedValue({
      id: "session-123",
      text: "스크립트 내용",
      createdAt: Date.now(),
    } as Session);
    vi.mocked(getSessionAudio).mockResolvedValue({
      sessionId: "session-123",
      segments: [new Blob(["seg"], { type: "audio/webm" })],
      fullBlob,
    } as SessionAudio);

    render(
      <SettingsProvider>
        <SessionDetail />
      </SettingsProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "오디오 다운로드" }),
      ).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "오디오 다운로드" }));

    await waitFor(() => {
      expect(downloadRecordingAudio).toHaveBeenCalledWith(
        fullBlob,
        "session-session-123",
      );
    });
    expect(downloadRecordingZip).not.toHaveBeenCalled();
  });

  it("fullBlob이 없으면 세그먼트 전체를 zip 다운로드 유틸에 전달한다", async () => {
    const segments = [
      new Blob(["audio-1"], { type: "audio/webm" }),
      new Blob(["audio-2"], { type: "audio/webm" }),
    ];
    vi.mocked(getSessionById).mockResolvedValue({
      id: "session-123",
      text: "스크립트 내용",
      createdAt: Date.now(),
    } as Session);
    vi.mocked(getSessionAudio).mockResolvedValue({
      sessionId: "session-123",
      segments,
    } as SessionAudio);

    render(
      <SettingsProvider>
        <SessionDetail />
      </SettingsProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "오디오 다운로드" }),
      ).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "오디오 다운로드" }));

    await waitFor(() => {
      expect(downloadRecordingZip).toHaveBeenCalledWith(
        segments,
        "session-session-123",
      );
    });
  });

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

    expect(document.querySelector("audio")).toBeNull();
  });

  it("zip 다운로드 실패 후에도 버튼이 다시 활성화되고 라벨이 복귀한다", async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      id: "session-123",
      text: "스크립트 내용",
      createdAt: Date.now(),
    } as Session);
    vi.mocked(getSessionAudio).mockResolvedValue({
      sessionId: "session-123",
      segments: [new Blob(["a"], { type: "audio/webm" })],
    } as SessionAudio);
    vi.mocked(downloadRecordingZip).mockRejectedValueOnce(
      new Error("zip failed"),
    );

    render(
      <SettingsProvider>
        <SessionDetail />
      </SettingsProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "오디오 다운로드" }),
      ).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "오디오 다운로드" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "오디오 다운로드" }),
      ).not.toBeDisabled();
    });
    expect(screen.queryByText("ZIP 생성 중...")).toBeNull();
  });

  it("다운로드 진행 중에는 버튼이 비활성화되었다가 완료 후 다시 활성화된다", async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      id: "session-123",
      text: "스크립트 내용",
      createdAt: Date.now(),
    } as Session);
    vi.mocked(getSessionAudio).mockResolvedValue({
      sessionId: "session-123",
      segments: [new Blob(["a"], { type: "audio/webm" })],
    } as SessionAudio);
    vi.mocked(downloadRecordingZip).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(undefined), 80)),
    );

    render(
      <SettingsProvider>
        <SessionDetail />
      </SettingsProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "오디오 다운로드" }),
      ).toBeTruthy();
    });

    const btn = screen.getByRole("button", { name: "오디오 다운로드" });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "오디오 다운로드" }),
      ).toBeDisabled();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "오디오 다운로드" }),
      ).not.toBeDisabled();
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
