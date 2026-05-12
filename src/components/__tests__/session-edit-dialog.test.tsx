/** @vitest-environment happy-dom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionEditDialog } from "@/components/session-edit-dialog";
import { updateSession, type Session } from "@/lib/db";

vi.mock("@/lib/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db")>();
  return { ...mod, updateSession: vi.fn() };
});

afterEach(() => {
  cleanup();
});

const baseSession: Session = {
  id: "s1",
  createdAt: 1,
  text: "스크립트",
  status: "ready",
};

describe("SessionEditDialog", () => {
  beforeEach(() => {
    vi.mocked(updateSession).mockReset();
    vi.mocked(updateSession).mockResolvedValue(undefined);
  });

  it("open이 false면 다이얼로그를 렌더하지 않는다", () => {
    render(
      <SessionEditDialog
        open={false}
        session={baseSession}
        mmLoading={false}
        onClose={vi.fn()}
        onAfterPersist={vi.fn().mockResolvedValue(true)}
        onGenerate={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("session-edit-dialog")).not.toBeInTheDocument();
  });

  it("저장하면 updateSession과 onAfterPersist 후 닫힌다", async () => {
    const onClose = vi.fn();
    const onAfterPersist = vi.fn().mockResolvedValue(true);

    render(
      <SessionEditDialog
        open
        session={baseSession}
        mmLoading={false}
        onClose={onClose}
        onAfterPersist={onAfterPersist}
        onGenerate={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("session-edit-dialog-script"), {
      target: { value: "수정됨" },
    });

    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(vi.mocked(updateSession)).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onAfterPersist).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("onAfterPersist가 false면 모달을 유지하고 안내 문구를 보인다", async () => {
    const onClose = vi.fn();
    const onAfterPersist = vi.fn().mockResolvedValue(false);

    render(
      <SessionEditDialog
        open
        session={baseSession}
        mmLoading={false}
        onClose={onClose}
        onAfterPersist={onAfterPersist}
        onGenerate={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("session-edit-dialog-script"), {
      target: { value: "수정됨" },
    });

    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(vi.mocked(updateSession)).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(
        screen.getByText(
          "저장 후 화면을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        ),
      ).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("session-edit-dialog")).toBeInTheDocument();
  });

  it("요약 생성 클릭 시 onGenerate에 스냅샷을 넘긴다", () => {
    const onGenerate = vi.fn();
    render(
      <SessionEditDialog
        open
        session={baseSession}
        mmLoading={false}
        onClose={vi.fn()}
        onAfterPersist={vi.fn().mockResolvedValue(true)}
        onGenerate={onGenerate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /요약 생성/ }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate.mock.calls[0][0].scriptText).toBe("스크립트");
  });

  it("스크립트가 비어 있으면 요약 생성이 비활성이다", () => {
    render(
      <SessionEditDialog
        open
        session={{ ...baseSession, text: "   " }}
        mmLoading={false}
        onClose={vi.fn()}
        onAfterPersist={vi.fn().mockResolvedValue(true)}
        onGenerate={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /요약 생성/ })).toBeDisabled();
  });

  it("dirty일 때 닫기는 확인 후 onClose를 호출한다", () => {
    const confirmSpy = vi.fn(() => true);
    window.confirm = confirmSpy;
    const onClose = vi.fn();
    render(
      <SessionEditDialog
        open
        session={baseSession}
        mmLoading={false}
        onClose={onClose}
        onAfterPersist={vi.fn().mockResolvedValue(true)}
        onGenerate={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("session-edit-dialog-script"), {
      target: { value: "변경" },
    });
    fireEvent.click(screen.getByLabelText("닫기"));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
