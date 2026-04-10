"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MainTranscriptTabs } from "@/components/main-transcript-tabs";
import {
  SummaryTabPanel,
  type SummaryTabUiState,
} from "@/components/summary-tab-panel";
import { TranscriptView } from "@/components/transcript-view";
import { useBatchTranscription } from "@/hooks/use-batch-transcription";
import {
  formatElapsed,
  useRecorder,
  type RecorderStatus,
} from "@/hooks/use-recorder";
import { useTranscription } from "@/hooks/use-transcription";
import { buildSessionText } from "@/lib/build-session-text";
import { saveSession } from "@/lib/db";
import { useRecordingActivity } from "@/lib/recording-activity/context";
import { useSettings } from "@/lib/settings/context";
import {
  createAssemblyAiRealtimeProvider,
  createOpenAiRealtimeProvider,
  createWebSpeechProvider,
  isWebSpeechApiSupported,
} from "@/lib/stt";
import { OPENAI_PROACTIVE_RENEWAL_AFTER_MS } from "@/lib/stt/openai-realtime";

export type RecorderProps = {
  onSessionSaved?: (id: string) => void;
};

type SummaryAfterSave = "none" | "summarizing" | "complete";

const STREAMING_SESSION_SOFT_MS = OPENAI_PROACTIVE_RENEWAL_AFTER_MS;

function deriveSummaryTabState(
  recorderStatus: RecorderStatus,
  afterSave: SummaryAfterSave,
  summaryError: string | null,
  batchRecording: boolean,
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
  if (recorderStatus === "recording" || batchRecording) {
    return "recording";
  }
  return "idle";
}

