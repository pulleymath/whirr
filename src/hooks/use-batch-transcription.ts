"use client";

import {
  mapMediaErrorToMessage,
  startBlobRecording,
  type BlobRecordingSession,
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
const BATCH_SOFT_LIMIT_MS = 55 * 60 * 1000;
const BATCH_HARD_LIMIT_MS = 60 * 60 * 1000;

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
  startRecording: () => Promise<void>;
  /** 성공 시 전사 텍스트, 실패·빈 결과 시 `null` */
  stopAndTranscribe: () => Promise<string | null>;
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

  const sessionRef = useRef<BlobRecordingSession | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const levelDataRef = useRef<Uint8Array | null>(null);
  const lastLevelUiMsRef = useRef(0);
  const cancelledRef = useRef(false);
  const startingRef = useRef(false);
  const softWarnedRef = useRef(false);
  const hardStopRef = useRef(false);
  const autoHardRef = useRef(false);
  const transcribeInFlightRef = useRef(false);
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
  }, []);

  const stopBlobOnly = useCallback(async () => {
    clearTimers();
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) {
      return null;
    }
    return session.stop();
  }, [clearTimers]);

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
      let blob: Blob | null = null;
      try {
        blob = await stopBlobOnly();
      } catch (e) {
        setStatus("error");
        setErrorMessage(mapMediaErrorToMessage(e));
        return null;
      }

      if (!blob || blob.size === 0) {
        setStatus("error");
        setErrorMessage("녹음 데이터가 없습니다.");
        return null;
      }

      setStatus("transcribing");

      const fd = new FormData();
      fd.set("file", blob, "recording.webm");
      fd.set("model", model);
      if (language && language.toLowerCase() !== "auto") {
        fd.set("language", language);
      }

      blob = null;

      const res = await fetch("/api/stt/transcribe", {
        method: "POST",
        body: fd,
      });
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
        setStatus("error");
        setErrorMessage(userFacingSttError(errRaw || "STT_PROVIDER_ERROR"));
        return null;
      }

      const text =
        payload &&
        typeof payload === "object" &&
        payload !== null &&
        "text" in payload &&
        typeof (payload as { text: unknown }).text === "string"
          ? (payload as { text: string }).text.trim()
          : "";

      if (!text) {
        setStatus("error");
        setErrorMessage(userFacingSttError("Invalid transcription response"));
        return null;
      }

      setTranscript(text);
      setStatus("done");
      return text;
    } catch {
      setStatus("error");
      setErrorMessage(userFacingSttError("Failed to transcribe audio"));
      return null;
    } finally {
      transcribeInFlightRef.current = false;
    }
  }, [language, model, stopBlobOnly]);

  const stopAndTranscribeRef = useRef(stopAndTranscribe);
  stopAndTranscribeRef.current = stopAndTranscribe;

  const startRecording = useCallback(async () => {
    if (startingRef.current || sessionRef.current != null) {
      return;
    }
    cancelledRef.current = false;
    startingRef.current = true;
    setErrorMessage(null);
    setTranscript(null);
    setSoftLimitMessage(null);
    softWarnedRef.current = false;
    hardStopRef.current = false;
    setElapsedMs(0);
    setStatus("idle");

    try {
      const session = await startBlobRecording();
      if (cancelledRef.current) {
        await session.stop().catch(() => {});
        return;
      }
      sessionRef.current = session;
      setStatus("recording");
      startTimeRef.current = Date.now();
      lastLevelUiMsRef.current = performance.now();

      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedMs(elapsed);

        if (!softWarnedRef.current && elapsed >= BATCH_SOFT_LIMIT_MS) {
          softWarnedRef.current = true;
          setSoftLimitMessage("녹음 가능 시간이 5분 남았습니다.");
        }

        if (!hardStopRef.current && elapsed >= BATCH_HARD_LIMIT_MS) {
          hardStopRef.current = true;
          autoHardRef.current = true;
          void stopAndTranscribeRef.current();
        }
      }, 100);

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
  }, []);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      clearTimers();
      const s = sessionRef.current;
      sessionRef.current = null;
      if (s) {
        void s.stop().catch(() => {});
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
    startRecording,
    stopAndTranscribe,
  };
}
