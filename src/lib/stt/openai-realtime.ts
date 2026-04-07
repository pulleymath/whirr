import type { TranscriptionProvider } from "./types";

/** Realtime transcription 전용 transcribe 모델 ID */
export const OPENAI_REALTIME_TRANSCRIBE_MODEL =
  "gpt-4o-mini-transcribe-2025-12-15" as const;

const REALTIME_WS_URL = "wss://api.openai.com/v1/realtime?intent=transcription";

const DEFAULT_STOP_FLUSH_MS = 4_000;

/**
 * `server_vad`가 켜진 transcription 세션에서는 서버가 버퍼를 자동 커밋하므로 클라이언트는
 * 클라이언트는 `input_audio_buffer.commit`을 보내지 않는다(VAD가 이미 비운 버퍼에 commit하면 오류).
 * @see https://developers.openai.com/api/docs/guides/realtime-transcription#voice-activity-detection
 *
 * 녹음 종료 시 마지막 발화를 VAD가 끝맺도록, 세션 `silence_duration_ms`(500)보다 긴 무음을 한 번 붙인다.
 */
const VAD_TAIL_SILENCE_MS = 600;
const VAD_TAIL_PCM24K_BYTES = (24_000 * 2 * VAD_TAIL_SILENCE_MS) / 1000;

function messageType(msg: Record<string, unknown>): string {
  const t = msg.type;
  return typeof t === "string" ? t : "";
}

function parseWsJsonText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim().replace(/^\uFEFF/, "");
  if (trimmed.length === 0) {
    return null;
  }
  try {
    const v = JSON.parse(trimmed) as unknown;
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function parseWsMessageData(
  data: unknown,
): Promise<Record<string, unknown> | null> {
  if (typeof data === "string") {
    return parseWsJsonText(data);
  }
  if (data instanceof ArrayBuffer) {
    return parseWsJsonText(new TextDecoder().decode(data));
  }
  if (ArrayBuffer.isView(data)) {
    return parseWsJsonText(new TextDecoder().decode(data as ArrayBufferView));
  }
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return parseWsJsonText(await data.text());
  }
  return null;
}

/**
 * 마이크 파이프라인은 16kHz mono s16le. OpenAI `pcm16`은 24kHz mono s16le.
 * @see https://developers.openai.com/api/reference/resources/realtime
 */
export function resamplePcmS16Mono16kTo24k(input: ArrayBuffer): ArrayBuffer {
  const in16 = new Int16Array(input);
  if (in16.length === 0) {
    return new ArrayBuffer(0);
  }
  const outLen = Math.ceil((in16.length * 24_000) / 16_000);
  const out = new Int16Array(outLen);
  for (let j = 0; j < outLen; j++) {
    const srcPos = (j * 16_000) / 24_000;
    const i0 = Math.floor(srcPos);
    const frac = srcPos - i0;
    const s0 = i0 < in16.length ? in16[i0]! : 0;
    const s1 = i0 + 1 < in16.length ? in16[i0 + 1]! : s0;
    out[j] = Math.round(s0 * (1 - frac) + s1 * frac);
  }
  return out.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * GA Realtime: `POST /v1/realtime/client_secrets`의 `session`과
 * WebSocket `session.update`의 `session`에 동일 객체를 쓴다.
 * @see https://developers.openai.com/api/reference/resources/realtime
 */
export function openAiGaTranscriptionSession(): Record<string, unknown> {
  return {
    type: "transcription",
    audio: {
      input: {
        format: {
          type: "audio/pcm",
          rate: 24_000,
        },
        noise_reduction: {
          type: "near_field",
        },
        transcription: {
          model: OPENAI_REALTIME_TRANSCRIBE_MODEL,
          language: "ko",
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      },
    },
  };
}

function buildSessionUpdatePayload(): Record<string, unknown> {
  return {
    type: "session.update",
    session: openAiGaTranscriptionSession(),
  };
}

function transcriptionDeltaText(msg: Record<string, unknown>): string {
  const d = msg.delta;
  return typeof d === "string" ? d : "";
}

function transcriptionCompletedText(msg: Record<string, unknown>): string {
  const t = msg.transcript;
  return typeof t === "string" ? t : "";
}

function errorMessageFromServerEvent(msg: Record<string, unknown>): string {
  const err = msg.error;
  if (err && typeof err === "object" && err !== null) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0) {
      return m;
    }
  }
  const m = msg.message;
  if (typeof m === "string" && m.length > 0) {
    return m;
  }
  return "STT_PROVIDER_ERROR";
}

export type OpenAIRealtimeProviderOptions = {
  /** 테스트용. 기본 4000ms */
  stopFlushMs?: number;
};

export class OpenAIRealtimeProvider implements TranscriptionProvider {
  private ws: WebSocket | null = null;
  private readonly pendingJson: string[] = [];
  private stopResolver: (() => void) | null = null;
  private stopTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private static readonly MAX_PENDING = 256;
  private readonly stopFlushMs: number;
  /** 24kHz mono s16le 기준으로 append된 누적 바이트(테스트·디버깅용). */
  private sentPcm24kBytes = 0;

