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

function renderSessionDetail() {
  return render(<SessionDetail />);
}

afterEach(() => {
  cleanup();
});

describe("SessionDetail", () => {
  beforeEach(() => {
    vi.mocked(getSessionById).mockReset();
    vi.mocked(getSessionAudio).mockResolvedValue(undefined);
    vi.mocked(updateSession).mockReset();
    vi.mocked(updateSession).mockResolvedValue(undefined);
    vi.mocked(fetchMeetingMinutesSummary).mockReset();
    vi.mocked(fetchMeetingMinutesSummary).mockResolvedValue("생성된 회의록");
  });

  it("세션이 있으면 스크립트 탭에서 본문을 편집할 수 있다", async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      id: "sess-1",
      createdAt: 1,
      text: "전체 스크립트 본문",
    });

    renderSessionDetail();

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "회의록" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    fireEvent.click(screen.getByRole("tab", { name: "스크립트" }));

    await waitFor(() => {
      expect(screen.getByTestId("session-detail-script-textarea")).toHaveValue(
        "전체 스크립트 본문",
      );
    });
  });

  it("세션이 없으면 안내와 홈 링크를 보여준다", async () => {
    vi.mocked(getSessionById).mockResolvedValue(undefined);

    renderSessionDetail();

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

    renderSessionDetail();

    await waitFor(() => {
      expect(screen.getByText("세션을 불러오지 못했습니다.")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "회의록" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "스크립트" }));

    await waitFor(() => {
      expect(screen.getByTestId("session-detail-script-textarea")).toHaveValue(
        "재시도 후 본문",
      );
    });
  });

  it("뒤로 버튼이 렌더링되지 않는다", async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      id: "sess-1",
      createdAt: 1,
      text: "t",
    });

    renderSessionDetail();

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "회의록" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "뒤로" })).toBeNull();
  });

  it("오디오 미리듣기가 렌더링되지 않는다", async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      id: "sess-1",
      createdAt: 1,
      text: "t",
    });
    vi.mocked(getSessionAudio).mockResolvedValue({
      sessionId: "sess-1",
      segments: [new Blob(["x"], { type: "audio/webm" })],
    });

    renderSessionDetail();

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "회의록" })).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("오디오 재생")).toBeNull();
  });

  it("스크립트 패널에 h2 '스크립트' 제목이 없다", async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      id: "sess-1",
      createdAt: 1,
      text: "본문",
    });

    renderSessionDetail();

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "회의록" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "스크립트" }));

    await waitFor(() => {
      expect(screen.getByTestId("session-detail-script-textarea")).toHaveValue(
        "본문",
      );
    });

    expect(
      screen.queryByRole("heading", { level: 2, name: "스크립트" }),
    ).toBeNull();
  });

  it("회의록 패널에 h2 '회의록' 제목이 없다", async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      id: "sess-1",
      createdAt: 1,
      text: "본문",
      summary: "## 제목\n내용",
    });

    renderSessionDetail();

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "회의록" })).toBeTruthy();
    });

    expect(
      screen.queryByRole("heading", { level: 2, name: "회의록" }),
    ).toBeNull();
  });

  it("스크립트 복사 버튼이 클립보드에 텍스트를 넣는다", async () => {
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

    renderSessionDetail();

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "회의록" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("tab", { name: "스크립트" }));

    await waitFor(() => {
      expect(screen.getByTestId("session-detail-script-textarea")).toHaveValue(
        "복사할 내용",
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: "스크립트 텍스트 복사" }),
    );
    expect(writeText).toHaveBeenCalledWith("복사할 내용");

    vi.unstubAllGlobals();
  });

  it("기본 탭은 회의록이며 회의록 전체 복사가 마크다운 원문을 넣는다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    });

    vi.mocked(getSessionById).mockResolvedValue({
      id: "sess-1",
      createdAt: 1,
      text: "본문",
      summary: "## 제목\n내용",
    });

    renderSessionDetail();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: "제목" }),
      ).toBeTruthy();
    });

    expect(screen.getByRole("tab", { name: "회의록" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "회의록 전체 복사" }));
    expect(writeText).toHaveBeenCalledWith("## 제목\n내용");

    vi.unstubAllGlobals();
  });

  it("스크립트를 수정하고 저장하면 updateSession이 호출되고 반영된다", async () => {
    vi.mocked(getSessionById)
      .mockResolvedValueOnce({
        id: "sess-1",
        createdAt: 1,
        text: "원본",
      })
      .mockResolvedValueOnce({
        id: "sess-1",
        createdAt: 1,
        text: "수정됨",
      });

    renderSessionDetail();

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "회의록" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("tab", { name: "스크립트" }));

    await waitFor(() => {
      expect(screen.getByTestId("session-detail-script-textarea")).toHaveValue(
        "원본",
      );
    });

    fireEvent.change(screen.getByTestId("session-detail-script-textarea"), {
      target: { value: "수정됨" },
    });

    fireEvent.click(screen.getByRole("button", { name: "스크립트 저장" }));

    await waitFor(() => {
      expect(vi.mocked(updateSession)).toHaveBeenCalledWith("sess-1", {
        text: "수정됨",
        status: "ready",
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("session-detail-script-textarea")).toHaveValue(
        "수정됨",
      );
    });
  });

  it("회의록이 없고 스크립트가 있으면 회의록 생성 버튼을 보여준다", async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      id: "sess-1",
      createdAt: 1,
      text: "스크립트 본문",
    });

    renderSessionDetail();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "회의록 생성" })).toBeTruthy();
    });
    expect(
      screen.getByText(/아직 회의록이 없습니다\. 상단 영역에서/),
    ).toBeTruthy();
  });

  it("스크립트가 비어 있으면 회의록 생성 버튼이 비활성화된다", async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      id: "sess-1",
      createdAt: 1,
      text: "   ",
    });

    renderSessionDetail();

    await waitFor(() => {
      expect(
        screen.getByText("스크립트가 비어 있으면 회의록을 만들 수 없습니다."),
      ).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "회의록 생성" })).toBeDisabled();
  });

  it("저장하지 않은 스크립트 편집이 회의록 생성 API 본문에 반영된다", async () => {
    vi.mocked(getSessionById)
      .mockResolvedValueOnce({
        id: "sess-1",
        createdAt: 1,
        text: "원본",
      })
      .mockResolvedValueOnce({
        id: "sess-1",
        createdAt: 1,
        text: "원본",
        summary: "생성됨",
      });

    renderSessionDetail();

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "회의록" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "스크립트" }));

    await waitFor(() => {
      expect(screen.getByTestId("session-detail-script-textarea")).toHaveValue(
        "원본",
      );
    });

    fireEvent.change(screen.getByTestId("session-detail-script-textarea"), {
      target: { value: "편집본" },
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "저장하지 않은 내용은 회의록 생성",
    );

    fireEvent.click(screen.getByRole("tab", { name: "회의록" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "회의록 생성" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "회의록 생성" }));

    await waitFor(() => {
      expect(vi.mocked(fetchMeetingMinutesSummary)).toHaveBeenCalledWith(
        "편집본",
        expect.any(String),
        undefined,
        expect.objectContaining({
          glossary: [],
        }),
      );
    });
  });

  it("회의록 생성 클릭 시 API·저장 후 화면에 회의록을 반영한다", async () => {
    vi.mocked(getSessionById)
      .mockResolvedValueOnce({
        id: "sess-1",
        createdAt: 1,
        text: "hello",
      })
      .mockResolvedValueOnce({
        id: "sess-1",
        createdAt: 1,
        text: "hello",
        summary: "생성된 회의록",
      });

    renderSessionDetail();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "회의록 생성" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "회의록 생성" }));

    await waitFor(() => {
      expect(screen.getByText("생성된 회의록")).toBeTruthy();
    });
    expect(vi.mocked(fetchMeetingMinutesSummary)).toHaveBeenCalled();
    expect(vi.mocked(updateSession)).toHaveBeenLastCalledWith("sess-1", {
      summary: "생성된 회의록",
      status: "ready",
    });
  });

  it("생성 후 세션 재조회가 실패하면 회의록 영역에 안내를 표시한다", async () => {
    vi.mocked(getSessionById)
      .mockResolvedValueOnce({
        id: "sess-1",
        createdAt: 1,
        text: "hello",
      })
      .mockRejectedValueOnce(new Error("idb"));

    renderSessionDetail();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "회의록 생성" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "회의록 생성" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "저장 후 화면을 불러오지 못했습니다",
      );
    });
  });

  it("회의록이 있으면 재생성 버튼 라벨을 보여준다", async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      id: "sess-1",
      createdAt: 1,
      text: "본문",
      summary: "기존 회의록",
    });

    renderSessionDetail();

    await waitFor(() => {
      expect(screen.getByText("기존 회의록")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "회의록 재생성" })).toBeTruthy();
  });
});
