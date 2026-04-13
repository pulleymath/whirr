"use client";

import {
  mapMediaErrorToMessage,
  startSegmentedRecording,
  type SegmentedRecordingSession,
} from "@/lib/audio";
import { userFacingSttError } from "@/lib/stt/user-facing-error";
import { useCallback, useEffect, useRef, useState } from "react";

export type BatchTranscriptionStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "done"
  | "error";

const LEVEL_UI_MIN_INTERVAL_MS = 48;
const SEGMENT_DURATION_MS = 5 * 60 * 1000; // 5분
const BATCH_SOFT_LIMIT_MS = 235 * 60 * 1000;
const BATCH_HARD_LIMIT_MS = 240 * 60 * 1000;

const BATCH_TRANSCRIBE_RETRY_BACKOFF_MS = [2000, 4000] as const;
const BATCH_TRANSCRIBE_MAX_ATTEMPTS = 3;

function shouldRetryBatchTranscribeStatus(statusCode: number): boolean {
  if (statusCode === 0) {
    return true;
  }
  return statusCode >= 500;
}

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
  /** 55분 경과 시 한 번 설정되는 안내 문구 */
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
  /** 내부 세션 참조 (병합된 오디오 추출용) */
  sessionRef: React.RefObject<SegmentedRecordingSession | null>;
  startRecording: () => Promise<void>;
  /** 성공 시 전사 텍스트, 실패·빈 결과 시 `null` */
  stopAndTranscribe: () => Promise<string | null>;
  /** 직전 실패한 녹음 세그먼트들로 전사를 다시 시도한다 */
  retryTranscription: () => Promise<string | null>;
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
  const pendingPromisesRef = useRef<Set<Promise<void>>>(new Set());
  const statusRef = useRef(status);
  statusRef.current = status;

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

  const transcribeBlobOnce = useCallback(
    async (
      blob: Blob,
    ): Promise<{
      ok: boolean;
      text: string | null;
      errRaw: string;
      status: number;
    }> => {
      const fd = new FormData();
      fd.set("file", blob, "recording.webm");
      fd.set("model", model);
      if (language && language.toLowerCase() !== "auto") {
        fd.set("language", language);
      }
      try {
        const res = await fetch("/api/stt/transcribe", {
          method: "POST",
          body: fd,
        });
        if (res.status === 401 || res.status === 403) {
          // 인증 에러 등은 재시도하지 않음
          return {
            ok: false,
            text: null,
            errRaw: "AUTH_ERROR",
            status: res.status,
          };
        }
        let payload: unknown;
        try {
          payload = await res.json();
        } catch {
          payload = null;
        }
        const errRaw =
          payload &&
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof (payload as { error: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "";

        if (!res.ok) {
          return {
            ok: false,
            text: null,
            errRaw: errRaw || "STT_PROVIDER_ERROR",
            status: res.status,
          };
        }

        const text =
          payload &&
          typeof payload === "object" &&
          payload !== null &&
          "text" in payload &&
          typeof (payload as { text: unknown }).text === "string"
            ? (payload as { text: string }).text.trim()
            : "";

        return { ok: true, text, errRaw: "", status: res.status };
      } catch {
        return {
          ok: false,
          text: null,
          errRaw: "Failed to transcribe audio",
          status: 0,
        };
      }
    },
    [language, model],
  );

  const runTranscribeWithRetries = useCallback(
    async (blob: Blob, index: number): Promise<string | null> => {
      for (
        let attempt = 0;
        attempt < BATCH_TRANSCRIBE_MAX_ATTEMPTS;
        attempt++
      ) {
        if (attempt > 0) {
          const delay =
            BATCH_TRANSCRIBE_RETRY_BACKOFF_MS[attempt - 1] ??
            BATCH_TRANSCRIBE_RETRY_BACKOFF_MS[
              BATCH_TRANSCRIBE_RETRY_BACKOFF_MS.length - 1
            ];
          await new Promise((r) => setTimeout(r, delay));
        }
        const result = await transcribeBlobOnce(blob);
        if (result.ok) {
          setCompletedCount((prev) => prev + 1);
          setFailedSegments((prev) => prev.filter((i) => i !== index));
          return result.text || "";
        }
        const retry = shouldRetryBatchTranscribeStatus(result.status);
        if (!retry || attempt === BATCH_TRANSCRIBE_MAX_ATTEMPTS - 1) {
          setFailedSegments((prev) => Array.from(new Set([...prev, index])));
          setErrorMessage(userFacingSttError(result.errRaw));
          return null;
        }
      }
      return null;
    },
    [transcribeBlobOnce],
  );

  const stopAndTranscribe = useCallback(async (): Promise<string | null> => {
    if (transcribeInFlightRef.current || statusRef.current === "transcribing") {
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
      try {
        finalBlob = await session.stopFinalSegment();
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

        const promise = runTranscribeWithRetries(finalBlob, index).then(
          (text) => {
            partialTranscriptsRef.current[index] = text;
          },
        );
        pendingPromisesRef.current.add(promise);
        promise.finally(() => {
          pendingPromisesRef.current.delete(promise);
        });
      }

      if (segmentsRef.current.length === 0) {
        setStatus("error");
        setErrorMessage("녹음 데이터가 없습니다.");
        return null;
      }

      setStatus("transcribing");

      // 모든 진행 중인 전사 기다리기
      await Promise.allSettled(Array.from(pendingPromisesRef.current));

      const hasFailed = partialTranscriptsRef.current.some((t) => t === null);
      const fullText = partialTranscriptsRef.current
        .filter((t): t is string => t !== null && t.length > 0)
        .join(" ");

      setTranscript(fullText);
      if (hasFailed) {
        setStatus("error");
        return null;
      }
      setStatus("done");
      return fullText;
    } finally {
      transcribeInFlightRef.current = false;
    }
  }, [runTranscribeWithRetries, clearTimers]);

  const retryTranscription = useCallback(async (): Promise<string | null> => {
    if (transcribeInFlightRef.current) {
      return null;
    }
    if (segmentsRef.current.length === 0 || statusRef.current !== "error") {
      return null;
    }
    transcribeInFlightRef.current = true;
    setErrorMessage(null);
    setStatus("transcribing");

    try {
      const promises = segmentsRef.current.map((blob, index) => {
        if (partialTranscriptsRef.current[index] === null) {
          return runTranscribeWithRetries(blob, index).then((text) => {
            partialTranscriptsRef.current[index] = text;
          });
        }
        return Promise.resolve();
      });

      await Promise.allSettled(promises);

      const hasFailed = partialTranscriptsRef.current.some((t) => t === null);
      const fullText = partialTranscriptsRef.current
        .filter((t): t is string => t !== null && t.length > 0)
        .join(" ");

      setTranscript(fullText);
      if (hasFailed) {
        setStatus("error");
        return null;
      }
      setStatus("done");
      return fullText;
    } finally {
      transcribeInFlightRef.current = false;
    }
  }, [runTranscribeWithRetries]);

  const stopAndTranscribeRef = useRef(stopAndTranscribe);
  stopAndTranscribeRef.current = stopAndTranscribe;

  const startRecording = useCallback(async () => {
    if (startingRef.current || sessionRef.current != null) {
      return;
    }
    cancelledRef.current = false;
    startingRef.current = true;
    segmentsRef.current = [];
    setSegments([]);
    partialTranscriptsRef.current = [];
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
            // 백그라운드 전사 시작
            const index = segmentsRef.current.length - 1;
            const promise = runTranscribeWithRetries(blob, index).then(
              (text) => {
                partialTranscriptsRef.current[index] = text;
                setTranscript(() => {
                  return partialTranscriptsRef.current
                    .filter((t): t is string => t !== null && t.length > 0)
                    .join(" ");
                });
              },
            );
            pendingPromisesRef.current.add(promise);
            promise.finally(() => {
              pendingPromisesRef.current.delete(promise);
            });
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
  }, [runTranscribeWithRetries]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      clearTimers();
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
    startRecording,
    stopAndTranscribe,
    retryTranscription,
    sessionRef,
  };
}
