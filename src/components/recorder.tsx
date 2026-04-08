"use client";

import { useCallback, useEffect, useRef } from "react";
import { TranscriptView } from "@/components/transcript-view";
import { formatElapsed, useRecorder } from "@/hooks/use-recorder";
import { useTranscription } from "@/hooks/use-transcription";
import { buildSessionText } from "@/lib/build-session-text";
import { saveSession } from "@/lib/db";

export function Recorder() {
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

  const finalsRef = useRef(finals);
  const partialRef = useRef(partial);
  useEffect(() => {
    finalsRef.current = finals;
    partialRef.current = partial;
  }, [finals, partial]);

  const start = useCallback(async () => {
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
          await saveSession(trimmed);
        } catch (e) {
          console.error("[session-storage] save failed:", e);
        }
      }
    }
  }, [finalizeStreaming, stopRecording]);

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <TranscriptView
        partial={partial}
        finals={finals}
        errorMessage={sttError}
      />

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
    </div>
  );
}
