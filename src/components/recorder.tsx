"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BatchRetryControl } from "@/components/batch-retry-control";
import { RecordButton } from "@/components/record-button";
import { SessionContextInput } from "@/components/session-context-input";
import { TranscriptView } from "@/components/transcript-view";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import {
  useBatchTranscription,
  type BatchStopResult,
} from "@/hooks/use-batch-transcription";
import { formatElapsed, useRecorder } from "@/hooks/use-recorder";
import { useTranscription } from "@/hooks/use-transcription";
import { buildSessionText } from "@/lib/build-session-text";
import { saveSession, saveSessionAudio } from "@/lib/db";
import { useGlossary } from "@/lib/glossary/context";
import type { SessionContext } from "@/lib/glossary/types";
import { usePostRecordingPipeline } from "@/lib/post-recording-pipeline/context";
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

const STREAMING_SESSION_SOFT_MS = OPENAI_PROACTIVE_RENEWAL_AFTER_MS;

const EMPTY_SESSION_CONTEXT: SessionContext = {
  participants: "",
  topic: "",
  keywords: "",
};

function sessionContextForEnqueue(
  value: SessionContext,
): SessionContext | null {
  if (
    !value.participants.trim() &&
    !value.topic.trim() &&
    !value.keywords.trim()
  ) {
    return null;
  }
  return value;
}

