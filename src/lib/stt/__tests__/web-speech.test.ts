/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWebSpeechProvider,
  isWebSpeechApiSupported,
  mapSettingsLanguageToWebSpeechLang,
  WebSpeechProvider,
} from "../web-speech";
import {
  createAssemblyAiRealtimeProvider,
  createOpenAiRealtimeProvider,
  isWebSpeechApiSupported as isSupportedFromIndex,
  createWebSpeechProvider as createFromIndex,
} from "@/lib/stt";

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

function emitResult(
  mock: MockSpeechRecognition,
  transcript: string,
  isFinal: boolean,
  resultIndex = 0,
): void {
  const result = {
    0: { transcript },
    length: 1,
    isFinal,
  } as unknown as SpeechRecognitionResult;
  const results = [result] as unknown as SpeechRecognitionResultList;
  Object.defineProperty(results, "length", { value: 1 });
  const event = {
    resultIndex,
    results,
  } as SpeechRecognitionEvent;
  mock.onresult?.(event);
}

describe("mapSettingsLanguageToWebSpeechLang", () => {
  it("en → en-US", () => {
    expect(mapSettingsLanguageToWebSpeechLang("en")).toBe("en-US");
  });
  it("ko → ko-KR", () => {
    expect(mapSettingsLanguageToWebSpeechLang("ko")).toBe("ko-KR");
  });
  it("auto 등 기본은 ko-KR", () => {
    expect(mapSettingsLanguageToWebSpeechLang("auto")).toBe("ko-KR");
  });
});

describe("isWebSpeechApiSupported", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as { webkitSpeechRecognition?: unknown })
      .webkitSpeechRecognition;
  });

  it("SpeechRecognition 있으면 true", () => {
    (
      window as unknown as {
        SpeechRecognition: typeof MockSpeechRecognition;
      }
    ).SpeechRecognition =
      MockSpeechRecognition as unknown as typeof MockSpeechRecognition;
    expect(isWebSpeechApiSupported()).toBe(true);
  });

  it("webkitSpeechRecognition만 있어도 true", () => {
    (
      window as unknown as {
        webkitSpeechRecognition: typeof MockSpeechRecognition;
      }
    ).webkitSpeechRecognition =
      MockSpeechRecognition as unknown as typeof MockSpeechRecognition;
    expect(isWebSpeechApiSupported()).toBe(true);
  });

  it("둘 다 없으면 false", () => {
    expect(isWebSpeechApiSupported()).toBe(false);
  });
});

