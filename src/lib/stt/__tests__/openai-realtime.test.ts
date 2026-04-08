import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OPENAI_REALTIME_TRANSCRIBE_MODEL,
  OPENAI_REALTIME_TRANSCRIPTION_LANGUAGE,
  OPENAI_REALTIME_TRANSCRIPTION_PROMPT,
  openAiGaTranscriptionSession,
  OpenAIRealtimeProvider,
  resamplePcmS16Mono16kTo24k,
} from "../openai-realtime";

type WsListener = (ev: { data: string }) => void;

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  requestedProtocols: string[];
  readyState: number;
  onopen: (() => void) | null = null;
  onmessage: WsListener | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  closed = false;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.requestedProtocols =
      protocols === undefined
        ? []
        : typeof protocols === "string"
          ? [protocols]
          : [...protocols];
    this.readyState = MockWebSocket.CONNECTING;
    MockWebSocket.instances.push(this);
  }

  send(data: string | ArrayBuffer) {
    if (typeof data === "string") {
      this.sent.push(data);
    }
  }

  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(obj: object) {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }

  async simulateMessageAsync(obj: object) {
    this.simulateMessage(obj);
    await Promise.resolve();
    await Promise.resolve();
  }
}

async function openAndConnect(
  p: OpenAIRealtimeProvider,
  onPartial = vi.fn(),
  onFinal = vi.fn(),
  onError = vi.fn(),
) {
  const connectPromise = p.connect(onPartial, onFinal, onError);
  const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1]!;
  ws.simulateOpen();
  await connectPromise;
  return ws;
}