export function Recorder({ onSessionSaved }: RecorderProps = {}) {
  const { settings } = useSettings();
  const { glossary } = useGlossary();
  const { setIsRecording } = useRecordingActivity();
  const { enqueue: enqueuePipeline, ...pipeline } = usePostRecordingPipeline();
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
  const [persistError, setPersistError] = useState<string | null>(null);
  const [sessionContext, setSessionContext] = useState<SessionContext>(
    EMPTY_SESSION_CONTEXT,
  );

  useEffect(() => {
    const recording = isBatchMode
      ? batch.status === "recording"
      : status === "recording";
    setIsRecording(recording);
    return () => {
      setIsRecording(false);
    };
  }, [batch.status, isBatchMode, setIsRecording, status]);

  const recordingActive = isBatchMode
    ? batch.status === "recording"
    : status === "recording";
  useBeforeUnload(
    recordingActive ||
      pipeline.isBusy ||
      (isBatchMode && batch.status === "transcribing"),
  );

  const finalsRef = useRef(finals);
  const partialRef = useRef(partial);
  const batchRetryInFlightRef = useRef(false);
  useEffect(() => {
    finalsRef.current = finals;
    partialRef.current = partial;
  }, [finals, partial]);

  const persistBatchResult = useCallback(
    async (stopped: BatchStopResult) => {
      const { partialText, finalBlob, segments } = stopped;
      if (!partialText.trim() && segments.length === 0) {
        return;
      }
      const id = await saveSession(partialText, {
        status: "transcribing",
      });
      if (segments.length > 0) {
        await saveSessionAudio(id, segments);
      }
      onSessionSaved?.(id);
      enqueuePipeline({
        sessionId: id,
        partialText,
        finalBlob,
        model: settings.batchModel,
        language: settings.language,
        meetingMinutesModel: settings.meetingMinutesModel,
        glossary: glossary.terms,
        sessionContext: sessionContextForEnqueue(sessionContext),
      });
    },
    [
      enqueuePipeline,
      glossary.terms,
      onSessionSaved,
      sessionContext,
      settings.batchModel,
      settings.language,
      settings.meetingMinutesModel,
    ],
  );

  const handleBatchRetry = useCallback(async () => {
    if (batchRetryInFlightRef.current || pipeline.isBusy) {
      return;
    }
    batchRetryInFlightRef.current = true;
    setPersistError(null);
    try {
      const stopped = await retryBatchTranscription();
      if (!stopped) {
        return;
      }
      await persistBatchResult(stopped);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[session-storage] save failed:", msg);
      setPersistError("세션을 저장하지 못했습니다.");
    } finally {
      batchRetryInFlightRef.current = false;
    }
  }, [persistBatchResult, pipeline.isBusy, retryBatchTranscription]);

  const start = useCallback(async () => {
    setUnsupportedModeMessage(null);
    setPersistError(null);
    if (pipeline.isBusy) {
      return;
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
  }, [
    prepareStreaming,
    settings.mode,
    startBatchRecording,
    startRecording,
    pipeline.isBusy,
  ]);

  const stop = useCallback(async () => {
    setPersistError(null);
    if (settings.mode === "batch") {
      const stopped = await stopBatchTranscribe();
      if (!stopped) {
        return;
      }
      try {
        await persistBatchResult(stopped);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[session-storage] save failed:", msg);
        setPersistError("세션을 저장하지 못했습니다.");
      }
      return;
    }

    try {
      await stopRecording();
    } finally {
      const snapshot = buildSessionText(finalsRef.current, partialRef.current);
      await finalizeStreaming();
      const trimmed = snapshot.trim();
      if (!trimmed) {
        return;
      }
      try {
        const id = await saveSession(trimmed, { status: "summarizing" });
        onSessionSaved?.(id);
        enqueuePipeline({
          sessionId: id,
          partialText: trimmed,
          finalBlob: null,
          model: settings.batchModel,
          language: settings.language,
          meetingMinutesModel: settings.meetingMinutesModel,
          glossary: glossary.terms,
          sessionContext: sessionContextForEnqueue(sessionContext),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[session-storage] save failed:", msg);
        setPersistError("세션을 저장하지 못했습니다.");
      }
    }
  }, [
    finalizeStreaming,
    onSessionSaved,
    enqueuePipeline,
    settings.batchModel,
    settings.language,
    settings.meetingMinutesModel,
    settings.mode,
    stopBatchTranscribe,
    stopRecording,
    persistBatchResult,
  ]);

  const displayElapsedMs = isBatchMode ? batch.elapsedMs : elapsedMs;
  const displayLevel = isBatchMode ? batch.level : level;
  const batchTranscribing = isBatchMode && batch.status === "transcribing";
  const batchRecording = isBatchMode && batch.status === "recording";
  const showStop = isBatchMode
    ? batch.status === "recording"
    : status === "recording";
  const showStart = !showStop && !batchTranscribing;

  const batchTranscriptText =
    pipeline.displayTranscript ??
    (batch.transcript && batch.transcript.length > 0 ? batch.transcript : null);
  const transcriptPartial = isBatchMode ? "" : partial;
  const transcriptFinals =
    isBatchMode && batchTranscriptText
      ? [batchTranscriptText]
      : isBatchMode
        ? []
        : finals;
  const transcriptError = isBatchMode ? batch.errorMessage : sttError;
  const batchRecordingHint = batchRecording
    ? "녹음 중입니다. 5분마다 스크립트 결과가 업데이트됩니다."
    : null;
  const batchLoadingMessage = batchTranscribing
    ? `스크립트 변환 중... (${batch.completedCount}/${batch.totalCount})`
    : null;
  const segmentInFlight =
    batchRecording &&
    batch.totalCount > 0 &&
    batch.completedCount < batch.totalCount;

  const streamingSessionHint =
    !isBatchMode &&
    status === "recording" &&
    elapsedMs >= STREAMING_SESSION_SOFT_MS
      ? settings.mode === "realtime"
        ? "세션이 곧 갱신됩니다."
        : settings.mode === "webSpeechApi"
          ? "녹음 시간이 길어지고 있습니다. 스크립트 변환이 중단될 수 있습니다."
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
              <RecordButton
                mode="start"
                disabled={pipeline.isBusy}
                onClick={() => void start()}
              />
            ) : showStop ? (
              <RecordButton mode="stop" onClick={() => void stop()} />
            ) : null}
          </div>
        </div>

        {pipeline.isBusy && !recordingActive ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400" role="status">
            이전 녹음을 처리 중입니다. 잠시만 기다려 주세요.
          </p>
        ) : null}

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
                <span>스크립트 진행률</span>
                <span>
                  {batch.completedCount} / {batch.totalCount} 세그먼트 완료
                </span>
              </div>
            )}
            <BatchRetryControl
              mode="recording"
              failedCount={batch.failedSegments.length}
              isRetrying={false}
              retryProcessed={0}
              retryTotal={0}
              onRetry={() => {}}
            />
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

        {isBatchMode &&
        ((batch.status === "error" && batch.errorMessage) ||
          (batch.status === "transcribing" && batch.retryTotalCount > 0)) ? (
          <BatchRetryControl
            mode="stopped"
            failedCount={batch.failedSegments.length}
            isRetrying={
              batch.status === "transcribing" && batch.retryTotalCount > 0
            }
            retryProcessed={batch.retryProcessedCount}
            retryTotal={batch.retryTotalCount}
            onRetry={() => void handleBatchRetry()}
            disabled={pipeline.isBusy}
          />
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

      <SessionContextInput
        value={sessionContext}
        onChange={setSessionContext}
        disabled={pipeline.isBusy}
      />

      {persistError || pipeline.errorMessage ? (
        <p
          className="text-sm text-rose-600 dark:text-rose-400"
          role="alert"
          data-testid="recorder-pipeline-user-error"
        >
          {persistError ?? pipeline.errorMessage}
        </p>
      ) : null}

      <TranscriptView
        partial={transcriptPartial}
        finals={transcriptFinals}
        errorMessage={transcriptError}
        showHeading={false}
        emptyStateHint={batchRecordingHint}
        loadingMessage={batchLoadingMessage}
        isSegmentInFlight={segmentInFlight}
      />
    </div>
  );
}