  constructor(
    private readonly token: string,
    private readonly WebSocketImpl: typeof WebSocket = WebSocket,
    options?: OpenAIRealtimeProviderOptions,
  ) {
    this.stopFlushMs = options?.stopFlushMs ?? DEFAULT_STOP_FLUSH_MS;
  }

  connect(
    onPartial: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.disconnect();
      const subprotocols = [
        "realtime",
        `openai-insecure-api-key.${this.token}`,
      ];
      const ws = new this.WebSocketImpl(REALTIME_WS_URL, subprotocols);
      this.ws = ws;

      ws.onopen = () => {
        this.sendJson(buildSessionUpdatePayload());
        this.flushPendingJson();
        resolve();
      };

      ws.onerror = () => {
        const err = new Error("WebSocket connection failed");
        onError(err);
        reject(err);
      };

      ws.onmessage = (event) => {
        void this.handleIncomingMessage(
          event,
          onPartial,
          onFinal,
          onError,
        ).catch((e) => {
          const err = e instanceof Error ? e : new Error(String(e));
          onError(err);
        });
      };

      ws.onclose = () => {
        this.clearStopTimeout();
        if (this.stopResolver) {
          const r = this.stopResolver;
          this.stopResolver = null;
          r();
        }
      };
    });
  }

  private async handleIncomingMessage(
    event: MessageEvent,
    onPartial: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (error: Error) => void,
  ) {
    const msg = await parseWsMessageData(event.data);
    if (!msg) {
      return;
    }

    const typ = messageType(msg);

    if (typ === "error") {
      onError(new Error(errorMessageFromServerEvent(msg)));
      return;
    }

    if (typ === "conversation.item.input_audio_transcription.delta") {
      const text = transcriptionDeltaText(msg);
      if (text.length > 0) {
        onPartial(text);
      }
      return;
    }

    if (typ === "conversation.item.input_audio_transcription.completed") {
      const text = transcriptionCompletedText(msg);
      if (text.length > 0) {
        onFinal(text);
      }
      return;
    }
  }

  private clearStopTimeout() {
    if (this.stopTimeoutId != null) {
      clearTimeout(this.stopTimeoutId);
      this.stopTimeoutId = null;
    }
  }

  private sendJson(obj: Record<string, unknown>) {
    const ws = this.ws;
    const line = JSON.stringify(obj);
    if (!ws || ws.readyState !== this.WebSocketImpl.OPEN) {
      while (this.pendingJson.length >= OpenAIRealtimeProvider.MAX_PENDING) {
        this.pendingJson.shift();
      }
      this.pendingJson.push(line);
      return;
    }
    ws.send(line);
  }

  private flushPendingJson() {
    const ws = this.ws;
    if (!ws || ws.readyState !== this.WebSocketImpl.OPEN) {
      return;
    }
    for (const line of this.pendingJson) {
      ws.send(line);
    }
    this.pendingJson.length = 0;
  }

  /** 이미 24kHz mono s16le인 무음 구간을 append한다(commit 최소 길이 맞출 때 사용). */
  private appendSilentPcm24k(byteLength: number): void {
    if (byteLength <= 0) {
      return;
    }
    const sampleBytes = byteLength - (byteLength % 2);
    if (sampleBytes <= 0) {
      return;
    }
    const silence = new Int16Array(sampleBytes / 2);
    this.sentPcm24kBytes += silence.byteLength;
    this.sendJson({
      type: "input_audio_buffer.append",
      audio: arrayBufferToBase64(silence.buffer),
    });
  }

  sendAudio(pcmData: ArrayBuffer): void {
    const pcm24k = resamplePcmS16Mono16kTo24k(pcmData.slice(0));
    if (pcm24k.byteLength === 0) {
      return;
    }
    this.sentPcm24kBytes += pcm24k.byteLength;
    const audioB64 = arrayBufferToBase64(pcm24k);
    this.sendJson({
      type: "input_audio_buffer.append",
      audio: audioB64,
    });
  }

  stop(): Promise<void> {
    const ws = this.ws;
    if (!ws || ws.readyState !== this.WebSocketImpl.OPEN) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.clearStopTimeout();
      this.stopResolver = resolve;
      this.appendSilentPcm24k(VAD_TAIL_PCM24K_BYTES);
      this.stopTimeoutId = setTimeout(() => {
        this.stopTimeoutId = null;
        if (this.stopResolver === resolve) {
          this.stopResolver = null;
          try {
            ws.close();
          } catch {
            /* ignore */
          }
          resolve();
        }
      }, this.stopFlushMs);
    });
  }

  disconnect(): void {
    this.clearStopTimeout();
    this.stopResolver = null;
    this.pendingJson.length = 0;
    this.sentPcm24kBytes = 0;
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
}
