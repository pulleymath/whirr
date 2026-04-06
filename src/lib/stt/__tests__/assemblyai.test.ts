import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssemblyAIRealtimeProvider } from "../assemblyai";

type WsListener = (ev: { data: string }) => void;

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
  sent: string[] = [];
  closed = false;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
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
}

async function openAndConnect(
  p: AssemblyAIRealtimeProvider,
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

describe("AssemblyAIRealtimeProvider", () => {
  const OriginalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
  });

  it("connect 시 토큰이 URL 쿼리에 포함된 WebSocket을 연다", async () => {
    const p = new AssemblyAIRealtimeProvider("tok-abc");
    const connectPromise = p.connect(vi.fn(), vi.fn(), vi.fn());
    const ws = MockWebSocket.instances[0]!;
    expect(ws.url).toBe(
      "wss://api.assemblyai.com/v2/realtime/ws?token=tok-abc",
    );
    ws.simulateOpen();
    await connectPromise;
  });

  it("open 후 sendAudio가 base64 audio_data JSON을 전송한다", async () => {
    const p = new AssemblyAIRealtimeProvider("t");
    const ws = await openAndConnect(p);

    const buf = new Uint8Array([1, 2, 3]).buffer;
    p.sendAudio(buf);
    expect(ws.sent).toHaveLength(1);
    const payload = JSON.parse(ws.sent[0]!) as { audio_data: string };
    expect(payload.audio_data).toBe(Buffer.from([1, 2, 3]).toString("base64"));
  });

  it("PartialTranscript면 onPartial을 호출한다", async () => {
    const p = new AssemblyAIRealtimeProvider("t");
    const onPartial = vi.fn();
    const ws = await openAndConnect(p, onPartial, vi.fn(), vi.fn());

    ws.simulateMessage({
      message_type: "PartialTranscript",
      text: "hello",
    });
    expect(onPartial).toHaveBeenCalledWith("hello");
  });

  it("FinalTranscript면 onFinal을 호출한다", async () => {
    const p = new AssemblyAIRealtimeProvider("t");
    const onFinal = vi.fn();
    const ws = await openAndConnect(p, vi.fn(), onFinal, vi.fn());

    ws.simulateMessage({
      message_type: "FinalTranscript",
      text: "done.",
    });
    expect(onFinal).toHaveBeenCalledWith("done.");
  });

  it("stop이 terminate_session을 전송한다", async () => {
    const p = new AssemblyAIRealtimeProvider("t");
    const ws = await openAndConnect(p);

    const stopPromise = p.stop();
    expect(ws.sent.some((s) => s.includes('"terminate_session":true'))).toBe(
      true,
    );
    ws.simulateMessage({ message_type: "SessionTerminated" });
    await stopPromise;
  });

  it("disconnect가 소켓을 닫는다", async () => {
    const p = new AssemblyAIRealtimeProvider("t");
    const ws = await openAndConnect(p);
    p.disconnect();
    expect(ws.closed).toBe(true);
  });

  it("서버 error 필드는 STT_PROVIDER_ERROR로 onError를 호출한다", async () => {
    const p = new AssemblyAIRealtimeProvider("t");
    const onError = vi.fn();
    const ws = await openAndConnect(p, vi.fn(), vi.fn(), onError);

    ws.simulateMessage({ error: "internal detail from upstream" });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "STT_PROVIDER_ERROR" }),
    );
  });

  it("stop 없이 SessionTerminated만 오면 소켓을 닫는다", async () => {
    const p = new AssemblyAIRealtimeProvider("t");
    const ws = await openAndConnect(p);

    ws.simulateMessage({ message_type: "SessionTerminated" });
    expect(ws.closed).toBe(true);
  });
});
