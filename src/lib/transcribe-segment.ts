import { userFacingSttError } from "@/lib/stt/user-facing-error";

export function shouldRetryBatchTranscribeStatus(statusCode: number): boolean {
  if (statusCode === 0) {
    return true;
  }
  return statusCode >= 500;
}

export const BATCH_TRANSCRIBE_RETRY_BACKOFF_MS = [2000, 4000] as const;
export const BATCH_TRANSCRIBE_MAX_ATTEMPTS = 3;

export type TranscribeBlobOnceResult = {
  ok: boolean;
  text: string | null;
  errRaw: string;
  status: number;
};

export type TranscribeBlobOnceOptions = {
  model: string;
  language: string;
  signal?: AbortSignal;
};

export async function transcribeBlobOnce(
  blob: Blob,
  options: TranscribeBlobOnceOptions,
): Promise<TranscribeBlobOnceResult> {
  const { model, language, signal } = options;
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
      signal,
    });
    if (res.status === 401 || res.status === 403) {
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
    if (signal?.aborted) {
      return {
        ok: false,
        text: null,
        errRaw: "ABORTED",
        status: 0,
      };
    }
    return {
      ok: false,
      text: null,
      errRaw: "Failed to transcribe audio",
      status: 0,
    };
  }
}

export type TranscribeBlobWithRetriesResult =
  | { ok: true; text: string }
  | { ok: false; errRaw: string };

export async function transcribeBlobWithRetries(
  blob: Blob,
  options: TranscribeBlobOnceOptions,
): Promise<TranscribeBlobWithRetriesResult> {
  const { model, language, signal } = options;
  for (let attempt = 0; attempt < BATCH_TRANSCRIBE_MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) {
      return { ok: false, errRaw: "ABORTED" };
    }
    if (attempt > 0) {
      const delay =
        BATCH_TRANSCRIBE_RETRY_BACKOFF_MS[attempt - 1] ??
        BATCH_TRANSCRIBE_RETRY_BACKOFF_MS[
          BATCH_TRANSCRIBE_RETRY_BACKOFF_MS.length - 1
        ];
      await new Promise((r) => setTimeout(r, delay));
    }
    const result = await transcribeBlobOnce(blob, { model, language, signal });
    if (result.ok) {
      return { ok: true, text: result.text ?? "" };
    }
    if (result.errRaw === "ABORTED") {
      return { ok: false, errRaw: "ABORTED" };
    }
    const retry = shouldRetryBatchTranscribeStatus(result.status);
    if (!retry || attempt === BATCH_TRANSCRIBE_MAX_ATTEMPTS - 1) {
      return { ok: false, errRaw: result.errRaw };
    }
  }
  return { ok: false, errRaw: "STT_PROVIDER_ERROR" };
}

export function userFacingTranscribeError(errRaw: string): string {
  return userFacingSttError(errRaw);
}
