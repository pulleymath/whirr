"use client";

import {
  createOpenAiRealtimeProvider,
  type TranscriptionProvider,
} from "@/lib/stt";
import {
  parseWebSpeechProviderError,
  userFacingSttError,
  userFacingWebSpeechErrorCode,
} from "@/lib/stt/user-facing-error";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type UseTranscriptionOptions = {
  fetchToken?: () => Promise<string>;
  createProvider?: (token: string) => TranscriptionProvider;
  /**
   * 토큰 없이 STT에 연결할 때. **현재 제품에서는 Web Speech API 전용**이며, Provider는 `Error.message`에 `WEB_SPEECH:` 접두 오류 코드를 올리는 것을 전제로 훅이 사용자 문구를 매핑한다.
   */
  tokenlessProvider?: () => TranscriptionProvider;
  /**
   * true면 AssemblyAI Universal Streaming용 50–1000ms PCM 프레이밍을 적용한다.
   * OpenAI Realtime(기본)은 passthrough로 청크를 그대로 보낸다.
   */
  useAssemblyAiPcmFraming?: boolean;
};

/**
 * AssemblyAI Universal Streaming 전용: 각 바이너리 프레임은 약 50–1000ms PCM.
 * 16 kHz · 모노 · s16le → 50ms = 1600 bytes, 1000ms = 32000 bytes.
 * OpenAI Realtime(기본)은 `useAssemblyAiPcmFraming` 없이 청크를 그대로 보낸다.
 * @see close code 3007 Input Duration Violation (AssemblyAI)
 */
const PCM_FRAME_MIN_BYTES = (16_000 * 2 * 50) / 1000;
const PCM_FRAME_MAX_BYTES = (16_000 * 2 * 1000) / 1000;

function concatUint8(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function copyFrameToArrayBuffer(frame: Uint8Array): ArrayBuffer {
  const out = new Uint8Array(frame.byteLength);
  out.set(frame);
  return out.buffer;
}

/** pending에서 조건을 만족하는 프레임만 잘라내어 send에 넘긴다. 남은 tail을 반환한다. */
function drainPcmFrames(
  pending: Uint8Array,
  send: (ab: ArrayBuffer) => void,
): Uint8Array {
  let p = pending;
  while (p.length >= PCM_FRAME_MIN_BYTES) {
    let take = Math.min(p.length, PCM_FRAME_MAX_BYTES);
    if (p.length - take > 0 && p.length - take < PCM_FRAME_MIN_BYTES) {
      take = p.length - PCM_FRAME_MIN_BYTES;
    }
    const frame = p.subarray(0, take);
    send(copyFrameToArrayBuffer(frame));
    p = p.subarray(take);
  }
  return p;
}

/** 연결 종료 전: 남은 PCM을 규격에 맞게 보낸다(부족하면 무음 패딩). */
function flushPcmTail(
  pending: Uint8Array,
  send: (ab: ArrayBuffer) => void,
): void {
  if (pending.length === 0) {
    return;
  }
  const rest = drainPcmFrames(pending, send);
  if (rest.length === 0) {
    return;
  }
  const padded = new Uint8Array(PCM_FRAME_MIN_BYTES);
  padded.set(rest, 0);
  send(padded.buffer);
}

async function defaultFetchToken(): Promise<string> {
  const res = await fetch("/api/stt/token", { method: "POST" });
  const body = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) {
    const msg =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : "Failed to get STT token";
    throw new Error(msg);
  }
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { token?: unknown }).token !== "string"
  ) {
    throw new Error("Invalid token response");
  }
  return (body as { token: string }).token;
}

export function useTranscription(options?: UseTranscriptionOptions) {
  const fetchToken = useMemo(
    () => options?.fetchToken ?? defaultFetchToken,
    [options?.fetchToken],
  );
  const createProvider = useMemo(
    () => options?.createProvider ?? createOpenAiRealtimeProvider,
    [options?.createProvider],
  );

  const useAssemblyAiPcmFraming = options?.useAssemblyAiPcmFraming === true;

  const [partial, setPartial] = useState("");
  const [finals, setFinals] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const providerRef = useRef<TranscriptionProvider | null>(null);
  const pcmChunkCountRef = useRef(0);
  const pcmPendingRef = useRef<Uint8Array>(new Uint8Array(0));

  const disconnectProvider = useCallback(() => {
    pcmPendingRef.current = new Uint8Array(0);
    providerRef.current?.disconnect();
    providerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      disconnectProvider();
    };
  }, [disconnectProvider]);

  const prepareStreaming = useCallback(async (): Promise<boolean> => {
    setErrorMessage(null);
    disconnectProvider();
    pcmChunkCountRef.current = 0;
    pcmPendingRef.current = new Uint8Array(0);

    const tokenless = options?.tokenlessProvider;
    if (tokenless) {
      try {
        const provider = tokenless();
        providerRef.current = provider;
        await provider.connect(
          (text) => setPartial(text),
          (text) => {
            setFinals((prev) => [...prev, text]);
            setPartial("");
          },
          (err) => {
            console.error("[transcription] provider error:", err);
            const code = parseWebSpeechProviderError(err.message);
            setErrorMessage(
              code !== null
                ? userFacingWebSpeechErrorCode(code)
                : userFacingSttError(err.message),
            );
            disconnectProvider();
          },
        );
        return true;
      } catch (e) {
        const raw = e instanceof Error ? e.message : "Unknown error";
        setErrorMessage(userFacingSttError(raw));
        disconnectProvider();
        return false;
      }
    }

    try {
      const token = await fetchToken();
      const provider = createProvider(token);
      providerRef.current = provider;
      await provider.connect(
        (text) => setPartial(text),
        (text) => {
          setFinals((prev) => [...prev, text]);
          setPartial("");
        },
        (err) => {
          console.error("[transcription] provider error:", err);
          setErrorMessage(userFacingSttError(err.message));
          disconnectProvider();
        },
      );
      return true;
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Unknown error";
      setErrorMessage(userFacingSttError(raw));
      disconnectProvider();
      return false;
    }
  }, [
    createProvider,
    disconnectProvider,
    fetchToken,
    options?.tokenlessProvider,
  ]);

  const sendPcm = useCallback(
    (buf: ArrayBuffer) => {
      const prov = providerRef.current;
      if (!prov) {
        return;
      }
      pcmChunkCountRef.current += 1;
      if (!useAssemblyAiPcmFraming) {
        prov.sendAudio(buf.slice(0));
        return;
      }
      const incoming = new Uint8Array(buf);
      const merged = concatUint8(pcmPendingRef.current, incoming);
      pcmPendingRef.current = drainPcmFrames(merged, (ab) => {
        prov.sendAudio(ab);
      });
    },
    [useAssemblyAiPcmFraming],
  );

  const finalizeStreaming = useCallback(async () => {
    const p = providerRef.current;
    if (p) {
      try {
        const tail = pcmPendingRef.current;
        pcmPendingRef.current = new Uint8Array(0);
        flushPcmTail(tail, (ab) => p.sendAudio(ab));
        await p.stop();
      } finally {
        p.disconnect();
        providerRef.current = null;
      }
    }
    setPartial("");
  }, []);

  return {
    partial,
    finals,
    errorMessage,
    prepareStreaming,
    sendPcm,
    finalizeStreaming,
  };
}