export function Recorder({ onSessionSaved }: RecorderProps = {}) {
  const { settings } = useSettings();
  const { setIsRecording } = useRecordingActivity();
  const isBatchMode = settings.mode === "batch";

  const {
    startRecording: startBatchRecording,
    stopAndTranscribe: stopBatchTranscribe,
    retryTranscription: retryBatchTranscription,
    ...batch
  } = useBatchTranscription({
    model: settings.batchModel,
    language: settings.language,
  });

  const transcriptionOptions = useMemo(() => {
    if (settings.mode === "webSpeechApi") {
      return {
        tokenlessProvider: () => createWebSpeechProvider(settings.language),
      };
    }
    if (settings.realtimeEngine === "assemblyai") {
      return {
        createProvider: createAssemblyAiRealtimeProvider,
        useAssemblyAiPcmFraming: true as const,
      };
    }
    return {
      createProvider: createOpenAiRealtimeProvider,
      useAssemblyAiPcmFraming: false as const,
    };
  }, [settings.mode, settings.realtimeEngine, settings.language]);

  const {
    partial,
    finals,
    errorMessage: sttError,
    reconnectToast,
    prepareStreaming,
    sendPcm,
    finalizeStreaming,
  } = useTranscription(transcriptionOptions);

  const {
    status,
    errorMessage: recorderError,
    elapsedMs,
    level,
    start: startRecording,
    stop: stopRecording,
  } = useRecorder(sendPcm);

  const [unsupportedModeMessage, setUnsupportedModeMessage] = useState<
    string | null
  >(null);

  useEffect(() => {
    const recording = isBatchMode
      ? batch.status === "recording"
      : status === "recording";
    setIsRecording(recording);
    return () => {
      setIsRecording(false);
    };
  }, [batch.status, isBatchMode, setIsRecording, status]);

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
    setUnsupportedModeMessage(null);
    setAfterSave("none");
    setSummaryError(null);
    setPlaceholderSummary(null);
    if (summarizeTimerRef.current) {
      clearTimeout(summarizeTimerRef.current);
      summarizeTimerRef.current = null;
    }
    if (settings.mode === "webSpeechApi") {
      if (!isWebSpeechApiSupported()) {
        setUnsupportedModeMessage(
          "이 브라우저에서는 Web Speech API를 사용할 수 없습니다.",
        );
        return;
      }
      const ok = await prepareStreaming();
      if (!ok) {
        return;
      }
      await startRecording();
      return;
    }
    if (settings.mode === "batch") {
      await startBatchRecording();
      return;
    }
    const ok = await prepareStreaming();
    if (!ok) {
      return;
    }
    await startRecording();
  }, [prepareStreaming, settings.mode, startBatchRecording, startRecording]);

  const persistAfterTranscript = useCallback(
    async (trimmed: string) => {
      if (!trimmed) {
        return;
      }
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
    },
    [onSessionSaved],
  );

  const stop = useCallback(async () => {
    if (settings.mode === "batch") {
      const text = await stopBatchTranscribe();
      const trimmed = (text ?? "").trim();
      await persistAfterTranscript(trimmed);
      return;
    }

    try {
      await stopRecording();
    } finally {
      const snapshot = buildSessionText(finalsRef.current, partialRef.current);
      await finalizeStreaming();
      const trimmed = snapshot.trim();
      await persistAfterTranscript(trimmed);
    }
  }, [
    finalizeStreaming,
    persistAfterTranscript,
    settings.mode,
    stopBatchTranscribe,
    stopRecording,
  ]);

  const summaryUiState = deriveSummaryTabState(
    status,
    afterSave,
    summaryError,
    isBatchMode && batch.status === "recording",
  );

  const displayElapsedMs = isBatchMode ? batch.elapsedMs : elapsedMs;
  const displayLevel = isBatchMode ? batch.level : level;
  const batchTranscribing = isBatchMode && batch.status === "transcribing";
  const showStop = isBatchMode
    ? batch.status === "recording"
    : status === "recording";
  const showStart = !showStop && !batchTranscribing;

  const transcriptPartial = isBatchMode ? "" : partial;
  const transcriptFinals =
    isBatchMode && batch.transcript
      ? [batch.transcript]
      : isBatchMode
        ? []
        : finals;
  const transcriptError = isBatchMode ? batch.errorMessage : sttError;
  const batchRecordingHint =
    isBatchMode && batch.status === "recording"
      ? "녹음 중입니다. 녹음을 종료하면 전사가 시작됩니다."
      : null;
  const batchLoadingMessage = batchTranscribing ? "전사 중..." : null;

  const streamingSessionHint =
    !isBatchMode &&
    status === "recording" &&
    elapsedMs >= STREAMING_SESSION_SOFT_MS
      ? settings.mode === "realtime"
        ? "세션이 곧 갱신됩니다."
        : settings.mode === "webSpeechApi"
          ? "녹음 시간이 길어지고 있습니다. 전사가 중단될 수 있습니다."
          : null
      : null;

  return (
    <div
      className="flex w-full max-w-md flex-col gap-6"
      data-testid="recorder-root"
      data-transcription-mode={settings.mode}
    >
      <section
        className="flex w-full flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        aria-label="마이크 녹음"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-2xl tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatElapsed(displayElapsedMs)}
          </p>
          <div className="flex gap-2">
            {showStart ? (
              <button
                type="button"
                onClick={() => void start()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                aria-label="녹음 시작"
              >
                녹음 시작
              </button>
            ) : showStop ? (
              <button
                type="button"
                onClick={() => void stop()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
                aria-label="녹음 중지"
              >
                중지
              </button>
            ) : null}
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
            aria-valuenow={Math.round(displayLevel * 100)}
            aria-label="마이크 레벨"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-75 ease-out"
              style={{ width: `${Math.round(displayLevel * 100)}%` }}
            />
          </div>
        </div>

        {isBatchMode && batch.softLimitMessage ? (
          <p
            className="text-sm text-amber-700 dark:text-amber-300"
            role="status"
          >
            {batch.softLimitMessage}
          </p>
        ) : null}

        {!isBatchMode && streamingSessionHint ? (
          <p
            className="text-sm text-amber-700 dark:text-amber-300"
            role="status"
          >
            {streamingSessionHint}
          </p>
        ) : null}

        {!isBatchMode && reconnectToast ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400" role="status">
            {reconnectToast}
          </p>
        ) : null}

        {isBatchMode && batch.status === "error" && batch.errorMessage ? (
          <button
            type="button"
            onClick={() => void retryBatchTranscription()}
            className="self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            다시 시도
          </button>
        ) : null}

        {unsupportedModeMessage ? (
          <p
            className="text-sm text-amber-700 dark:text-amber-300"
            role="status"
          >
            {unsupportedModeMessage}
          </p>
        ) : null}
        {recorderError ? (
          <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
            {recorderError}
          </p>
        ) : null}
      </section>

      <MainTranscriptTabs
        transcriptPanel={
          <TranscriptView
            partial={transcriptPartial}
            finals={transcriptFinals}
            errorMessage={transcriptError}
            showHeading={false}
            emptyStateHint={batchRecordingHint}
            loadingMessage={batchLoadingMessage}
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
