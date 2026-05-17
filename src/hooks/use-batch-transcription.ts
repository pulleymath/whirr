"use client";

import {
  mapMediaErrorToMessage,
  startSegmentedRecording,
  type SegmentedRecordingSession,
} from "@/lib/audio";
import {
  transcribeBlobWithRetries,
  userFacingTranscribeError,
} from "@/lib/transcribe-segment";
import { useCallback, useEffect, useRef, useState } from "react";

export type BatchTranscriptionStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "done"
  | "error";

export type BatchStopResult = {
  /** 마지막 세그먼트를 제외한 확정 스크립트(공백으로 join) */
  partialText: string;
  /** 파이프라인에서 스크립트로 변환할 마지막 블롭(없으면 null) */
  finalBlob: Blob | null;
  /** 다운로드용 연속 WebM(없으면 null) */
  fullAudioBlob: Blob | null;
  segments: Blob[];
  /** true면 일부 구간 전사 실패 — 오디오는 반환하되 파이프라인 enqueue는 하지 않는다 */
  transcriptionFailed?: boolean;
  failedSegmentIndexes?: number[];
};

const LEVEL_UI_MIN_INTERVAL_MS = 48;
const MINUTES = 60 * 1000;
const SEGMENT_DURATION_MS = 3 * MINUTES; // 3분
const BATCH_SOFT_LIMIT_MS = 235 * MINUTES;
const BATCH_HARD_LIMIT_MS = 240 * MINUTES;

export type UseBatchTranscriptionOptions = {
  model?: string;
  language?: string;
};

export type UseBatchTranscriptionReturn = {
  status: BatchTranscriptionStatus;
  transcript: string | null;
  errorMessage: string | null;
  elapsedMs: number;
  level: number;
  /** 전체 녹음 상한 5분 전(235분 경과)에 한 번 설정되는 안내 문구 */
  softLimitMessage: string | null;
  /** 현재 세그먼트 진행률 (0~1) */
  segmentProgress: number;
  /** 현재까지 녹음된 모든 세그먼트 Blob */
  segments: Blob[];
  /** 완료된 세그먼트 수 */
  completedCount: number;
  /** 전체 세그먼트 수 */
  totalCount: number;
  /** 실패한 세그먼트 인덱스 목록 */
  failedSegments: number[];
  /** 수동 재시도 시 총 대상 개수(진행률 분모) */
  retryTotalCount: number;
  /** 수동 재시도 시 처리 완료 개수(진행률 분자) */
  retryProcessedCount: number;
  /** 내부 세션 참조 (병합된 오디오 추출용) */
  sessionRef: React.RefObject<SegmentedRecordingSession | null>;
  startRecording: () => Promise<void>;
  /**
   * 진행 중인 세그먼트 스크립트 변환만 대기한 뒤 마지막 블롭은 변환하지 않고 반환.
   * 성공 시 `idle`, 실패 시 `error` 및 `null`.
   */
  stopAndTranscribe: () => Promise<BatchStopResult | null>;
  /** 직전 실패한 녹음 세그먼트들로 스크립트 변환을 다시 시도한다 */
  retryTranscription: () => Promise<BatchStopResult | null>;
};

