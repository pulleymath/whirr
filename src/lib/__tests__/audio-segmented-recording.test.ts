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

      requestData() {
        if (this.state !== "recording") return;
        const ev = new Event("dataavailable");
        Object.defineProperty(ev, "data", {
          value: new Blob(["chunk-" + recorderInstances.indexOf(this)], {
            type: "audio/webm",
          }),
        });
        this.dispatchEvent(ev);
        if (this.ondataavailable) {
          this.ondataavailable(ev as BlobEvent);
        }
      }

      stop() {
        this.state = "inactive";
        queueMicrotask(() => {
          this.requestData();
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

  it("rotateSegment 호출 시 기존 리코더를 중지하지 않고 requestData를 호출하며, 최종 Blob이 모든 데이터를 포함한다", async () => {
    const session = await startSegmentedRecording();
    const recorder = recorderInstances[0] as unknown as MediaRecorder;
    const requestDataSpy = vi.spyOn(recorder, "requestData");

    await session.rotateSegment();
    expect(requestDataSpy).toHaveBeenCalled();
    expect(recorder.state).toBe("recording");
    expect(recorderInstances.length).toBe(1);

    await session.stopFinalSegment();
    expect(recorder.state).toBe("inactive");

    const fullBlob = await session.getFullAudioBlob();
    expect(fullBlob.size).toBeGreaterThan(0);

    await session.close();
  });

  it("stopFinalSegment 호출 시 마지막 Blob을 반환하고 리코더를 더 이상 생성하지 않는다", async () => {
    const session = await startSegmentedRecording();
    const blob = await session.stopFinalSegment();

    expect(blob).toBeInstanceOf(Blob);
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
    await session.close();
  });

  it("close 호출 시 모든 트랙과 오디오 컨텍스트를 정리한다", async () => {
    const session = await startSegmentedRecording();
    await session.close();
    expect(trackStop).toHaveBeenCalled();
  });
});
