/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSpeechProvider } from "../web-speech";

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  maxAlternatives = 0;
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn(() => {});
  stop = vi.fn(() => {});
  abort = vi.fn(() => {});
}

describe("WebSpeechProvider restart failures", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("connect 시 recognition.start()가 예외를 던지면 onError를 호출한다", async () => {
    const mock = new MockSpeechRecognition();
    mock.start.mockImplementation(() => {
      throw new Error("already started");
    });
    const onError = vi.fn();
    const p = new WebSpeechProvider(
      "ko-KR",
      () => mock as unknown as SpeechRecognition,
    );
    await p.connect(vi.fn(), vi.fn(), onError);
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]![0] as Error).message).toBe(
      "already started",
    );
    p.disconnect();
  });

  it("onend 후 start() 연속 실패 3회 이후에는 추가 start를 호출하지 않는다", async () => {
    const mock = new MockSpeechRecognition();
    let startCalls = 0;
    mock.start.mockImplementation(() => {
      startCalls += 1;
      if (startCalls > 1) {
        throw new Error("fail");
      }
    });
    const onError = vi.fn();
    const p = new WebSpeechProvider(
      "ko-KR",
      () => mock as unknown as SpeechRecognition,
    );
    await p.connect(vi.fn(), vi.fn(), onError);
    expect(mock.start).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();

    for (let i = 0; i < 3; i++) {
      mock.onend?.();
      await Promise.resolve();
      await Promise.resolve();
    }
    expect(mock.start).toHaveBeenCalledTimes(4);
    expect(onError).toHaveBeenCalledTimes(3);

    mock.onend?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(mock.start).toHaveBeenCalledTimes(4);

    p.disconnect();
  });

  it("포그라운드 복귀 시 visible이면 재시작을 시도한다", async () => {
    const mock = new MockSpeechRecognition();
    mock.start.mockImplementation(() => {
      /* 첫 연결만 성공 */
    });
    const onError = vi.fn();
    const p = new WebSpeechProvider(
      "ko-KR",
      () => mock as unknown as SpeechRecognition,
    );
    await p.connect(vi.fn(), vi.fn(), onError);
    const initialStarts = mock.start.mock.calls.length;

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();

    const afterFirst = mock.start.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(initialStarts);

    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();
    expect(mock.start.mock.calls.length).toBe(afterFirst);

    p.disconnect();
  });
});
