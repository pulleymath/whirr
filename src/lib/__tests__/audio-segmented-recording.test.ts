/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startSegmentedRecording } from "../audio";

describe("startSegmentedRecording", () => {
  const trackStop = vi.fn();
  let recorderInstances: EventTarget[] = [];

  beforeEach(() => {
    trackStop.mockClear();
    recorderInstances = [];

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
        this.mimeType = options?.mimeType ?? "";
        recorderInstances.push(this);
      }

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        queueMicrotask(() => {
          this.ondataavailable?.({
            data: new Blob(["chunk-" + recorderInstances.indexOf(this)], {
              type: "audio/webm",
            }),
          } as BlobEvent);
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

  it("startSegmentedRecording 호출 시 세션 객체를 반환한다", async () => {
    const session = await startSegmentedRecording();
    expect(session.rotateSegment).toBeDefined();
    expect(session.stopFinalSegment).toBeDefined();
    expect(session.close).toBeDefined();
    expect(session.analyser).toBeDefined();
    await session.close();
  });

  it("rotateSegment 호출 시 현재 리코더를 중지하고 새 리코더를 시작하며 Blob을 반환한다", async () => {
    const session = await startSegmentedRecording();
    expect(recorderInstances.length).toBe(1);

    const blobPromise = session.rotateSegment();
    const blob = await blobPromise;

    expect(blob).toBeInstanceOf(Blob);
    expect(recorderInstances.length).toBe(2);
    expect((recorderInstances[0] as unknown as { state: string }).state).toBe(
      "inactive",
    );
    expect((recorderInstances[1] as unknown as { state: string }).state).toBe(
      "recording",
    );

    await session.close();
  });

  it("stopFinalSegment 호출 시 마지막 Blob을 반환하고 리코더를 더 이상 생성하지 않는다", async () => {
    const session = await startSegmentedRecording();
    const blob = await session.stopFinalSegment();

    expect(blob).toBeInstanceOf(Blob);
    expect(recorderInstances.length).toBe(1);
    expect((recorderInstances[0] as unknown as { state: string }).state).toBe(
      "inactive",
    );

    await session.close();
  });

  it("close 호출 시 모든 트랙과 오디오 컨텍스트를 정리한다", async () => {
    const session = await startSegmentedRecording();
    await session.close();
    expect(trackStop).toHaveBeenCalled();
  });
});
