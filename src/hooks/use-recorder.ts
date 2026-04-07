"use client";

import {
  mapMediaErrorToMessage,
  startPcmRecording,
  type OnPcmChunk,
} from "@/lib/audio";
import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "recording" | "error";

export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const LEVEL_UI_MIN_INTERVAL_MS = 48;

export function useRecorder(onPcmChunk?: OnPcmChunk) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);

  const sessionRef = useRef<Awaited<
    ReturnType<typeof startPcmRecording>
  > | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const onPcmRef = useRef(onPcmChunk);
  const startingRef = useRef(false);
  const cancelledRef = useRef(false);
  const levelDataRef = useRef<Uint8Array | null>(null);
  const lastLevelUiMsRef = useRef(0);

  useEffect(() => {
    onPcmRef.current = onPcmChunk;
  }, [onPcmChunk]);

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

  const stop = useCallback(async () => {
    cancelledRef.current = true;
    clearTimers();
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) {
      await session.stop();
    }
    startingRef.current = false;
    setStatus("idle");
  }, [clearTimers]);

  const start = useCallback(async () => {
    if (startingRef.current || sessionRef.current != null) {
      return;
    }
    cancelledRef.current = false;
    startingRef.current = true;
    setErrorMessage(null);
    setElapsedMs(0);
    try {
      const session = await startPcmRecording((buf) => {
        if (!cancelledRef.current) {
          onPcmRef.current?.(buf);
        }
      });
      if (cancelledRef.current) {
        await session.stop();
        return;
      }
      sessionRef.current = session;
      setStatus("recording");
      startTimeRef.current = Date.now();
      lastLevelUiMsRef.current = performance.now();
      intervalRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 100);

      const tick = () => {
        if (cancelledRef.current) {
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
      void stop();
    };
  }, [stop]);

  return {
    status,
    errorMessage,
    elapsedMs,
    level,
    start,
    stop,
  };
}
