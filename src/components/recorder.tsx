"use client";

import { MeetingTemplateSelector } from "@/components/meeting-template-selector";
import { RecordingCard } from "@/components/recording-card";
import { SessionContextInput } from "@/components/session-context-input";
import { TranscriptView } from "@/components/transcript-view";
import {
  useBatchTranscription,
  type BatchStopResult,
} from "@/hooks/use-batch-transcription";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { useRecorder } from "@/hooks/use-recorder";
import { useTranscription } from "@/hooks/use-transcription";
import { buildSessionText } from "@/lib/build-session-text";
import { saveSession, saveSessionAudio } from "@/lib/db";
import { useGlossary } from "@/lib/glossary/context";
import type { SessionContext } from "@/lib/glossary/types";
import {
  DEFAULT_MEETING_MINUTES_TEMPLATE,
  type MeetingMinutesTemplate,
} from "@/lib/meeting-minutes/templates";
import { usePostRecordingPipeline } from "@/lib/post-recording-pipeline/context";
import { useRecordingActivity } from "@/lib/recording-activity/context";
import { buildScriptMeta } from "@/lib/session-script-meta";
import { useSettings } from "@/lib/settings/context";
import {
  createAssemblyAiRealtimeProvider,
  createOpenAiRealtimeProvider,
  createWebSpeechProvider,
  isWebSpeechApiSupported,
} from "@/lib/stt";
import { OPENAI_PROACTIVE_RENEWAL_AFTER_MS } from "@/lib/stt/openai-realtime";
import { RevealSection } from "@/components/recorder-reveal-section";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type RecorderProps = {
  onSessionSaved?: (id: string) => void;
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

export function Recorder({ onSessionSaved, fixedMode }: RecorderProps = {}) {
  const { settings } = useSettings();
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
  const [meetingTemplate, setMeetingTemplate] =
    useState<MeetingMinutesTemplate>(DEFAULT_MEETING_MINUTES_TEMPLATE);

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
        meetingTemplate,
        mode: effectiveMode,
        engine:
          effectiveMode === "realtime" ? settings.realtimeEngine : undefined,
      });
    },
    [
      enqueuePipeline,
      glossary.terms,
      meetingTemplate,
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
          meetingTemplate,
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
    meetingTemplate,
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
  const hasTranscriptScript = isBatchMode
    ? Boolean(batchTranscriptText?.trim())
    : transcriptFinals.some((f) => f.trim().length > 0) ||
      transcriptPartial.trim().length > 0;
  const showSessionContext = recordingActive;
  const showTranscript = recordingActive && hasTranscriptScript;
  const showTranscriptErrorOnCard =
    recordingActive && Boolean(transcriptError?.trim()) && !hasTranscriptScript;
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
      ? effectiveMode === "realtime"
        ? "세션이 곧 갱신됩니다."
        : effectiveMode === "webSpeechApi"
          ? "녹음 시간이 길어지고 있습니다. 스크립트 변환이 중단될 수 있습니다."
          : null
      : null;

  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-col"
      data-testid="recorder-root"
      data-transcription-mode={effectiveMode}
    >
      <RecordingCard
        elapsedMs={displayElapsedMs}
        level={displayLevel}
        showStart={showStart}
        showStop={showStop}
        recordingActive={recordingActive}
        onStart={() => void start()}
        onStop={() => void stop()}
        isBatchMode={isBatchMode}
        batchRecording={batchRecording}
        segmentProgress={batch.segmentProgress}
        completedCount={batch.completedCount}
        totalCount={batch.totalCount}
        failedCount={batch.failedSegments.length}
        stoppedRetry={
          isBatchMode &&
          ((batch.status === "error" && batch.errorMessage) ||
            (batch.status === "transcribing" && batch.retryTotalCount > 0))
            ? {
                failedCount: batch.failedSegments.length,
                isRetrying:
                  batch.status === "transcribing" && batch.retryTotalCount > 0,
                retryProcessed: batch.retryProcessedCount,
                retryTotal: batch.retryTotalCount,
                onRetry: () => void handleBatchRetry(),
                disabled: pipeline.isBusy,
              }
            : null
        }
        messages={[
          ...(isBatchMode && batch.softLimitMessage
            ? [{ text: batch.softLimitMessage, tone: "warning" as const }]
            : []),
          ...(streamingSessionHint
            ? [{ text: streamingSessionHint, tone: "warning" as const }]
            : []),
          ...(reconnectToast
            ? [{ text: reconnectToast, tone: "muted" as const }]
            : []),
          ...(unsupportedModeMessage
            ? [{ text: unsupportedModeMessage, tone: "warning" as const }]
            : []),
          ...(recorderError
            ? [{ text: recorderError, tone: "error" as const }]
            : []),
          ...(showTranscriptErrorOnCard && transcriptError
            ? [{ text: transcriptError.trim(), tone: "error" as const }]
            : []),
        ]}
      />

      <RevealSection
        visible={showSessionContext}
        testId="reveal-session-context"
      >
        <SessionContextInput
          value={sessionContext}
          onChange={setSessionContext}
          disabled={pipeline.isBusy}
          topContent={
            <MeetingTemplateSelector
              value={meetingTemplate}
              onChange={setMeetingTemplate}
              disabled={pipeline.isBusy}
            />
          }
        />
      </RevealSection>

      <RevealSection visible={showTranscript} testId="reveal-transcript">
        <TranscriptView
          partial={transcriptPartial}
          finals={transcriptFinals}
          errorMessage={showTranscript ? transcriptError : null}
          showHeading={false}
          emptyStateHint={batchRecordingHint}
          loadingMessage={batchLoadingMessage}
          isSegmentInFlight={segmentInFlight}
        />
      </RevealSection>

      {persistError || pipeline.errorMessage ? (
        <p
          className="mt-6 text-sm text-rose-600 dark:text-rose-400"
          role="alert"
          data-testid="recorder-pipeline-user-error"
        >
          {persistError ?? pipeline.errorMessage}
        </p>
      ) : null}
    </div>
  );
}
