/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startSegmentedRecording } from "../audio";

describe("startSegmentedRecording", () => {
  const trackStop = vi.fn();
  let recorderInstances: EventTarget[] = [];
  let instanceCounter = 0;

  beforeEach(() => {
    trackStop.mockClear();
    recorderInstances = [];
    instanceCounter = 0;

    class MockMediaRecorder extends EventTarget {
      static isTypeSupported = vi.fn(
        (mime: string) =>
          mime === "audio/webm;codecs=opus" || mime === "audio/webm",
      );
      state: RecordingState = "inactive";
      mimeType = "";
      ondataavailable: ((ev: BlobEvent) => void) | null = null;
      private instanceId: number;

      constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
        super();
        this.mimeType = options?.mimeType ?? "";
        this.instanceId = instanceCounter++;
        recorderInstances.push(this);
      }

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        queueMicrotask(() => {
          const ev = new Event("dataavailable");
          Object.defineProperty(ev, "data", {
            value: new Blob(["segment-" + this.instanceId], {
              type: "audio/webm",
            }),
          });
          this.dispatchEvent(ev);
          if (this.ondataavailable) {
            this.ondataavailable(ev as BlobEvent);
          }
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

  it("rotateSegment 호출 시 현재 리코더를 stop하고 새 리코더를 start한다", async () => {
    const session = await startSegmentedRecording();
    expect(recorderInstances.length).toBe(1);

    const segmentBlob = await session.rotateSegment();
    expect(segmentBlob.size).toBeGreaterThan(0);
    expect(recorderInstances.length).toBe(2);
    expect((recorderInstances[0] as unknown as MediaRecorder).state).toBe(
      "inactive",
    );
    expect((recorderInstances[1] as unknown as MediaRecorder).state).toBe(
      "recording",
    );

    await session.stopFinalSegment();
    const fullBlob = await session.getFullAudioBlob();
    expect(fullBlob.size).toBeGreaterThan(0);

    await session.close();
  });

  it("여러 번 rotateSegment 호출 시 매번 새 리코더를 생성한다", async () => {
    const session = await startSegmentedRecording();

    await session.rotateSegment();
    await session.rotateSegment();
    await session.rotateSegment();

    expect(recorderInstances.length).toBe(4);
    for (let i = 0; i < 3; i++) {
      expect((recorderInstances[i] as unknown as MediaRecorder).state).toBe(
        "inactive",
      );
    }
    expect((recorderInstances[3] as unknown as MediaRecorder).state).toBe(
      "recording",
    );

    await session.stopFinalSegment();
    await session.close();
  });

  it("stopFinalSegment 호출 시 마지막 Blob을 반환한다", async () => {
    const session = await startSegmentedRecording();
    const blob = await session.stopFinalSegment();

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(recorderInstances.length).toBe(1);
    expect((recorderInstances[0] as unknown as MediaRecorder).state).toBe(
      "inactive",
    );

    await session.close();
  });

  it("getFullAudioBlob 호출 시 모든 청크가 합쳐진 Blob을 반환한다", async () => {
    const session = await startSegmentedRecording();
    await session.rotateSegment();
    await session.stopFinalSegment();
    const fullBlob = await session.getFullAudioBlob();
    expect(fullBlob).toBeInstanceOf(Blob);
    expect(fullBlob.size).toBeGreaterThan(0);
    await session.close();
  });

  it("close 호출 시 모든 트랙과 오디오 컨텍스트를 정리한다", async () => {
    const session = await startSegmentedRecording();
    await session.close();
    expect(trackStop).toHaveBeenCalled();
  });
});
