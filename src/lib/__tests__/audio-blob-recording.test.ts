/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mapMediaErrorToMessage, startBlobRecording } from "../audio";

describe("startBlobRecording", () => {
  const trackStop = vi.fn();
  let lastRecorderMime: string | undefined;

  beforeEach(() => {
    trackStop.mockClear();
    lastRecorderMime = undefined;

    class MockMediaRecorder extends EventTarget {
      static isTypeSupported = vi.fn(
        (mime: string) =>
          mime === "audio/webm;codecs=opus" || mime === "audio/webm",
      );
      state: RecordingState = "inactive";
      mimeType = "";
      ondataavailable: ((ev: BlobEvent) => void) | null = null;

      constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
        super();
        lastRecorderMime = options?.mimeType;
        this.mimeType = options?.mimeType ?? "";
      }

      start() {
        this.state = "recording";
        queueMicrotask(() => {
          this.ondataavailable?.({
            data: new Blob(["chunk"], { type: "audio/webm" }),
          } as BlobEvent);
        });
      }

      stop() {
        this.state = "inactive";
        queueMicrotask(() => {
          this.dispatchEvent(new Event("stop"));
        });
      }
    }

    vi.stubGlobal("MediaRecorder", MockMediaRecorder);

    class MockAudioContext {
      state: AudioContextState = "running";
      destination = {} as AudioDestinationNode;
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
      createMediaStreamSource = vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
      });
      createAnalyser = vi.fn().mockReturnValue({
        fftSize: 256,
        smoothingTimeConstant: 0.4,
        frequencyBinCount: 128,
        connect: vi.fn(),
        disconnect: vi.fn(),
        getByteTimeDomainData: vi.fn(),
      });
    }

    vi.stubGlobal("AudioContext", MockAudioContext);

    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: trackStop }],
        }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("우선 audio/webm;codecs=opus 로 MediaRecorder를 만든다", async () => {
    const session = await startBlobRecording();
    expect(lastRecorderMime).toBe("audio/webm;codecs=opus");
    const blob = await session.stop();
    expect(blob).toBeInstanceOf(Blob);
    expect(trackStop).toHaveBeenCalled();
  });

  it("성공 시 analyser.getByteTimeDomainData 를 호출할 수 있다", async () => {
    const session = await startBlobRecording();
    const buf = new Uint8Array(session.analyser.frequencyBinCount);
    session.analyser.getByteTimeDomainData(buf);
    await session.stop();
    expect(trackStop).toHaveBeenCalled();
  });

  it("stop() 후 Blob 을 반환하고 트랙 정리가 이루어진다", async () => {
    const session = await startBlobRecording();
    await new Promise<void>((r) => setTimeout(r, 0));
    const blob = await session.stop();
    expect(blob).toBeInstanceOf(Blob);
    expect(trackStop).toHaveBeenCalled();
  });

  it("getUserMedia 거부 시 mapMediaErrorToMessage 와 일관되게 reject 된다", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi
          .fn()
          .mockRejectedValue(new DOMException("", "NotAllowedError")),
      },
    });

    try {
      await startBlobRecording();
      expect.fail("should reject");
    } catch (e) {
      expect(e).toBeInstanceOf(DOMException);
      expect(mapMediaErrorToMessage(e)).toMatch(/권한/);
    }
  });
});
