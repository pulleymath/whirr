"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export type BatchRetryControlProps = {
  mode: "recording" | "stopped";
  failedCount: number;
  isRetrying: boolean;
  retryProcessed: number;
  retryTotal: number;
  onRetry: () => void;
  disabled?: boolean;
};

export function BatchRetryControl({
  mode,
  failedCount,
  isRetrying,
  retryProcessed,
  retryTotal,
  onRetry,
  disabled = false,
}: BatchRetryControlProps) {
  if (mode === "recording") {
    if (failedCount <= 0) {
      return null;
    }
    return (
      <span
        data-testid="batch-retry-badge"
        role="status"
        className="text-[10px] font-medium text-amber-700 dark:text-amber-300"
      >
        {failedCount}개 재시도 대기 중
      </span>
    );
  }

  if (failedCount <= 0 && !isRetrying) {
    return null;
  }

  if (isRetrying && retryTotal > 0) {
    return (
      <Button
        variant="primary"
        disabled
        className="self-start gap-2"
        aria-label={`재시도 중 ${retryProcessed} / ${retryTotal}`}
      >
        <RefreshCw className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        재시도 중… ({retryProcessed}/{retryTotal})
      </Button>
    );
  }

  return (
    <Button
      variant="primary"
      className="self-start gap-2"
      onClick={onRetry}
      disabled={disabled}
      aria-label={`다시 시도, ${failedCount}개 실패`}
    >
      <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
      다시 시도 ({failedCount}개 실패)
    </Button>
  );
}
