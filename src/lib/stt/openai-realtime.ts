import type { TranscriptionProvider } from "./types";
import {
  SESSION_EXPIRED_OR_DISCONNECTED,
  SESSION_PROACTIVE_RENEW,
} from "./user-facing-error";

/** Realtime transcription 전용 transcribe 모델 ID */
export const OPENAI_REALTIME_TRANSCRIBE_MODEL = "gpt-4o-transcribe" as const;
// "gpt-4o-mini-transcribe-2025-12-15" as const;

/**
 * `language`는 ISO-639-1 하나만 지정 가능(다국어 화이트리스트 API 없음).
 * @see https://developers.openai.com/api/docs/guides/realtime-transcription#session-fields
 */
export const OPENAI_REALTIME_TRANSCRIPTION_LANGUAGE = "ko" as const;

/**
 * `transcription.prompt`는 시스템 지시문이 아니다. Whisper 계열과 같이
 * **기대 단어·고유명사·짧은 키워드 나열**로 쓰는 필드다.
 * 긴 지시문(예: “음성을 글로 옮기세요”, “하지 마세요”)은 모델이 출력에 그대로 섞거나 반복하는 경우가 있다.
 * 언어는 `language`로 고정하고, 여기엔 회의·IT 용어만 쉼표로 나열한다.
 * @see https://developers.openai.com/api/docs/guides/realtime-transcription#session-fields
 */
export const OPENAI_REALTIME_TRANSCRIPTION_PROMPT = "" as const;
// "회의록, 안건, 액션아이템, 의사결정, 팔로업, 스프린트, 백로그, 코드리뷰, Kubernetes, 서버리스, MSA, OKR, KPI, API" as const;

/**
 * Realtime transcription 세션·버퍼에 맞출 샘플레이트(Hz).
 * 워클릿은 16kHz를 내므로 Provider에서 여기로 리샘플한다.
 * `client_secrets`는 16kHz를 거부할 수 있어 24kHz를 사용한다.
 */
export const OPENAI_REALTIME_SESSION_PCM_RATE = 24_000 as const;

const REALTIME_WS_URL = "wss://api.openai.com/v1/realtime?intent=transcription";

const DEFAULT_STOP_FLUSH_MS = 4_000;

/** OpenAI Realtime 세션 60분 한도 전 선제 재연결(밀리초) */
export const OPENAI_PROACTIVE_RENEWAL_AFTER_MS = 55 * 60 * 1000;

/**
 * `server_vad`가 켜진 transcription 세션에서는 서버가 버퍼를 자동 커밋하므로 클라이언트는
 * `input_audio_buffer.commit`을 보내지 않는다(VAD가 이미 비운 버퍼에 commit하면 오류).
 * @see https://developers.openai.com/api/docs/guides/realtime-transcription#voice-activity-detection
 *
 * 녹음 종료 시 마지막 발화를 VAD가 끝맺도록, 세션 `silence_duration_ms`보다 긴 무음을 한 번 붙인다.
 */
const VAD_TAIL_SILENCE_MS = 700;
const VAD_TAIL_PCM_BYTES =
  (OPENAI_REALTIME_SESSION_PCM_RATE * 2 * VAD_TAIL_SILENCE_MS) / 1000;

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
 * 워클릿 16kHz mono s16le → Realtime API가 기대하는 24kHz mono s16le.
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
          rate: OPENAI_REALTIME_SESSION_PCM_RATE,
        },
        noise_reduction: {
          type: "near_field",
        },
        transcription: {
          model: OPENAI_REALTIME_TRANSCRIBE_MODEL,
          language: OPENAI_REALTIME_TRANSCRIPTION_LANGUAGE,
          prompt: OPENAI_REALTIME_TRANSCRIPTION_PROMPT,
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.6,
          prefix_padding_ms: 300,
          silence_duration_ms: 600,
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
  /**
   * 선제 세션 갱신 타이머. 기본 55분. `0`이면 비활성화(테스트용).
   */
  proactiveRenewalAfterMs?: number;
};

