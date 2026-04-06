"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createAssemblyAiRealtimeProvider,
  type TranscriptionProvider,
} from "@/lib/stt";
import { userFacingSttError } from "@/lib/stt/user-facing-error";

export type UseTranscriptionOptions = {
  fetchToken?: () => Promise<string>;
  createProvider?: (token: string) => TranscriptionProvider;
};

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
    () => options?.createProvider ?? createAssemblyAiRealtimeProvider,
    [options?.createProvider],
  );

  const [partial, setPartial] = useState("");
  const [finals, setFinals] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const providerRef = useRef<TranscriptionProvider | null>(null);

  const disconnectProvider = useCallback(() => {
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
  }, [createProvider, disconnectProvider, fetchToken]);

  const sendPcm = useCallback((buf: ArrayBuffer) => {
    providerRef.current?.sendAudio(buf);
  }, []);

  const finalizeStreaming = useCallback(async () => {
    const p = providerRef.current;
    if (p) {
      try {
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