export function useBatchTranscription(
  options: UseBatchTranscriptionOptions = {},
): UseBatchTranscriptionReturn {
  const model = options.model?.trim() || "whisper-1";
  const language = options.language?.trim() || "ko";

  const [status, setStatus] = useState<BatchTranscriptionStatus>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [softLimitMessage, setSoftLimitMessage] = useState<string | null>(null);
  const [segmentProgress, setSegmentProgress] = useState(0);
  const [segments, setSegments] = useState<Blob[]>([]);

  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [failedSegments, setFailedSegments] = useState<number[]>([]);
  const [retryTotalCount, setRetryTotalCount] = useState(0);
  const [retryProcessedCount, setRetryProcessedCount] = useState(0);

  const sessionRef = useRef<SegmentedRecordingSession | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const lastSegmentTimeRef = useRef(0);
  const levelDataRef = useRef<Uint8Array | null>(null);
  const lastLevelUiMsRef = useRef(0);
  const cancelledRef = useRef(false);
  const startingRef = useRef(false);
  const softWarnedRef = useRef(false);
  const hardStopRef = useRef(false);
  const autoHardRef = useRef(false);
  const transcribeInFlightRef = useRef(false);
  const segmentsRef = useRef<Blob[]>([]);
  const partialTranscriptsRef = useRef<(string | null)[]>([]);
  const statusRef = useRef(status);
  statusRef.current = status;

  const queueRef = useRef<number[]>([]);
  const queueSetRef = useRef<Set<number>>(new Set());
  const workerRunningRef = useRef(false);
  const workerIdleResolveRef = useRef<(() => void) | null>(null);
  const workerIdlePromiseRef = useRef<Promise<void> | null>(null);
  /** true only during `retryTranscription` — UI 진행률 카운터용 */
  const trackRetryProgressRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setLevel(0);
    setSegmentProgress(0);
  }, []);

  const refreshTranscriptFromPartials = useCallback(() => {
    const joined = partialTranscriptsRef.current
      .filter((t): t is string => t !== null && t.length > 0)
      .join(" ");
    setTranscript(joined.length > 0 ? joined : null);
  }, []);

  const runTranscribeWithRetries = useCallback(
    async (blob: Blob, index: number): Promise<string | null> => {
      const r = await transcribeBlobWithRetries(blob, { model, language });
      if (r.ok) {
        setCompletedCount((prev) => prev + 1);
        setFailedSegments((prev) => prev.filter((i) => i !== index));
        return r.text;
      }
      setFailedSegments((prev) => Array.from(new Set([...prev, index])));
      setErrorMessage(userFacingTranscribeError(r.errRaw));
      return null;
    },
    [language, model],
  );

  const beginWorkerIdlePromise = useCallback(() => {
    if (workerIdlePromiseRef.current != null) {
      return;
    }
    workerIdlePromiseRef.current = new Promise<void>((resolve) => {
      workerIdleResolveRef.current = resolve;
    });
  }, []);

  const resolveWorkerIdleIfIdle = useCallback(() => {
    if (
      queueRef.current.length === 0 &&
      !workerRunningRef.current &&
      workerIdleResolveRef.current
    ) {
      workerIdleResolveRef.current();
      workerIdleResolveRef.current = null;
      workerIdlePromiseRef.current = null;
    }
  }, []);

  const runWorker = useCallback(async () => {
    if (workerRunningRef.current) {
      return;
    }
    workerRunningRef.current = true;
    beginWorkerIdlePromise();

    try {
      for (;;) {
        while (queueRef.current.length > 0) {
          const index = queueRef.current.shift()!;
          queueSetRef.current.delete(index);
          if (index < 0 || index >= segmentsRef.current.length) {
            continue;
          }
          const existing = partialTranscriptsRef.current[index];
          if (existing !== null) {
            continue;
          }
          const blob = segmentsRef.current[index];
          if (!blob || blob.size === 0) {
            partialTranscriptsRef.current[index] = "";
            refreshTranscriptFromPartials();
            if (trackRetryProgressRef.current) {
              setRetryProcessedCount((prev) => prev + 1);
            }
            continue;
          }
          const text = await runTranscribeWithRetries(blob, index);
          partialTranscriptsRef.current[index] = text;
          refreshTranscriptFromPartials();
          if (trackRetryProgressRef.current) {
            setRetryProcessedCount((prev) => prev + 1);
          }
        }
        workerRunningRef.current = false;
        resolveWorkerIdleIfIdle();
        if (queueRef.current.length === 0) {
          break;
        }
        workerRunningRef.current = true;
      }
    } catch (e) {
      workerRunningRef.current = false;
      resolveWorkerIdleIfIdle();
      // void runWorker() 호출부에서 처리되지 않은 rejection을 막기 위해 여기서 삼킨다.
      // STT 경로는 대부분 결과 객체로 실패를 돌려주며, 예외는 극히 드물다.
      if (process.env.NODE_ENV !== "production") {
        console.error("[use-batch-transcription] worker:", e);
      }
    }
  }, [
    beginWorkerIdlePromise,
    refreshTranscriptFromPartials,
    resolveWorkerIdleIfIdle,
    runTranscribeWithRetries,
  ]);

  const enqueueIndices = useCallback(
    (indices: number[]) => {
      let added = false;
      for (const index of indices) {
        if (index < 0 || index >= segmentsRef.current.length) {
          continue;
        }
        if (partialTranscriptsRef.current[index] !== null) {
          continue;
        }
        if (queueSetRef.current.has(index)) {
          continue;
        }
        queueRef.current.push(index);
        queueSetRef.current.add(index);
        added = true;
      }
      if (!added) {
        resolveWorkerIdleIfIdle();
        return;
      }
      queueRef.current.sort((a, b) => a - b);
      beginWorkerIdlePromise();
      void runWorker();
    },
    [beginWorkerIdlePromise, resolveWorkerIdleIfIdle, runWorker],
  );

  const awaitWorkerIdle = useCallback(async () => {
    const p = workerIdlePromiseRef.current;
    if (p) {
      await p;
    }
  }, []);

  const stopAndTranscribe =
    useCallback(async (): Promise<BatchStopResult | null> => {
      if (
        transcribeInFlightRef.current ||
        statusRef.current === "transcribing"
      ) {
        return null;
      }
      const allow = statusRef.current === "recording" || autoHardRef.current;
      if (!allow) {
        return null;
      }
      autoHardRef.current = false;
      transcribeInFlightRef.current = true;
      setSoftLimitMessage(null);
      setErrorMessage(null);

      try {
        const session = sessionRef.current;
        sessionRef.current = null;
        clearTimers();

        if (!session) {
          setStatus("error");
          setErrorMessage("녹음 세션이 없습니다.");
          return null;
        }

        let finalBlob: Blob;
        let fullAudioBlob: Blob | null = null;
        try {
          finalBlob = await session.stopFinalSegment();
          const full = await session.getFullAudioBlob();
          fullAudioBlob = full.size > 0 ? full : null;
          await session.close();
        } catch (e) {
          setStatus("error");
          setErrorMessage(mapMediaErrorToMessage(e));
          return null;
        }

        if (finalBlob.size > 0) {
          const index = segmentsRef.current.length;
          segmentsRef.current.push(finalBlob);
          setSegments([...segmentsRef.current]);
          setTotalCount((prev) => prev + 1);
          partialTranscriptsRef.current[index] = null;
        }

        if (segmentsRef.current.length === 0) {
          setStatus("error");
          setErrorMessage("녹음 데이터가 없습니다.");
          return null;
        }

        setStatus("transcribing");

        const segs = segmentsRef.current;
        const lastIdx = segs.length - 1;
        const pending: number[] = [];
        for (let i = 0; i < lastIdx; i++) {
          if (partialTranscriptsRef.current[i] === null) {
            pending.push(i);
          }
        }
        if (pending.length > 0) {
          enqueueIndices(pending);
        }

        await awaitWorkerIdle();

        const failedIndexes: number[] = [];
        for (let i = 0; i < lastIdx; i++) {
          if (partialTranscriptsRef.current[i] === null) {
            failedIndexes.push(i);
          }
        }

        const partialText = partialTranscriptsRef.current
          .slice(0, lastIdx)
          .filter((t): t is string => t !== null && t.length > 0)
          .join(" ");

        const lastBlob = segs[lastIdx] ?? null;
        const finalForPipeline =
          lastBlob && lastBlob.size > 0 ? lastBlob : null;

        if (failedIndexes.length > 0) {
          setTranscript(partialText.length > 0 ? partialText : null);
          setStatus("error");
          setErrorMessage("일부 구간 스크립트 변환에 실패했습니다.");
          return {
            partialText,
            finalBlob: finalForPipeline,
            fullAudioBlob,
            segments: [...segs],
            transcriptionFailed: true,
            failedSegmentIndexes: failedIndexes,
          };
        }

        setTranscript(partialText.length > 0 ? partialText : null);
        setStatus("idle");
        return {
          partialText,
          finalBlob: finalForPipeline,
          fullAudioBlob,
          segments: [...segs],
        };
      } finally {
        transcribeInFlightRef.current = false;
      }
    }, [awaitWorkerIdle, clearTimers, enqueueIndices]);

  const stopAndTranscribeRef = useRef(stopAndTranscribe);
  stopAndTranscribeRef.current = stopAndTranscribe;

  const retryTranscription =
    useCallback(async (): Promise<BatchStopResult | null> => {
      if (transcribeInFlightRef.current) {
        return null;
      }
      if (segmentsRef.current.length === 0 || statusRef.current !== "error") {
        return null;
      }
      transcribeInFlightRef.current = true;
      setErrorMessage(null);
      setStatus("transcribing");

      const lastIdx = segmentsRef.current.length - 1;
      const pending: number[] = [];
      for (let i = 0; i <= lastIdx; i++) {
        if (partialTranscriptsRef.current[i] === null) {
          pending.push(i);
        }
      }
      setRetryTotalCount(pending.length);
      setRetryProcessedCount(0);

      try {
        if (pending.length > 0) {
          trackRetryProgressRef.current = true;
          enqueueIndices(pending);
          await awaitWorkerIdle();
        }

        const hasFailed = partialTranscriptsRef.current.some((t) => t === null);
        const fullText = partialTranscriptsRef.current
          .filter((t): t is string => t !== null && t.length > 0)
          .join(" ");

        setTranscript(fullText.length > 0 ? fullText : null);
        setRetryTotalCount(0);
        setRetryProcessedCount(0);

        if (hasFailed) {
          setStatus("error");
          return null;
        }
        setStatus("done");
        return {
          partialText: fullText,
          finalBlob: null,
          fullAudioBlob: null,
          segments: [...segmentsRef.current],
        };
      } finally {
        trackRetryProgressRef.current = false;
        transcribeInFlightRef.current = false;
      }
    }, [awaitWorkerIdle, enqueueIndices]);

  const enqueueIndicesRef = useRef(enqueueIndices);
  enqueueIndicesRef.current = enqueueIndices;

  useEffect(() => {
    if (status !== "recording") {
      return;
    }
    const handler = () => {
      if (statusRef.current !== "recording") {
        return;
      }
      const pending: number[] = [];
      const n = segmentsRef.current.length;
      for (let i = 0; i < n; i++) {
        if (partialTranscriptsRef.current[i] === null) {
          pending.push(i);
        }
      }
      if (pending.length > 0) {
        enqueueIndicesRef.current(pending);
      }
    };
    window.addEventListener("online", handler);
    return () => {
      window.removeEventListener("online", handler);
    };
  }, [status]);

  const startRecording = useCallback(async () => {
    if (startingRef.current || sessionRef.current != null) {
      return;
    }
    cancelledRef.current = false;
    startingRef.current = true;
    segmentsRef.current = [];
    setSegments([]);
    partialTranscriptsRef.current = [];
    queueRef.current = [];
    queueSetRef.current = new Set();
    workerRunningRef.current = false;
    workerIdleResolveRef.current = null;
    workerIdlePromiseRef.current = null;
    setErrorMessage(null);
    setTranscript(null);
    setSoftLimitMessage(null);
    softWarnedRef.current = false;
    hardStopRef.current = false;
    setElapsedMs(0);
    setSegmentProgress(0);
    setCompletedCount(0);
    setTotalCount(0);
    setFailedSegments([]);
    setRetryTotalCount(0);
    setRetryProcessedCount(0);
    setStatus("idle");

    try {
      const session = await startSegmentedRecording();
      if (cancelledRef.current) {
        await session.stopFinalSegment().catch(() => {});
        await session.close().catch(() => {});
        return;
      }
      sessionRef.current = session;
      setStatus("recording");
      startTimeRef.current = Date.now();
      lastSegmentTimeRef.current = startTimeRef.current;
      lastLevelUiMsRef.current = performance.now();

      intervalRef.current = setInterval(async () => {
        const now = Date.now();
        const elapsed = now - startTimeRef.current;
        const segmentElapsed = now - lastSegmentTimeRef.current;

        setElapsedMs(elapsed);
        setSegmentProgress(Math.min(1, segmentElapsed / SEGMENT_DURATION_MS));

        if (segmentElapsed >= SEGMENT_DURATION_MS) {
          lastSegmentTimeRef.current = now;
          setSegmentProgress(0);
          const blob = await session.rotateSegment();
          if (blob.size > 0) {
            segmentsRef.current.push(blob);
            setSegments([...segmentsRef.current]);
            setTotalCount((prev) => prev + 1);
            const index = segmentsRef.current.length - 1;
            partialTranscriptsRef.current[index] = null;
            const toEnqueue: number[] = [];
            for (let i = 0; i < index; i++) {
              if (partialTranscriptsRef.current[i] === null) {
                toEnqueue.push(i);
              }
            }
            toEnqueue.push(index);
            enqueueIndices(toEnqueue);
          }
        }

        if (!softWarnedRef.current && elapsed >= BATCH_SOFT_LIMIT_MS) {
          softWarnedRef.current = true;
          setSoftLimitMessage("녹음 가능 시간이 5분 남았습니다.");
        }

        if (!hardStopRef.current && elapsed >= BATCH_HARD_LIMIT_MS) {
          hardStopRef.current = true;
          autoHardRef.current = true;
          void stopAndTranscribeRef.current();
        }
      }, 250);

      const tick = () => {
        if (cancelledRef.current || !sessionRef.current) {
          return;
        }
        const a = session.analyser;
        const n = a.frequencyBinCount;
        let data = levelDataRef.current;
        if (!data || data.length !== n) {
          data = new Uint8Array(n);
          levelDataRef.current = data;
        }
        a.getByteTimeDomainData(
          data as Parameters<AnalyserNode["getByteTimeDomainData"]>[0],
        );
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const now = performance.now();
        if (now - lastLevelUiMsRef.current >= LEVEL_UI_MIN_INTERVAL_MS) {
          setLevel(Math.min(1, rms * 4));
          lastLevelUiMsRef.current = now;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setStatus("error");
      setErrorMessage(mapMediaErrorToMessage(err));
    } finally {
      startingRef.current = false;
    }
  }, [enqueueIndices]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      clearTimers();
      queueRef.current = [];
      queueSetRef.current = new Set();
      const s = sessionRef.current;
      sessionRef.current = null;
      if (s) {
        void s.stopFinalSegment().catch(() => {});
        void s.close().catch(() => {});
      }
    };
  }, [clearTimers]);

  return {
    status,
    transcript,
    errorMessage,
    elapsedMs,
    level,
    softLimitMessage,
    segmentProgress,
    segments,
    completedCount,
    totalCount,
    failedSegments,
    retryTotalCount,
    retryProcessedCount,
    startRecording,
    stopAndTranscribe,
    retryTranscription,
    sessionRef,
  };
}
