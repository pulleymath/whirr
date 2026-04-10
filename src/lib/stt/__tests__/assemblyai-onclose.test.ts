import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AssemblyAIRealtimeProvider,
  type AssemblyAIStreamingOptions,
} from "../assemblyai";
import { SESSION_EXPIRED_OR_DISCONNECTED } from "../user-facing-error";

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
  onError = vi.fn(),
) {
  const connectPromise = p.connect(onPartial, onFinal, onError);
  const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1]!;
  ws.simulateOpen();
  await connectPromise;
  return ws;
}

describe("AssemblyAIRealtimeProvider onclose", () => {
  const OriginalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
  });

  it("비정상 종료 시 SESSION_EXPIRED_OR_DISCONNECTED로 onError를 호출한다", async () => {
    const onError = vi.fn();
    const p = new AssemblyAIRealtimeProvider(
      "tok",
      MockWebSocket as unknown as typeof WebSocket,
      testWsOpts,
    );
    const ws = await openAndConnect(p, vi.fn(), vi.fn(), onError);
    ws.close();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
    expect((onError.mock.calls[0]![0] as Error).message).toBe(
      SESSION_EXPIRED_OR_DISCONNECTED,
    );
  });

  it("stop()으로 유도한 정상 종료 후 onclose에서는 onError를 호출하지 않는다", async () => {
    const onError = vi.fn();
    const p = new AssemblyAIRealtimeProvider(
      "tok",
      MockWebSocket as unknown as typeof WebSocket,
      testWsOpts,
    );
    const ws = await openAndConnect(p, vi.fn(), vi.fn(), onError);
    const stopP = p.stop();
    await ws.simulateMessageAsync({ type: "Termination" });
    await stopP;
    expect(onError).not.toHaveBeenCalled();
  });

  it("disconnect() 후 onclose에서는 onError를 추가로 호출하지 않는다", async () => {
    const onError = vi.fn();
    const p = new AssemblyAIRealtimeProvider(
      "tok",
      MockWebSocket as unknown as typeof WebSocket,
      testWsOpts,
    );
    const ws = await openAndConnect(p, vi.fn(), vi.fn(), onError);
    p.disconnect();
    expect(ws.closed).toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });
});