describe("WebSpeechProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("connect 후 recognition.start 호출", async () => {
    const mock = new MockSpeechRecognition();
    const p = new WebSpeechProvider(
      "ko-KR",
      () => mock as unknown as SpeechRecognition,
    );
    await p.connect(vi.fn(), vi.fn(), vi.fn());
    expect(mock.start).toHaveBeenCalledTimes(1);
    expect(mock.continuous).toBe(true);
    expect(mock.interimResults).toBe(true);
    expect(mock.lang).toBe("ko-KR");
    expect(mock.maxAlternatives).toBe(1);
    p.disconnect();
  });

  it("interim 결과 → onPartial", async () => {
    const mock = new MockSpeechRecognition();
    const onPartial = vi.fn();
    const p = new WebSpeechProvider(
      "ko-KR",
      () => mock as unknown as SpeechRecognition,
    );
    await p.connect(onPartial, vi.fn(), vi.fn());
    emitResult(mock, "안녕", false);
    expect(onPartial).toHaveBeenCalledWith("안녕");
    p.disconnect();
  });

  it("final 결과 → onFinal", async () => {
    const mock = new MockSpeechRecognition();
    const onFinal = vi.fn();
    const p = new WebSpeechProvider(
      "ko-KR",
      () => mock as unknown as SpeechRecognition,
    );
    await p.connect(vi.fn(), onFinal, vi.fn());
    emitResult(mock, "완료", true);
    expect(onFinal).toHaveBeenCalledWith("완료");
    p.disconnect();
  });

  it("onerror → onError (aborted 제외)", async () => {
    const mock = new MockSpeechRecognition();
    const onError = vi.fn();
    const p = new WebSpeechProvider(
      "ko-KR",
      () => mock as unknown as SpeechRecognition,
    );
    await p.connect(vi.fn(), vi.fn(), onError);
    mock.onerror?.({ error: "aborted" } as SpeechRecognitionErrorEvent);
    expect(onError).not.toHaveBeenCalled();
    mock.onerror?.({ error: "not-allowed" } as SpeechRecognitionErrorEvent);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0].message).toContain("WEB_SPEECH:");
    p.disconnect();
  });

  it("onend 시 active면 start 재호출", async () => {
    const mock = new MockSpeechRecognition();
    const p = new WebSpeechProvider(
      "ko-KR",
      () => mock as unknown as SpeechRecognition,
    );
    await p.connect(vi.fn(), vi.fn(), vi.fn());
    mock.start.mockClear();
    mock.onend?.();
    await Promise.resolve();
    expect(mock.start).toHaveBeenCalledTimes(1);
    p.disconnect();
  });

  it("stop() 후 onend면 start 재호출 없음", async () => {
    const mock = new MockSpeechRecognition();
    const p = new WebSpeechProvider(
      "ko-KR",
      () => mock as unknown as SpeechRecognition,
    );
    await p.connect(vi.fn(), vi.fn(), vi.fn());
    await p.stop();
    mock.start.mockClear();
    mock.onend?.();
    await Promise.resolve();
    expect(mock.start).not.toHaveBeenCalled();
    p.disconnect();
  });

  it("sendAudio는 부작용 없음", async () => {
    const mock = new MockSpeechRecognition();
    const p = new WebSpeechProvider(
      "ko-KR",
      () => mock as unknown as SpeechRecognition,
    );
    await p.connect(vi.fn(), vi.fn(), vi.fn());
    mock.start.mockClear();
    p.sendAudio(new ArrayBuffer(8));
    expect(mock.start).not.toHaveBeenCalled();
    p.disconnect();
  });

  it("disconnect 후 onend면 재시작 없음", async () => {
    const mock = new MockSpeechRecognition();
    const p = new WebSpeechProvider(
      "ko-KR",
      () => mock as unknown as SpeechRecognition,
    );
    await p.connect(vi.fn(), vi.fn(), vi.fn());
    p.disconnect();
    mock.start.mockClear();
    mock.onend?.();
    await Promise.resolve();
    expect(mock.start).not.toHaveBeenCalled();
  });

  it("resultIndex부터 results 끝까지 순회한다", async () => {
    const mock = new MockSpeechRecognition();
    const onPartial = vi.fn();
    const onFinal = vi.fn();
    const p = new WebSpeechProvider(
      "ko-KR",
      () => mock as unknown as SpeechRecognition,
    );
    await p.connect(onPartial, onFinal, vi.fn());
    const r0 = {
      0: { transcript: "무시" },
      length: 1,
      isFinal: false,
    } as unknown as SpeechRecognitionResult;
    const r1 = {
      0: { transcript: "둘" },
      length: 1,
      isFinal: true,
    } as unknown as SpeechRecognitionResult;
    const results = [r0, r1] as unknown as SpeechRecognitionResultList;
    Object.defineProperty(results, "length", { value: 2 });
    mock.onresult?.({
      resultIndex: 1,
      results,
    } as SpeechRecognitionEvent);
    expect(onPartial).not.toHaveBeenCalled();
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith("둘");
    p.disconnect();
  });

  it("recognitionFactory가 throw 하면 onError만 호출", async () => {
    const onError = vi.fn();
    const p = new WebSpeechProvider("ko-KR", () => {
      throw new Error("factory-fail");
    });
    await p.connect(vi.fn(), vi.fn(), onError);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toMatchObject({
      message: "factory-fail",
    });
  });

  it("start() 실패 시 abort로 정리하고 onError", async () => {
    const mock = new MockSpeechRecognition();
    mock.start.mockImplementationOnce(() => {
      throw new Error("start-fail");
    });
    const onError = vi.fn();
    const p = new WebSpeechProvider(
      "ko-KR",
      () => mock as unknown as SpeechRecognition,
    );
    await p.connect(vi.fn(), vi.fn(), onError);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "start-fail" }),
    );
    expect(mock.abort).toHaveBeenCalled();
    p.disconnect();
  });

  it("no-speech는 3초 내 중복 시 onError 한 번", async () => {
    const mock = new MockSpeechRecognition();
    const onError = vi.fn();
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(10_000);
    const p = new WebSpeechProvider(
      "ko-KR",
      () => mock as unknown as SpeechRecognition,
    );
    await p.connect(vi.fn(), vi.fn(), onError);
    mock.onerror?.({ error: "no-speech" } as SpeechRecognitionErrorEvent);
    now.mockReturnValue(10_500);
    mock.onerror?.({ error: "no-speech" } as SpeechRecognitionErrorEvent);
    expect(onError).toHaveBeenCalledTimes(1);
    p.disconnect();
  });
});

describe("lib/stt index exports", () => {
  it("createWebSpeechProvider·isWebSpeechApiSupported 노출", () => {
    expect(typeof createFromIndex("ko").connect).toBe("function");
    expect(typeof isSupportedFromIndex).toBe("function");
    expect(typeof createOpenAiRealtimeProvider).toBe("function");
    expect(typeof createAssemblyAiRealtimeProvider).toBe("function");
  });
});

describe("createWebSpeechProvider", () => {
  it("TranscriptionProvider 메서드를 노출한다", () => {
    const p = createWebSpeechProvider("ko");
    expect(typeof p.connect).toBe("function");
    expect(typeof p.sendAudio).toBe("function");
    expect(typeof p.stop).toBe("function");
    expect(typeof p.disconnect).toBe("function");
  });
});
