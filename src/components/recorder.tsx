"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MainTranscriptTabs } from "@/components/main-transcript-tabs";
import {
  SummaryTabPanel,
  type SummaryTabUiState,
} from "@/components/summary-tab-panel";
import { TranscriptView } from "@/components/transcript-view";
import {
  formatElapsed,
  useRecorder,
  type RecorderStatus,
} from "@/hooks/use-recorder";
import { useTranscription } from "@/hooks/use-transcription";
import { buildSessionText } from "@/lib/build-session-text";
import { saveSession } from "@/lib/db";

export type RecorderProps = {
  onSessionSaved?: (id: string) => void;
};

type SummaryAfterSave = "none" | "summarizing" | "complete";

function deriveSummaryTabState(
  recorderStatus: RecorderStatus,
  afterSave: SummaryAfterSave,
  summaryError: string | null,
): SummaryTabUiState {
  if (summaryError) {
    return "error";
  }
  if (afterSave === "summarizing") {
    return "summarizing";
  }
  if (afterSave === "complete") {
    return "complete";
  }
  if (recorderStatus === "recording") {
    return "recording";
  }
  return "idle";
}

export function Recorder({ onSessionSaved }: RecorderProps = {}) {
  const {
    partial,
    finals,
    errorMessage: sttError,
    prepareStreaming,
    sendPcm,
    finalizeStreaming,
  } = useTranscription();

  const {
    status,
    errorMessage: recorderError,
    elapsedMs,
    level,
    start: startRecording,
    stop: stopRecording,
  } = useRecorder(sendPcm);

  const [afterSave, setAfterSave] = useState<SummaryAfterSave>("none");
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [placeholderSummary, setPlaceholderSummary] = useState<string | null>(
    null,
  );
  const summarizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finalsRef = useRef(finals);
  const partialRef = useRef(partial);
  useEffect(() => {
    finalsRef.current = finals;
    partialRef.current = partial;
  }, [finals, partial]);

  useEffect(() => {
    return () => {
      if (summarizeTimerRef.current) {
        clearTimeout(summarizeTimerRef.current);
      }
    };
  }, []);

  const start = useCallback(async () => {
    setAfterSave("none");
    setSummaryError(null);
    setPlaceholderSummary(null);
    if (summarizeTimerRef.current) {
      clearTimeout(summarizeTimerRef.current);
      summarizeTimerRef.current = null;
    }
    const ok = await prepareStreaming();
    if (!ok) {
      return;
    }
    await startRecording();
  }, [prepareStreaming, startRecording]);

  const stop = useCallback(async () => {
    try {
      await stopRecording();
    } finally {
      const snapshot = buildSessionText(finalsRef.current, partialRef.current);
      await finalizeStreaming();
      const trimmed = snapshot.trim();
      if (trimmed) {
        try {
          const id = await saveSession(trimmed);
          onSessionSaved?.(id);
          setAfterSave("summarizing");
          setPlaceholderSummary(
            "이번 세션 요약(플레이스홀더): 핵심 논점이 여기에 표시됩니다.",
          );
          if (summarizeTimerRef.current) {
            clearTimeout(summarizeTimerRef.current);
          }
          summarizeTimerRef.current = setTimeout(() => {
            setAfterSave("complete");
            summarizeTimerRef.current = null;
          }, 400);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[session-storage] save failed:", msg);
          setSummaryError("세션을 저장하지 못했습니다.");
        }
      }
    }
  }, [finalizeStreaming, onSessionSaved, stopRecording]);

  const summaryUiState = deriveSummaryTabState(status, afterSave, summaryError);

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <section
        className="flex w-full flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        aria-label="마이크 녹음"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-2xl tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatElapsed(elapsedMs)}
          </p>
          <div className="flex gap-2">
            {status !== "recording" ? (
              <button
                type="button"
                onClick={() => void start()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                aria-label="녹음 시작"
              >
                녹음 시작
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void stop()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
                aria-label="녹음 중지"
              >
                중지
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            입력 레벨
          </span>
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)}
            aria-label="마이크 레벨"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-75 ease-out"
              style={{ width: `${Math.round(level * 100)}%` }}
            />
          </div>
        </div>

        {recorderError ? (
          <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
            {recorderError}
          </p>
        ) : null}
      </section>

      <MainTranscriptTabs
        transcriptPanel={
          <TranscriptView
            partial={partial}
            finals={finals}
            errorMessage={sttError}
            showHeading={false}
          />
        }
        summaryPanel={
          <SummaryTabPanel
            state={summaryUiState}
            summaryText={placeholderSummary ?? undefined}
            errorMessage={summaryError}
          />
        }
      />
    </div>
  );
}
