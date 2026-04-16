"use client";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export type RecordButtonMode = "start" | "stop";

export type RecordButtonProps = {
  mode: RecordButtonMode;
  disabled?: boolean;
  onClick: () => void;
};

export function RecordButton({ mode, disabled, onClick }: RecordButtonProps) {
  const reducedMotion = usePrefersReducedMotion();

  const transition = reducedMotion
    ? ""
    : "transition-[border-radius] duration-300 ease-in-out";

  const indicatorClass = mode === "start" ? "rounded-[50%]" : "rounded-sm";

  return (
    <button
      type="button"
      aria-label={mode === "start" ? "녹음 시작" : "녹음 중지"}
      disabled={disabled}
      onClick={onClick}
      className={`flex cursor-pointer items-center justify-center rounded-full bg-rose-50/80 p-1 shadow-sm hover:bg-rose-100/90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 ${transition}`.trim()}
    >
      <span
        data-testid="record-indicator"
        className={`h-6 w-6 bg-rose-500 block shrink-0 ${indicatorClass} ${transition}`.trim()}
        aria-hidden
      />
    </button>
  );
}
