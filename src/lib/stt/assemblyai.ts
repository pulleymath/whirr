import type { TranscriptionProvider } from "./types";

const WS_BASE = "wss://api.assemblyai.com/v2/realtime/ws";

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}

function parseWsMessage(data: unknown): Record<string, unknown> | null {
  if (typeof data !== "string") {
    return null;
  }
  try {
    const v = JSON.parse(data) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export class AssemblyAIRealtimeProvider implements TranscriptionProvider {
  private ws: WebSocket | null = null;
  private readonly pendingAudio: string[] = [];
  private stopResolver: (() => void) | null = null;
  private stopTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private static readonly STOP_TIMEOUT_MS = 15_000;

  constructor(
    private readonly token: string,
    private readonly WebSocketImpl: typeof WebSocket = WebSocket,
  ) {}

  connect(
    onPartial: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.disconnect();
      const url = `${WS_BASE}?token=${encodeURIComponent(this.token)}`;
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
    const msg = parseWsMessage(event.data);
    if (!msg) {
      onError(new Error("Invalid WebSocket message"));
      return;
    }

    if (typeof msg.error === "string" && msg.error.length > 0) {
      onError(new Error(msg.error));
      return;
    }

    const type = msg.message_type;
    if (type === "PartialTranscript" && typeof msg.text === "string") {
      onPartial(msg.text);
      return;
    }
    if (type === "FinalTranscript" && typeof msg.text === "string") {
      onFinal(msg.text);
      return;
    }
    if (type === "SessionTerminated") {
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
    const payload = JSON.stringify({
      audio_data: arrayBufferToBase64(pcmData),
    });
    const ws = this.ws;
    if (!ws) {
      return;
    }
    if (ws.readyState === this.WebSocketImpl.OPEN) {
      ws.send(payload);
    } else if (ws.readyState === this.WebSocketImpl.CONNECTING) {
      this.pendingAudio.push(payload);
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
      ws.send(JSON.stringify({ terminate_session: true }));
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
