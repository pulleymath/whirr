import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AssemblyAIRealtimeProvider,
  type AssemblyAIStreamingOptions,
} from "../assemblyai";

type WsListener = (ev: { data: string | Uint8Array }) => void;

const testWsOpts: AssemblyAIStreamingOptions = {
  wsOrigin: "wss://streaming.assemblyai.com",
  speechModel: "universal-streaming-multilingual",
  sampleRate: 16_000,
};

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState: number;
  onopen: (() => void) | null = null;
  onmessage: WsListener | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: Array<string | ArrayBuffer> = [];
  closed = false;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    MockWebSocket.instances.push(this);
  }

  send(data: string | ArrayBuffer) {
    this.sent.push(data);
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

  simulateMessageAsUint8Array(obj: object) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    this.onmessage?.({ data: new Uint8Array(bytes) });
  }

  /** 비동기 onmessage 핸들러(assemblyai.ts) 이후 단언용 */
  async simulateMessageAsync(obj: object) {
    this.simulateMessage(obj);
    await Promise.resolve();
    await Promise.resolve();
  }
}

async function openAndConnect(
  p: AssemblyAIRealtimeProvider,
  onPartial = vi.fn(),
  onFinal = vi.fn(),
  onError = vi.fn()
) {
  const connectPromise = p.connect(onPartial, onFinal, onError);
  const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1]!;
  ws.simulateOpen();
  await connectPromise;
  return ws;
}

