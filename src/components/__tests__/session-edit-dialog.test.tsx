/** @vitest-environment happy-dom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
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

function renderOpenDialog(
  props: Partial<ComponentProps<typeof SessionEditDialog>> = {},
) {
  return render(
    <SessionEditDialog
      open
      session={baseSession}
      mmLoading={false}
      onClose={vi.fn()}
      onAfterPersist={vi.fn().mockResolvedValue(true)}
      onGenerate={vi.fn()}
      {...props}
    />,
  );
}

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

  it("현재 세션 재생성 클릭 시 확인 후 onGenerate(snap, current)를 호출한다", () => {
    const confirmSpy = vi.fn(() => true);
    const prev = window.confirm;
    window.confirm = confirmSpy as typeof window.confirm;
    try {
      const onGenerate = vi.fn();
      renderOpenDialog({ onGenerate });
      fireEvent.click(
        screen.getByRole("button", { name: "현재 세션에 요약 재생성" }),
      );
      expect(confirmSpy).toHaveBeenCalledWith(
        "현재 세션에 저장된 AI 요약이 새로 생성된 요약으로 덮어써집니다. 계속하시겠어요?",
      );
      expect(onGenerate).toHaveBeenCalledTimes(1);
      expect(onGenerate.mock.calls[0][0].scriptText).toBe("스크립트");
      expect(onGenerate.mock.calls[0][1]).toBe("current");
    } finally {
      window.confirm = prev;
    }
  });

  it("현재 세션 재생성에서 확인을 취소하면 onGenerate를 호출하지 않는다", () => {
    const confirmSpy = vi.fn(() => false);
    const prev = window.confirm;
    window.confirm = confirmSpy as typeof window.confirm;
    try {
      const onGenerate = vi.fn();
      renderOpenDialog({ onGenerate });
      fireEvent.click(
        screen.getByRole("button", { name: "현재 세션에 요약 재생성" }),
      );
      expect(onGenerate).not.toHaveBeenCalled();
    } finally {
      window.confirm = prev;
    }
  });

  it("새 세션 재생성 클릭 시 onGenerate(snap, new)를 호출한다", () => {
    const onGenerate = vi.fn();
    renderOpenDialog({ onGenerate });
    fireEvent.click(
      screen.getByRole("button", { name: "새 세션에 요약 재생성" }),
    );
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate.mock.calls[0][1]).toBe("new");
  });

  it("스크립트가 비어 있으면 재생성 버튼이 비활성이다", () => {
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
    expect(
      screen.getByRole("button", { name: "현재 세션에 요약 재생성" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "새 세션에 요약 재생성" }),
    ).toBeDisabled();
  });

  it("dirty일 때 닫기는 확인 후 onClose를 호출한다", () => {
    const confirmSpy = vi.fn(() => true);
    window.confirm = confirmSpy;
    const onClose = vi.fn();
    renderOpenDialog({ onClose });
    fireEvent.change(screen.getByTestId("session-edit-dialog-script"), {
      target: { value: "변경" },
    });
    fireEvent.click(screen.getByLabelText("닫기"));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("제목 입력과 작성 모델 행을 보여준다", () => {
    renderOpenDialog();
    expect(screen.getByTestId("session-edit-dialog-title")).toBeInTheDocument();
    expect(
      screen.getByTestId("session-minutes-model-select"),
    ).toBeInTheDocument();
  });

  it("용어 사전 UI는 없다", () => {
    renderOpenDialog();
    expect(screen.queryByText("용어 사전")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("session-glossary-textarea"),
    ).not.toBeInTheDocument();
  });

  it("요약 형식을 바꾸면 요약 형식 미리보기 탭으로 이동한다", async () => {
    renderOpenDialog();
    fireEvent.click(screen.getByTestId("note-tab-summary"));
    expect(screen.getByTestId("note-tab-summary")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.change(screen.getByTestId("meeting-template-selector"), {
      target: { value: "business" },
    });
    await waitFor(() => {
      expect(
        screen.getByTestId("session-edit-tab-template-preview"),
      ).toHaveAttribute("aria-selected", "true");
    });
  });

  it("빌트인 템플릿이면 미리보기 탭에서 pre를 렌더한다", () => {
    renderOpenDialog();
    fireEvent.click(screen.getByTestId("session-edit-tab-template-preview"));
    expect(
      screen.getByTestId("meeting-minutes-template-preview"),
    ).toBeInTheDocument();
  });

  it("닫기 애니메이션 후 phase가 closed가 된다", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <SessionEditDialog
        open
        session={baseSession}
        mmLoading={false}
        onClose={onClose}
        onAfterPersist={vi.fn().mockResolvedValue(true)}
        onGenerate={vi.fn()}
      />,
    );

    rerender(
      <SessionEditDialog
        open={false}
        session={baseSession}
        mmLoading={false}
        onClose={onClose}
        onAfterPersist={vi.fn().mockResolvedValue(true)}
        onGenerate={vi.fn()}
      />,
    );

    const root = await waitFor(() =>
      screen.getByTestId("session-edit-dialog-root"),
    );
    expect(root).toHaveAttribute("data-phase", "closing");

    root.dispatchEvent(
      new TransitionEvent("transitionend", {
        bubbles: true,
        propertyName: "opacity",
      }),
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId("session-edit-dialog-root"),
      ).not.toBeInTheDocument();
    });
  });
});
