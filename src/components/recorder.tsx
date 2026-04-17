"use client";

import { BatchRetryControl } from "@/components/batch-retry-control";
import { RecordButton } from "@/components/record-button";
import { SessionContextInput } from "@/components/session-context-input";
import { SessionMinutesModelSelect } from "@/components/session-minutes-model-select";
import { TranscriptView } from "@/components/transcript-view";
import {
  useBatchTranscription,
  type BatchStopResult,
} from "@/hooks/use-batch-transcription";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { formatElapsed, useRecorder } from "@/hooks/use-recorder";
import { useTranscription } from "@/hooks/use-transcription";
import { buildSessionText } from "@/lib/build-session-text";
import { saveSession, saveSessionAudio } from "@/lib/db";
import { useGlossary } from "@/lib/glossary/context";
import type { SessionContext } from "@/lib/glossary/types";
import { usePostRecordingPipeline } from "@/lib/post-recording-pipeline/context";
import { useRecordingActivity } from "@/lib/recording-activity/context";
import { buildScriptMeta } from "@/lib/session-script-meta";
import { useSettings } from "@/lib/settings/context";
import { BATCH_MODEL_OPTIONS } from "@/lib/settings/options";
import {
  createAssemblyAiRealtimeProvider,
  createOpenAiRealtimeProvider,
  createWebSpeechProvider,
  isWebSpeechApiSupported,
} from "@/lib/stt";
import { OPENAI_PROACTIVE_RENEWAL_AFTER_MS } from "@/lib/stt/openai-realtime";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type RecorderProps = {
  onSessionSaved?: (id: string) => void;
  /** 홈 2열 레이아웃용: 녹음 카드 아래 모델 패널(보통 `ModelQuickPanel`) */
  modelPanel?: ReactNode;
  /** 설정 모드를 특정 값으로 고정할 때 사용 (현재 `batch`만 지원) */
  fixedMode?: "batch";
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

export function Recorder({
  onSessionSaved,
  modelPanel = null,
  fixedMode,
}: RecorderProps = {}) {
  const { settings, updateSettings } = useSettings();
  const { glossary } = useGlossary();
  const { setIsRecording } = useRecordingActivity();
  const { enqueue: enqueuePipeline, ...pipeline } = usePostRecordingPipeline();
  const effectiveMode = fixedMode ?? settings.mode;
  const isBatchMode = effectiveMode === "batch";

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
    if (effectiveMode === "webSpeechApi") {
      return {
        tokenlessProvider: () => createWebSpeechProvider(settings.language),
      };
    }
    if (
      effectiveMode === "realtime" &&
      settings.realtimeEngine === "assemblyai"
    ) {
      return {
        createProvider: createAssemblyAiRealtimeProvider,
        useAssemblyAiPcmFraming: true as const,
      };
    }
    return {
      createProvider: createOpenAiRealtimeProvider,
      useAssemblyAiPcmFraming: false as const,
    };
  }, [effectiveMode, settings.language, settings.realtimeEngine]);

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
      const scriptMeta = buildScriptMeta({
        mode: effectiveMode,
        realtimeEngine: settings.realtimeEngine,
        batchModel: settings.batchModel,
        language: settings.language,
        meetingMinutesModel: settings.meetingMinutesModel,
      });
      const id = await saveSession(partialText, {
        status: "transcribing",
        scriptMeta,
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
        mode: effectiveMode,
        engine:
          effectiveMode === "realtime" ? settings.realtimeEngine : undefined,
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
      settings.realtimeEngine,
      effectiveMode,
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
    if (effectiveMode === "webSpeechApi") {
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
    if (effectiveMode === "batch") {
      await startBatchRecording();
      return;
    }
    const ok = await prepareStreaming();
    if (!ok) {
      return;
    }
    await startRecording();
  }, [
    effectiveMode,
    prepareStreaming,
    startBatchRecording,
    startRecording,
    pipeline.isBusy,
  ]);

  const stop = useCallback(async () => {
    setPersistError(null);
    if (effectiveMode === "batch") {
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
        const scriptMeta = buildScriptMeta({
          mode: effectiveMode,
          realtimeEngine: settings.realtimeEngine,
          batchModel: settings.batchModel,
          language: settings.language,
          meetingMinutesModel: settings.meetingMinutesModel,
        });
        const id = await saveSession(trimmed, {
          status: "summarizing",
          scriptMeta,
        });
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
          mode: effectiveMode,
          engine:
            effectiveMode === "realtime" ? settings.realtimeEngine : undefined,
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
    glossary.terms,
    sessionContext,
    settings.batchModel,
    settings.language,
    settings.meetingMinutesModel,
    settings.realtimeEngine,
    effectiveMode,
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
  const scriptSettingsDisabled =
    recordingActive || pipeline.isBusy || batchTranscribing;
  const modeLabel = isBatchMode
    ? "녹음 후 스크립트"
    : effectiveMode === "webSpeechApi"
      ? "Web Speech API"
      : "실시간 스크립트";

  const streamingSessionHint =
    !isBatchMode &&
    status === "recording" &&
    elapsedMs >= STREAMING_SESSION_SOFT_MS
      ? effectiveMode === "realtime"
        ? "세션이 곧 갱신됩니다."
        : effectiveMode === "webSpeechApi"
          ? "녹음 시간이 길어지고 있습니다. 스크립트 변환이 중단될 수 있습니다."
          : null
      : null;

  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 md:grid md:grid-cols-2 md:items-start"
      data-testid="recorder-root"
      data-transcription-mode={effectiveMode}
    >
      <div className="flex min-w-0 flex-col gap-6 md:max-w-md">
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
            <p
              className="text-sm text-zinc-600 dark:text-zinc-400"
              role="status"
            >
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
            <p
              className="text-sm text-zinc-600 dark:text-zinc-400"
              role="status"
            >
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
            <p
              className="text-sm text-rose-600 dark:text-rose-400"
              role="alert"
            >
              {recorderError}
            </p>
          ) : null}
        </section>

        <section
          className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          aria-label="스크립트 설정"
          data-testid="recorder-script-settings"
        >
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            스크립트 설정
          </h2>

          <div className="mb-4">
            <label
              htmlFor="recorder-script-model"
              className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              스크립트 모드
            </label>
            <select
              id="recorder-script-model"
              data-testid="recorder-script-model-select"
              disabled={true}
              value={effectiveMode}
              className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value={effectiveMode}>{modeLabel}</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="recorder-script-model"
              className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              스크립트 모델
            </label>
            <select
              id="recorder-script-model"
              data-testid="recorder-script-model-select"
              disabled={scriptSettingsDisabled}
              value={settings.batchModel}
              onChange={(e) => updateSettings({ batchModel: e.target.value })}
              className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              {BATCH_MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {modelPanel}

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

      <div className="flex min-w-0 flex-col gap-6">
        <SessionContextInput
          value={sessionContext}
          onChange={setSessionContext}
          disabled={pipeline.isBusy}
          topContent={
            <SessionMinutesModelSelect
              value={settings.meetingMinutesModel}
              onChange={(modelId) =>
                updateSettings({ meetingMinutesModel: modelId })
              }
              disabled={scriptSettingsDisabled}
            />
          }
        />
      </div>

      {persistError || pipeline.errorMessage ? (
        <p
          className="text-sm text-rose-600 dark:text-rose-400 md:col-span-2"
          role="alert"
          data-testid="recorder-pipeline-user-error"
        >
          {persistError ?? pipeline.errorMessage}
        </p>
      ) : null}
    </div>
  );
}
