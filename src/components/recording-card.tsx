"use client";

import type { BatchRetryControlProps } from "@/components/batch-retry-control";
import { BatchRetryControl } from "@/components/batch-retry-control";
import { RecordButton } from "@/components/record-button";
import { formatElapsed } from "@/hooks/use-recorder";
import { usePostRecordingPipeline } from "@/lib/post-recording-pipeline/context";
import { useSettings } from "@/lib/settings/context";
import { BATCH_MODEL_OPTIONS } from "@/lib/settings/options";
import { Mic, NotebookPen } from "lucide-react";

export type StatusMessage = {
  text: string;
  tone: "warning" | "error" | "muted";
};

export type RecordingCardProps = {
  elapsedMs: number;
  level: number;
  showStart: boolean;
  showStop: boolean;
  recordingActive: boolean;
  onStart: () => void;
  onStop: () => void;

  isBatchMode: boolean;
  batchRecording: boolean;
  segmentProgress: number;
  completedCount: number;
  totalCount: number;
  failedCount: number;

  stoppedRetry: Omit<BatchRetryControlProps, "mode"> | null;
  messages: StatusMessage[];
};

const TONE_CLASS: Record<StatusMessage["tone"], string> = {
  warning: "text-sm text-amber-700 dark:text-amber-300",
  error: "text-sm text-red-600 dark:text-red-400",
  muted: "text-sm text-zinc-600 dark:text-zinc-400",
};

export function RecordingCard({
  elapsedMs,
  level,
  showStart,
  showStop,
  recordingActive,
  onStart,
  onStop,
  isBatchMode,
  batchRecording,
  segmentProgress,
  completedCount,
  totalCount,
  failedCount,
  stoppedRetry,
  messages,
}: RecordingCardProps) {
  const { isBusy: pipelineBusy } = usePostRecordingPipeline();
  const { settings } = useSettings();

  const scriptModelLabel =
    BATCH_MODEL_OPTIONS.find((o) => o.value === settings.batchModel)?.label ??
    settings.batchModel;

  return (
    <section
      className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      aria-label="마이크 녹음"
      data-batch-recording={isBatchMode ? String(batchRecording) : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-2xl tabular-nums text-zinc-900 dark:text-zinc-50">
          {formatElapsed(elapsedMs)}
        </p>
        <div className="flex gap-2">
          {showStart ? (
            <RecordButton
              mode="start"
              disabled={pipelineBusy}
              onClick={onStart}
            />
          ) : showStop ? (
            <RecordButton mode="stop" onClick={onStop} />
          ) : null}
        </div>
      </div>

      {pipelineBusy && !recordingActive ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400" role="status">
          이전 녹음을 처리 중입니다. 잠시만 기다려 주세요.
        </p>
      ) : null}

      <div className="flex gap-2 items-center">
        <Mic className="h-4 w-4" />

        <div
          className="h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(level * 100)}
          aria-label="마이크 레벨"
        >
          <div
            className="h-full rounded-full bg-rose-500 transition-[width] duration-75 ease-out"
            style={{ width: `${Math.round(level * 100)}%` }}
          />
        </div>
      </div>

      {isBatchMode && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <NotebookPen className="h-3 w-4" />

            <div
              className="h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(segmentProgress * 100)}
            >
              <div
                className="h-full rounded-full bg-sky-500 transition-[width] duration-300 ease-linear"
                style={{
                  width: `${Math.round(segmentProgress * 100)}%`,
                }}
              />
            </div>
          </div>

          {totalCount > 0 && (
            <span className="text-[10px] text-end font-medium text-zinc-500 dark:text-zinc-400">
              {completedCount} / {totalCount}
            </span>
          )}

          <BatchRetryControl
            mode="recording"
            failedCount={failedCount}
            isRetrying={false}
            retryProcessed={0}
            retryTotal={0}
            onRetry={() => {}}
          />
        </div>
      )}

      {stoppedRetry ? (
        <BatchRetryControl mode="stopped" {...stoppedRetry} />
      ) : null}

      {messages.map((msg) => (
        <p
          key={msg.text}
          className={TONE_CLASS[msg.tone]}
          role={msg.tone === "error" ? "alert" : "status"}
        >
          {msg.text}
        </p>
      ))}

      <p
        className="self-end font-mono text-[10px] leading-none text-zinc-400 dark:text-zinc-500"
        data-testid="recorder-selected-script-model-hint"
      >
        {scriptModelLabel}
      </p>
    </section>
  );
}
