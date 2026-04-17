/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BatchRetryControl } from "@/components/batch-retry-control";

afterEach(() => {
  cleanup();
});

describe("BatchRetryControl", () => {
  it("녹음 중 실패가 있으면 배지를 표시한다", () => {
    render(
      <BatchRetryControl
        mode="recording"
        failedCount={2}
        isRetrying={false}
        retryProcessed={0}
        retryTotal={0}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByTestId("batch-retry-badge")).toHaveTextContent(
      "2개 재시도 대기 중",
    );
  });

  it("녹음 중 실패가 없으면 아무것도 렌더링하지 않는다", () => {
    const { container } = render(
      <BatchRetryControl
        mode="recording"
        failedCount={0}
        isRetrying={false}
        retryProcessed={0}
        retryTotal={0}
        onRetry={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("종료 후 실패가 있으면 다시 시도 버튼을 표시한다", () => {
    const onRetry = vi.fn();
    render(
      <BatchRetryControl
        mode="stopped"
        failedCount={1}
        isRetrying={false}
        retryProcessed={0}
        retryTotal={0}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /다시 시도/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("재시도 진행 중이면 비활성 버튼과 진행 문구를 표시한다", () => {
    render(
      <BatchRetryControl
        mode="stopped"
        failedCount={1}
        isRetrying
        retryProcessed={1}
        retryTotal={3}
        onRetry={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: /재시도 중/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("재시도 중… (1/3)");
  });
});
