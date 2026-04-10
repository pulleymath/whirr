import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAIRealtimeProvider } from "../openai-realtime";
import {
  OPENAI_REALTIME_SESSION_MAX_DURATION_MESSAGE,
  SESSION_EXPIRED_OR_DISCONNECTED,
  SESSION_PROACTIVE_RENEW,
} from "../user-facing-error";

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

describe("OpenAIRealtimeProvider reconnect / onclose", () => {
  const OriginalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
    vi.useRealTimers();
  });

  it("선제 갱신 타이머 만료 시 stop 후 SESSION_PROACTIVE_RENEW onError를 올린다", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const p = new OpenAIRealtimeProvider(
      "ek",
      MockWebSocket as unknown as typeof WebSocket,
      { stopFlushMs: 5, proactiveRenewalAfterMs: 20 },
    );
    await openAndConnect(p, vi.fn(), vi.fn(), onError);
    await vi.advanceTimersByTimeAsync(25);
    await vi.advanceTimersByTimeAsync(10);
    await vi.runAllTimersAsync();
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalled();
    const last = onError.mock.calls[onError.mock.calls.length - 1]![0] as Error;
    expect(last.message).toBe(SESSION_PROACTIVE_RENEW);
  });

  it("비정상 onclose 시 SESSION_EXPIRED_OR_DISCONNECTED를 올린다", async () => {
    const onError = vi.fn();
    const p = new OpenAIRealtimeProvider(
      "ek",
      MockWebSocket as unknown as typeof WebSocket,
      { stopFlushMs: 10, proactiveRenewalAfterMs: 0 },
    );
    const ws = await openAndConnect(p, vi.fn(), vi.fn(), onError);
    ws.close();
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]![0] as Error).message).toBe(
      SESSION_EXPIRED_OR_DISCONNECTED,
    );
  });

  it("disconnect 후에는 onclose로 SESSION_EXPIRED를 올리지 않는다", async () => {
    const onError = vi.fn();
    const p = new OpenAIRealtimeProvider(
      "ek",
      MockWebSocket as unknown as typeof WebSocket,
      { stopFlushMs: 10, proactiveRenewalAfterMs: 0 },
    );
    const ws = await openAndConnect(p, vi.fn(), vi.fn(), onError);
    p.disconnect();
    expect(ws.closed).toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });

  it("사용자 stop()으로 닫은 뒤에는 SESSION_EXPIRED를 올리지 않는다", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const p = new OpenAIRealtimeProvider(
      "ek",
      MockWebSocket as unknown as typeof WebSocket,
      { stopFlushMs: 5, proactiveRenewalAfterMs: 0 },
    );
    const ws = await openAndConnect(p, vi.fn(), vi.fn(), onError);
    const stopP = p.stop();
    await vi.advanceTimersByTimeAsync(20);
    await stopP;
    expect(onError).not.toHaveBeenCalled();
    expect(ws.closed).toBe(true);
  });

  it("60분 세션 만료 error 이벤트 메시지를 그대로 onError에 전달한다", async () => {
    const onError = vi.fn();
    const p = new OpenAIRealtimeProvider(
      "ek",
      MockWebSocket as unknown as typeof WebSocket,
      { stopFlushMs: 10, proactiveRenewalAfterMs: 0 },
    );
    const ws = await openAndConnect(p, vi.fn(), vi.fn(), onError);
    await ws.simulateMessageAsync({
      type: "error",
      error: { message: OPENAI_REALTIME_SESSION_MAX_DURATION_MESSAGE },
    });
    expect((onError.mock.calls[0]![0] as Error).message).toBe(
      OPENAI_REALTIME_SESSION_MAX_DURATION_MESSAGE,
    );
  });
});
