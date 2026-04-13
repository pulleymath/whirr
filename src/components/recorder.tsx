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
import { saveSession, saveSessionAudio } from "@/lib/db";
import { downloadRecordingSegments } from "@/lib/download-recording";
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

  const [isDownloading, setIsDownloading] = useState(false);

  const persistAfterTranscript = useCallback(
    async (trimmed: string, audioSegments: Blob[] = []) => {
      if (!trimmed && audioSegments.length === 0) {
        return;
      }
      try {
        const id = await saveSession(trimmed);
        if (audioSegments.length > 0) {
          await saveSessionAudio(id, audioSegments);
        }
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
      const session = batch.sessionRef.current;
      let fullAudio: Blob | undefined;
      if (session && typeof session.getFullAudioBlob === "function") {
        fullAudio = await session.getFullAudioBlob();
      }
      const text = await stopBatchTranscribe();
      const trimmed = (text ?? "").trim();
      await persistAfterTranscript(
        trimmed,
        fullAudio ? [fullAudio] : batch.segments,
      );
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
    batch.segments,
    batch.sessionRef,
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
  const batchRecording = isBatchMode && batch.status === "recording";
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
  const batchRecordingHint = batchRecording
    ? "녹음 중입니다. 5분마다 전사 결과가 업데이트됩니다."
    : null;
  const batchLoadingMessage = batchTranscribing
    ? `전사 중... (${batch.completedCount}/${batch.totalCount})`
    : null;

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
            {isBatchMode && batch.segments.length > 0 && (
              <button
                type="button"
                disabled={isDownloading}
                onClick={async () => {
                  setIsDownloading(true);
                  try {
                    await downloadRecordingSegments(
                      batch.segments,
                      `recording-${new Date().toISOString()}`,
                    );
                  } finally {
                    setIsDownloading(false);
                  }
                }}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                aria-label="오디오 다운로드"
              >
                {isDownloading ? "다운로드 중..." : "오디오 다운로드"}
              </button>
            )}
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

        {isBatchMode && batch.status === "recording" && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                <span>현재 세그먼트 (5분)</span>
                <span>{Math.round(batch.segmentProgress * 100)}%</span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(batch.segmentProgress * 100)}
              >
                <div
                  className="h-full rounded-full bg-blue-500 transition-[width] duration-300 ease-linear"
                  style={{
                    width: `${Math.round(batch.segmentProgress * 100)}%`,
                  }}
                />
              </div>
            </div>
            {batch.totalCount > 0 && (
              <div className="flex justify-between text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                <span>전사 진행률</span>
                <span>
                  {batch.completedCount} / {batch.totalCount} 세그먼트 완료
                </span>
              </div>
            )}
          </div>
        )}

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
