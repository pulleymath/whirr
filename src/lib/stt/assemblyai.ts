import type { TranscriptionProvider } from "./types";

/** Universal Streaming v3 — 브라우저 번들에 주입(선택). EU 등은 `wss://streaming.eu.assemblyai.com` */
const DEFAULT_WS_ORIGIN = "wss://streaming.assemblyai.com";

/** 16kHz 모노 PCM(Worklet)과 일치. 한국어 등 다국어는 multilingual 모델 권장 */
const DEFAULT_SPEECH_MODEL = "universal-streaming-multilingual";

export type AssemblyAIStreamingOptions = {
  /** 예: `wss://streaming.eu.assemblyai.com` */
  wsOrigin?: string;
  speechModel?: string;
  sampleRate?: number;
};

function resolveWsOrigin(override?: string): string {
  if (override) {
    return override.replace(/\/$/, "");
  }
  if (typeof process !== "undefined") {
    const o = process.env.NEXT_PUBLIC_ASSEMBLYAI_STREAMING_WS_ORIGIN?.trim();
    if (o) {
      return o.replace(/\/$/, "");
    }
  }
  return DEFAULT_WS_ORIGIN;
}

function resolveSpeechModel(override?: string): string {
  if (override) {
    return override;
  }
  if (typeof process !== "undefined") {
    const m = process.env.NEXT_PUBLIC_ASSEMBLYAI_SPEECH_MODEL?.trim();
    if (m) {
      return m;
    }
  }
  return DEFAULT_SPEECH_MODEL;
}

function buildV3WsUrl(
  token: string,
  opts: AssemblyAIStreamingOptions | undefined,
): string {
  const origin = resolveWsOrigin(opts?.wsOrigin);
  const speechModel = resolveSpeechModel(opts?.speechModel);
  const sampleRate = opts?.sampleRate ?? 16_000;
  const u = new URL("/v3/ws", origin);
  u.searchParams.set("token", token);
  u.searchParams.set("sample_rate", String(sampleRate));
  u.searchParams.set("format_turns", "true");
  u.searchParams.set("speech_model", speechModel);
  return u.toString();
}

function parseWsJsonMessage(data: unknown): Record<string, unknown> | null {
  let text: string | null = null;
  if (typeof data === "string") {
    text = data;
  } else if (data instanceof ArrayBuffer) {
    text = new TextDecoder().decode(data);
  }
  if (text == null) {
    return null;
  }
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export class AssemblyAIRealtimeProvider implements TranscriptionProvider {
  private ws: WebSocket | null = null;
  private readonly pendingAudio: ArrayBuffer[] = [];
  private stopResolver: (() => void) | null = null;
  private stopTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private static readonly STOP_TIMEOUT_MS = 15_000;
  private static readonly MAX_PENDING_AUDIO = 128;

  constructor(
    private readonly token: string,
    private readonly WebSocketImpl: typeof WebSocket = WebSocket,
    private readonly streamingOptions?: AssemblyAIStreamingOptions,
  ) {}

  connect(
    onPartial: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.disconnect();
      const url = buildV3WsUrl(this.token, this.streamingOptions);
      const ws = new this.WebSocketImpl(url);
      this.ws = ws;

      ws.onopen = () => {
        this.flushPendingAudio();
        resolve();
      };

      ws.onerror = () => {
        const err = new Error("WebSocket connection failed");
        onError(err);
        reject(err);
      };

      ws.onmessage = (event) => {
        this.handleIncomingMessage(event, onPartial, onFinal, onError);
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

  private handleIncomingMessage(
    event: MessageEvent,
    onPartial: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (error: Error) => void,
  ) {
    const msg = parseWsJsonMessage(event.data);
    if (!msg) {
      onError(new Error("Invalid WebSocket message"));
      return;
    }

    if (msg.type === "Error") {
      onError(new Error("STT_PROVIDER_ERROR"));
      return;
    }

    if (typeof msg.error === "string" && msg.error.length > 0) {
      onError(new Error("STT_PROVIDER_ERROR"));
      return;
    }

    const type = msg.type;
    if (type === "Begin") {
      return;
    }

    if (type === "Turn") {
      const transcript =
        typeof msg.transcript === "string" ? msg.transcript : "";
      const endOfTurn = msg.end_of_turn === true;
      if (endOfTurn) {
        if (transcript.length > 0) {
          onFinal(transcript);
        }
        return;
      }
      onPartial(transcript);
      return;
    }

    if (type === "Termination") {
      this.clearStopTimeout();
      if (this.stopResolver) {
        const r = this.stopResolver;
        this.stopResolver = null;
        r();
      }
      this.ws?.close();
    }
  }

  private clearStopTimeout() {
    if (this.stopTimeoutId != null) {
      clearTimeout(this.stopTimeoutId);
      this.stopTimeoutId = null;
    }
  }

  private flushPendingAudio() {
    const ws = this.ws;
    if (!ws || ws.readyState !== this.WebSocketImpl.OPEN) {
      return;
    }
    for (const payload of this.pendingAudio) {
      ws.send(payload);
    }
    this.pendingAudio.length = 0;
  }

  sendAudio(pcmData: ArrayBuffer): void {
    const copy = pcmData.slice(0);
    const ws = this.ws;
    if (!ws) {
      return;
    }
    if (ws.readyState === this.WebSocketImpl.OPEN) {
      ws.send(copy);
    } else if (ws.readyState === this.WebSocketImpl.CONNECTING) {
      while (
        this.pendingAudio.length >= AssemblyAIRealtimeProvider.MAX_PENDING_AUDIO
      ) {
        this.pendingAudio.shift();
      }
      this.pendingAudio.push(copy);
    }
  }

  stop(): Promise<void> {
    const ws = this.ws;
    if (!ws || ws.readyState !== this.WebSocketImpl.OPEN) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.clearStopTimeout();
      this.stopResolver = resolve;
      ws.send(JSON.stringify({ type: "Terminate" }));
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
      }, AssemblyAIRealtimeProvider.STOP_TIMEOUT_MS);
    });
  }

  disconnect(): void {
    this.clearStopTimeout();
    this.stopResolver = null;
    this.pendingAudio.length = 0;
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