describe("AssemblyAIRealtimeProvider (Streaming v3)", () => {
  const OriginalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
  });

  it("connect 시 v3 WS URL에 token·sample_rate·speech_model이 포함된다", async () => {
    const p = new AssemblyAIRealtimeProvider(
      "tok-abc",
      MockWebSocket as unknown as typeof WebSocket,
      testWsOpts
    );
    const connectPromise = p.connect(vi.fn(), vi.fn(), vi.fn());
    const ws = MockWebSocket.instances[0]!;
    const u = new URL(ws.url);
    expect(u.origin.replace(/^http/, "ws")).toBe(
      "wss://streaming.assemblyai.com"
    );
    expect(u.pathname).toBe("/v3/ws");
    expect(u.searchParams.get("token")).toBe("tok-abc");
    expect(u.searchParams.get("sample_rate")).toBe("16000");
    expect(u.searchParams.get("encoding")).toBe("pcm_s16le");
    expect(u.searchParams.get("format_turns")).toBe("true");
    expect(u.searchParams.get("speech_model")).toBe(
      "universal-streaming-multilingual"
    );
    ws.simulateOpen();
    await connectPromise;
  });

  it("streaming 옵션 생략 시 기본 speech_model은 whisper-rt이다", async () => {
    const p = new AssemblyAIRealtimeProvider(
      "tok-abc",
      MockWebSocket as unknown as typeof WebSocket
    );
    const connectPromise = p.connect(vi.fn(), vi.fn(), vi.fn());
    const ws = MockWebSocket.instances[0]!;
    expect(new URL(ws.url).searchParams.get("speech_model")).toBe("whisper-rt");
    ws.simulateOpen();
    await connectPromise;
  });

  it("NEXT_PUBLIC_ASSEMBLYAI_STREAMING_LANGUAGE_DETECTION=true이면 language_detection 쿼리를 넣는다", async () => {
    vi.stubEnv("NEXT_PUBLIC_ASSEMBLYAI_STREAMING_LANGUAGE_DETECTION", "true");
    try {
      const p = new AssemblyAIRealtimeProvider(
        "t",
        MockWebSocket as unknown as typeof WebSocket
      );
      const connectPromise = p.connect(vi.fn(), vi.fn(), vi.fn());
      const ws = MockWebSocket.instances[0]!;
      expect(new URL(ws.url).searchParams.get("language_detection")).toBe(
        "true"
      );
      ws.simulateOpen();
      await connectPromise;
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("open 후 sendAudio가 PCM 바이너리(ArrayBuffer)를 전송한다", async () => {
    const p = new AssemblyAIRealtimeProvider(
      "t",
      MockWebSocket as unknown as typeof WebSocket,
      testWsOpts
    );
    const ws = await openAndConnect(p);

    const buf = new Uint8Array([1, 2, 3]).buffer;
    p.sendAudio(buf);
    expect(ws.sent).toHaveLength(1);
    const chunk = ws.sent[0];
    expect(chunk).toBeInstanceOf(ArrayBuffer);
    expect(
      Buffer.from(chunk as ArrayBuffer).equals(Buffer.from([1, 2, 3]))
    ).toBe(true);
  });

  it("Turn 메시지가 Uint8Array로 오면 onPartial을 호출한다", async () => {
    const p = new AssemblyAIRealtimeProvider(
      "t",
      MockWebSocket as unknown as typeof WebSocket,
      testWsOpts
    );
    const onPartial = vi.fn();
    const ws = await openAndConnect(p, onPartial, vi.fn(), vi.fn());

    ws.simulateMessageAsUint8Array({
      type: "Turn",
      end_of_turn: false,
      transcript: "from-bytes",
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(onPartial).toHaveBeenCalledWith("from-bytes");
  });

  it("Turn(end_of_turn false)이면 transcript로 onPartial을 호출한다", async () => {
    const p = new AssemblyAIRealtimeProvider(
      "t",
      MockWebSocket as unknown as typeof WebSocket,
      testWsOpts
    );
    const onPartial = vi.fn();
    const ws = await openAndConnect(p, onPartial, vi.fn(), vi.fn());

    await ws.simulateMessageAsync({
      type: "Turn",
      end_of_turn: false,
      transcript: "hello",
    });
    expect(onPartial).toHaveBeenCalledWith("hello");
  });

  it("Turn(end_of_turn true)이면 onFinal을 호출한다", async () => {
    const p = new AssemblyAIRealtimeProvider(
      "t",
      MockWebSocket as unknown as typeof WebSocket,
      testWsOpts
    );
    const onFinal = vi.fn();
    const ws = await openAndConnect(p, vi.fn(), onFinal, vi.fn());

    await ws.simulateMessageAsync({
      type: "Turn",
      end_of_turn: true,
      transcript: "done.",
    });
    expect(onFinal).toHaveBeenCalledWith("done.");
  });

  it("부분 Turn에서 utterance가 transcript보다 길면 utterance를 onPartial에 쓴다", async () => {
    const p = new AssemblyAIRealtimeProvider(
      "t",
      MockWebSocket as unknown as typeof WebSocket,
      testWsOpts
    );
    const onPartial = vi.fn();
    const ws = await openAndConnect(p, onPartial, vi.fn(), vi.fn());

    await ws.simulateMessageAsync({
      type: "Turn",
      end_of_turn: false,
      transcript: "I am a voice",
      utterance: "I am a voice agent.",
    });
    expect(onPartial).toHaveBeenCalledWith("I am a voice agent.");
  });

  it("Turn에 transcript가 비어 있고 words만 있으면 words로 onPartial을 호출한다", async () => {
    const p = new AssemblyAIRealtimeProvider(
      "t",
      MockWebSocket as unknown as typeof WebSocket,
      testWsOpts
    );
    const onPartial = vi.fn();
    const ws = await openAndConnect(p, onPartial, vi.fn(), vi.fn());

    await ws.simulateMessageAsync({
      type: "Turn",
      end_of_turn: false,
      transcript: "",
      words: [{ start: 0, end: 80, text: "Hi", confidence: 0.9 }],
    });
    expect(onPartial).toHaveBeenCalledWith("Hi");
  });

  it("파싱 불가 메시지는 무시하고 onError를 호출하지 않는다", async () => {
    const p = new AssemblyAIRealtimeProvider(
      "t",
      MockWebSocket as unknown as typeof WebSocket,
      testWsOpts
    );
    const onError = vi.fn();
    const ws = await openAndConnect(p, vi.fn(), vi.fn(), onError);

    ws.onmessage?.({ data: "not-json{" });
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).not.toHaveBeenCalled();
  });

  it("stop이 Terminate JSON을 전송한다", async () => {
    const p = new AssemblyAIRealtimeProvider(
      "t",
      MockWebSocket as unknown as typeof WebSocket,
      testWsOpts
    );
    const ws = await openAndConnect(p);

    const stopPromise = p.stop();
    expect(
      ws.sent.some(
        (s) => typeof s === "string" && s.includes('"type":"Terminate"')
      )
    ).toBe(true);
    await ws.simulateMessageAsync({
      type: "Termination",
      audio_duration_seconds: 1,
      session_duration_seconds: 1,
    });
    await stopPromise;
  });

  it("disconnect가 소켓을 닫는다", async () => {
    const p = new AssemblyAIRealtimeProvider(
      "t",
      MockWebSocket as unknown as typeof WebSocket,
      testWsOpts
    );
    const ws = await openAndConnect(p);
    p.disconnect();
    expect(ws.closed).toBe(true);
  });

  it("서버 error 필드는 STT_PROVIDER_ERROR로 onError를 호출한다", async () => {
    const p = new AssemblyAIRealtimeProvider(
      "t",
      MockWebSocket as unknown as typeof WebSocket,
      testWsOpts
    );
    const onError = vi.fn();
    const ws = await openAndConnect(p, vi.fn(), vi.fn(), onError);

    await ws.simulateMessageAsync({
      error: "internal detail from upstream",
    });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "STT_PROVIDER_ERROR" })
    );
  });

  it("type Error면 STT_PROVIDER_ERROR로 onError를 호출한다", async () => {
    const p = new AssemblyAIRealtimeProvider(
      "t",
      MockWebSocket as unknown as typeof WebSocket,
      testWsOpts
    );
    const onError = vi.fn();
    const ws = await openAndConnect(p, vi.fn(), vi.fn(), onError);

    await ws.simulateMessageAsync({ type: "Error", error: "x" });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "STT_PROVIDER_ERROR" })
    );
  });

  it("클라이언트가 stop()을 호출하지 않아도 서버 Termination이 오면 소켓을 닫는다", async () => {
    const p = new AssemblyAIRealtimeProvider(
      "t",
      MockWebSocket as unknown as typeof WebSocket,
      testWsOpts
    );
    const ws = await openAndConnect(p);

    await ws.simulateMessageAsync({
      type: "Termination",
      audio_duration_seconds: 0,
      session_duration_seconds: 0,
    });
    expect(ws.closed).toBe(true);
  });
});