describe("OpenAIRealtimeProvider", () => {
  const OriginalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
  });

  it("Realtime transcription WebSocket URL·서브프로토콜(에피메랄 키)을 사용한다", async () => {
    const p = new OpenAIRealtimeProvider(
      "ek_test",
      MockWebSocket as unknown as typeof WebSocket,
      { stopFlushMs: 10 },
    );
    await openAndConnect(p);
    const ws = MockWebSocket.instances[0]!;
    expect(ws.url).toBe(
      "wss://api.openai.com/v1/realtime?intent=transcription",
    );
    expect(ws.requestedProtocols).toEqual([
      "realtime",
      "openai-insecure-api-key.ek_test",
    ]);
  });

  it("연결 후 session.update에 GA transcription 세션을 보낸다", async () => {
    const p = new OpenAIRealtimeProvider(
      "tok",
      MockWebSocket as unknown as typeof WebSocket,
      { stopFlushMs: 10 },
    );
    const ws = await openAndConnect(p);
    const first = ws.sent[0];
    expect(first).toBeDefined();
    const msg = JSON.parse(first!) as {
      type: string;
      session: Record<string, unknown>;
    };
    expect(msg.type).toBe("session.update");
    expect(msg.session).toEqual(openAiGaTranscriptionSession());
    const tr = (msg.session.audio as { input: { transcription: unknown } })
      .input.transcription as Record<string, unknown>;
    expect(tr.model).toBe(OPENAI_REALTIME_TRANSCRIBE_MODEL);
    expect(tr.language).toBe(OPENAI_REALTIME_TRANSCRIPTION_LANGUAGE);
    expect(tr.prompt).toBe(OPENAI_REALTIME_TRANSCRIPTION_PROMPT);
  });

  it("error 이벤트 시 onError를 호출한다", async () => {
    const onError = vi.fn();
    const p = new OpenAIRealtimeProvider(
      "t",
      MockWebSocket as unknown as typeof WebSocket,
      { stopFlushMs: 10 },
    );
    const ws = await openAndConnect(p, vi.fn(), vi.fn(), onError);
    await ws.simulateMessageAsync({
      type: "error",
      error: { message: "upstream failed" },
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
    expect((onError.mock.calls[0]![0] as Error).message).toBe(
      "upstream failed",
    );
  });

  it("resamplePcmS16Mono16kTo24k는 16k 샘플 수에 맞춰 24k 길이를 만든다", () => {
    const in16 = new Int16Array(800);
    for (let i = 0; i < in16.length; i++) {
      in16[i] = i % 1000;
    }
    const out = resamplePcmS16Mono16kTo24k(in16.buffer);
    expect(out.byteLength).toBe(1200 * 2);
  });

  it("sendAudio는 24k PCM을 base64로 append한다", async () => {
    const p = new OpenAIRealtimeProvider(
      "t",
      MockWebSocket as unknown as typeof WebSocket,
      { stopFlushMs: 10 },
    );
    const ws = await openAndConnect(p);
    ws.sent.length = 0;
    const pcm16 = new Int16Array(800);
    pcm16.fill(1000);
    p.sendAudio(pcm16.buffer);
    const appendRaw = ws.sent.find((s) =>
      s.includes("input_audio_buffer.append"),
    );
    expect(appendRaw).toBeDefined();
    const body = JSON.parse(appendRaw!) as { type: string; audio: string };
    expect(body.type).toBe("input_audio_buffer.append");
    const decoded = Buffer.from(body.audio, "base64");
    expect(decoded.length).toBe(2400);
  });

  it("delta·completed 이벤트를 partial·final로 매핑한다", async () => {
    const onPartial = vi.fn();
    const onFinal = vi.fn();
    const p = new OpenAIRealtimeProvider(
      "t",
      MockWebSocket as unknown as typeof WebSocket,
      { stopFlushMs: 10 },
    );
    const ws = await openAndConnect(p, onPartial, onFinal, vi.fn());
    await ws.simulateMessageAsync({
      type: "conversation.item.input_audio_transcription.delta",
      delta: "안녕",
    });
    expect(onPartial).toHaveBeenCalledWith("안녕");
    await ws.simulateMessageAsync({
      type: "conversation.item.input_audio_transcription.completed",
      transcript: "안녕하세요",
    });
    expect(onFinal).toHaveBeenCalledWith("안녕하세요");
  });

  const VAD_TAIL_BYTES = (24_000 * 2 * 600) / 1000;

  it("stop은 server_vad용 tail 무음 append만 하고 commit은 보내지 않는다", async () => {
    vi.useFakeTimers();
    try {
      const p = new OpenAIRealtimeProvider(
        "t",
        MockWebSocket as unknown as typeof WebSocket,
        { stopFlushMs: 5 },
      );
      const ws = await openAndConnect(p);
      ws.sent.length = 0;
      const pcm16 = new Int16Array(1600);
      pcm16.fill(100);
      p.sendAudio(pcm16.buffer);
      const stopP = p.stop();
      const appends = ws.sent.filter((s) =>
        s.includes("input_audio_buffer.append"),
      );
      expect(appends.length).toBe(2);
      const tail = JSON.parse(appends[1]!) as { audio: string };
      expect(Buffer.from(tail.audio, "base64").length).toBe(VAD_TAIL_BYTES);
      expect(ws.sent.some((s) => s.includes("input_audio_buffer.commit"))).toBe(
        false,
      );
      await vi.advanceTimersByTimeAsync(20);
      await stopP;
    } finally {
      vi.useRealTimers();
    }
  });

  it("짧은 오디오만 있어도 동일한 tail 무음 후 commit 없이 종료한다", async () => {
    vi.useFakeTimers();
    try {
      const p = new OpenAIRealtimeProvider(
        "t",
        MockWebSocket as unknown as typeof WebSocket,
        { stopFlushMs: 5 },
      );
      const ws = await openAndConnect(p);
      ws.sent.length = 0;
      const pcm16 = new Int16Array(400);
      pcm16.fill(1);
      p.sendAudio(pcm16.buffer);
      const stopP = p.stop();
      const appends = ws.sent.filter((s) =>
        s.includes("input_audio_buffer.append"),
      );
      expect(appends.length).toBe(2);
      const pad = JSON.parse(appends[1]!) as { audio: string };
      expect(Buffer.from(pad.audio, "base64").length).toBe(VAD_TAIL_BYTES);
      expect(ws.sent.some((s) => s.includes("input_audio_buffer.commit"))).toBe(
        false,
      );
      await vi.advanceTimersByTimeAsync(20);
      await stopP;
    } finally {
      vi.useRealTimers();
    }
  });

  it("오디오가 없어도 tail 무음만 append하고 commit은 보내지 않는다", async () => {
    vi.useFakeTimers();
    try {
      const p = new OpenAIRealtimeProvider(
        "t",
        MockWebSocket as unknown as typeof WebSocket,
        { stopFlushMs: 5 },
      );
      const ws = await openAndConnect(p);
      ws.sent.length = 0;
      const stopP = p.stop();
      const appends = ws.sent.filter((s) =>
        s.includes("input_audio_buffer.append"),
      );
      expect(appends.length).toBe(1);
      const only = JSON.parse(appends[0]!) as { audio: string };
      expect(Buffer.from(only.audio, "base64").length).toBe(VAD_TAIL_BYTES);
      expect(ws.sent.some((s) => s.includes("input_audio_buffer.commit"))).toBe(
        false,
      );
      await vi.advanceTimersByTimeAsync(20);
      await stopP;
    } finally {
      vi.useRealTimers();
    }
  });
});
