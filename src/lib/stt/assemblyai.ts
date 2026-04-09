import type { TranscriptionProvider } from "./types";

function messageTypeLower(msg: Record<string, unknown>): string {
  const t = msg.type;
  return typeof t === "string" ? t.toLowerCase() : "";
}

/** Universal Streaming v3 — 브라우저 번들에 주입(선택). EU 등은 `wss://streaming.eu.assemblyai.com` */
const DEFAULT_WS_ORIGIN = "wss://streaming.assemblyai.com";

/**
 * 기본 스트리밍 모델.
 * `universal-streaming-multilingual`은 공식 문서상 영·스·프·독·이·포 6개 언어만 지원(한국어 미포함).
 * @see https://www.assemblyai.com/docs/streaming/universal-streaming/multilingual-transcription
 * 한국어 등 99+ 언어는 Whisper streaming(`whisper-rt`) 사용. `language` 쿼리는 whisper-rt에서 지원하지 않음(자동 감지).
 * @see https://www.assemblyai.com/docs/streaming/whisper-streaming
 * @see https://www.assemblyai.com/docs/api-reference/streaming-api/universal-streaming/universal-streaming
 */
const DEFAULT_SPEECH_MODEL = "whisper-rt";

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

/** Turn에 `language_code` 등 메타를 붙일지(문서: multilingual·whisper-rt 모두 지원) */
function resolveStreamingLanguageDetection(): boolean {
  if (typeof process !== "undefined") {
    const v =
      process.env.NEXT_PUBLIC_ASSEMBLYAI_STREAMING_LANGUAGE_DETECTION?.trim().toLowerCase();
    if (v === "true" || v === "1") {
      return true;
    }
  }
  return false;
}

function buildV3WsUrl(
  token: string,
  opts: AssemblyAIStreamingOptions | undefined
): string {
  const origin = resolveWsOrigin(opts?.wsOrigin);
  const speechModel = resolveSpeechModel(opts?.speechModel);
  const sampleRate = opts?.sampleRate ?? 16_000;
  const u = new URL("/v3/ws", origin);
  u.searchParams.set("token", token);
  u.searchParams.set("sample_rate", String(sampleRate));
  u.searchParams.set("encoding", "pcm_s16le");
  u.searchParams.set("format_turns", "true");
  u.searchParams.set("speech_model", speechModel);
  if (resolveStreamingLanguageDetection()) {
    u.searchParams.set("language_detection", "true");
    u.searchParams.set("language_code", "ko");
  }
  return u.toString();
}

function wordsToCaption(words: unknown): string {
  if (!Array.isArray(words)) {
    return "";
  }
  const parts: string[] = [];
  for (const w of words) {
    if (w && typeof w === "object" && "text" in w) {
      const t = (w as { text: unknown }).text;
      if (typeof t === "string" && t.length > 0) {
        parts.push(t);
      }
    }
  }
  return parts.join(" ");
}

/**
 * 부분 턴: transcript·utterance 중 더 긴 쪽을 쓰면 utterance만 먼저 채워지는 구간에서도
 * 화면에 최신 구문이 보인다. 둘 다 비면 words에서 조합.
 */
function captionFromPartialTurn(msg: Record<string, unknown>): string {
  const transcript = typeof msg.transcript === "string" ? msg.transcript : "";
  const utterance = typeof msg.utterance === "string" ? msg.utterance : "";
  if (transcript.length > 0 || utterance.length > 0) {
    return utterance.length > transcript.length ? utterance : transcript;
  }
  return wordsToCaption(msg.words);
}

/** 턴 종료: 문서 권장대로 transcript 우선, 없으면 utterance·words */
function captionFromFinalTurn(msg: Record<string, unknown>): string {
  const transcript = typeof msg.transcript === "string" ? msg.transcript : "";
  if (transcript.length > 0) {
    return transcript;
  }
  const utterance = typeof msg.utterance === "string" ? msg.utterance : "";
  if (utterance.length > 0) {
    return utterance;
  }
  return wordsToCaption(msg.words);
}

function parseWsJsonText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim().replace(/^\uFEFF/, "");
  if (trimmed.length === 0) {
    return null;
  }
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const v = JSON.parse(s) as unknown;
      return v && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(trimmed);
  if (direct) {
    return direct;
  }
  const firstLine = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (firstLine && firstLine !== trimmed) {
    return tryParse(firstLine);
  }
  return null;
}

async function parseWsMessageData(
  data: unknown
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
    private readonly streamingOptions?: AssemblyAIStreamingOptions
  ) {}

  connect(
    onPartial: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (error: Error) => void
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
        void this.handleIncomingMessage(
          event,
          onPartial,
          onFinal,
          onError
        ).catch((err) => {
          const e = err instanceof Error ? err : new Error(String(err));
          console.error("[assemblyai] onmessage handler failed", e);
          onError(e);
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
    onError: (error: Error) => void
  ) {
    try {
      const msg = await parseWsMessageData(event.data);
      if (!msg) {
        return;
      }

      const typeKey = messageTypeLower(msg);
      if (typeKey === "error") {
        onError(new Error("STT_PROVIDER_ERROR"));
        return;
      }

      if (typeof msg.error === "string" && msg.error.length > 0) {
        onError(new Error("STT_PROVIDER_ERROR"));
        return;
      }

      if (typeKey === "begin") {
        return;
      }

      if (typeKey === "turn") {
        const endOfTurn = msg.end_of_turn === true;
        const text = endOfTurn
          ? captionFromFinalTurn(msg)
          : captionFromPartialTurn(msg);
        if (endOfTurn) {
          if (text.length > 0) {
            onFinal(text);
          }
          return;
        }
        onPartial(text);
        return;
      }

      if (typeKey === "termination") {
        this.clearStopTimeout();
        if (this.stopResolver) {
          const r = this.stopResolver;
          this.stopResolver = null;
          r();
        }
        this.ws?.close();
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error("[assemblyai] handleIncomingMessage", e);
      onError(e);
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