export class OpenAIRealtimeProvider implements TranscriptionProvider {
  private ws: WebSocket | null = null;
  private readonly pendingJson: string[] = [];
  private stopResolver: (() => void) | null = null;
  private stopTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private static readonly MAX_PENDING = 256;
  private readonly stopFlushMs: number;
  private readonly proactiveRenewalAfterMs: number;
  /** 세션 샘플레이트(24kHz) mono s16le 기준 append 누적 바이트(테스트·디버깅용). */
  private sentPcmBytes = 0;
  private userInitiatedClose = false;
  private suppressCloseError = false;
  private proactiveRenewPending = false;
  private proactiveRenewTimer: ReturnType<typeof setTimeout> | null = null;
  private lastOnError: ((error: Error) => void) | null = null;

  constructor(
    private readonly token: string,
    private readonly WebSocketImpl: typeof WebSocket = WebSocket,
    options?: OpenAIRealtimeProviderOptions,
  ) {
    this.stopFlushMs = options?.stopFlushMs ?? DEFAULT_STOP_FLUSH_MS;
    this.proactiveRenewalAfterMs =
      options?.proactiveRenewalAfterMs !== undefined
        ? options.proactiveRenewalAfterMs
        : OPENAI_PROACTIVE_RENEWAL_AFTER_MS;
  }

  private clearProactiveRenewalTimer(): void {
    if (this.proactiveRenewTimer != null) {
      clearTimeout(this.proactiveRenewTimer);
      this.proactiveRenewTimer = null;
    }
  }

  private scheduleProactiveRenewal(): void {
    this.clearProactiveRenewalTimer();
    if (this.proactiveRenewalAfterMs <= 0) {
      return;
    }
    this.proactiveRenewTimer = setTimeout(() => {
      this.proactiveRenewTimer = null;
      const ws = this.ws;
      if (!ws || ws.readyState !== this.WebSocketImpl.OPEN) {
        return;
      }
      this.proactiveRenewPending = true;
      void this.stop();
    }, this.proactiveRenewalAfterMs);
  }

  connect(
    onPartial: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.disconnect();
      this.userInitiatedClose = false;
      this.suppressCloseError = false;
      this.proactiveRenewPending = false;
      this.lastOnError = onError;
      const subprotocols = [
        "realtime",
        `openai-insecure-api-key.${this.token}`,
      ];
      const ws = new this.WebSocketImpl(REALTIME_WS_URL, subprotocols);
      this.ws = ws;

      ws.onopen = () => {
        this.sendJson(buildSessionUpdatePayload());
        this.flushPendingJson();
        this.scheduleProactiveRenewal();
        resolve();
      };

      ws.onerror = () => {
        this.suppressCloseError = true;
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
        if (this.proactiveRenewPending && this.lastOnError) {
          this.proactiveRenewPending = false;
          const notify = this.lastOnError;
          queueMicrotask(() => {
            notify(new Error(SESSION_PROACTIVE_RENEW));
          });
          this.suppressCloseError = false;
          return;
        }
        if (
          !this.userInitiatedClose &&
          !this.suppressCloseError &&
          this.lastOnError
        ) {
          this.lastOnError(new Error(SESSION_EXPIRED_OR_DISCONNECTED));
        }
        this.suppressCloseError = false;
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

  /** 세션 샘플레이트 mono s16le 무음을 append한다(VAD가 마지막 발화를 마무리하도록). */
  private appendSilentPcm(byteLength: number): void {
    if (byteLength <= 0) {
      return;
    }
    const sampleBytes = byteLength - (byteLength % 2);
    if (sampleBytes <= 0) {
      return;
    }
    const silence = new Int16Array(sampleBytes / 2);
    this.sentPcmBytes += silence.byteLength;
    this.sendJson({
      type: "input_audio_buffer.append",
      audio: arrayBufferToBase64(silence.buffer),
    });
  }

  sendAudio(pcmData: ArrayBuffer): void {
    const pcm = resamplePcmS16Mono16kTo24k(pcmData.slice(0));
    if (pcm.byteLength === 0) {
      return;
    }
    this.sentPcmBytes += pcm.byteLength;
    const audioB64 = arrayBufferToBase64(pcm);
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
      this.clearProactiveRenewalTimer();
      this.userInitiatedClose = true;
      this.clearStopTimeout();
      this.stopResolver = resolve;
      this.appendSilentPcm(VAD_TAIL_PCM_BYTES);
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
    this.userInitiatedClose = true;
    this.proactiveRenewPending = false;
    this.clearProactiveRenewalTimer();
    this.clearStopTimeout();
    this.stopResolver = null;
    this.pendingJson.length = 0;
    this.sentPcmBytes = 0;
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
