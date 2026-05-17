/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FULL_RECORDER_TIMESLICE_MS,
  startSegmentedRecording,
} from "../audio";

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
      private sliceIndex = 0;
      private timesliceTimer: ReturnType<typeof setInterval> | null = null;
      lastStartTimeslice: number | undefined;

      constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
        super();
        this.mimeType = options?.mimeType ?? "";
        this.instanceId = instanceCounter++;
        recorderInstances.push(this);
      }

      private emitDataAvailable(label: string) {
        const ev = new Event("dataavailable");
        Object.defineProperty(ev, "data", {
          value: new Blob([label], { type: "audio/webm" }),
        });
        if (this.ondataavailable) {
          this.ondataavailable(ev as BlobEvent);
          return;
        }
        this.dispatchEvent(ev);
      }

      start(timeslice?: number) {
        this.lastStartTimeslice = timeslice;
        this.state = "recording";
        if (timeslice != null && timeslice > 0) {
          this.timesliceTimer = setInterval(() => {
            this.emitDataAvailable(
              `slice-${this.instanceId}-${this.sliceIndex++}`,
            );
          }, timeslice);
        }
      }

      stop() {
        this.state = "inactive";
        if (this.timesliceTimer != null) {
          clearInterval(this.timesliceTimer);
          this.timesliceTimer = null;
        }
        queueMicrotask(() => {
          this.emitDataAvailable(`segment-${this.instanceId}`);
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
    expect(recorderInstances.length).toBe(2);

    const segmentBlob = await session.rotateSegment();
    expect(segmentBlob.size).toBeGreaterThan(0);
    expect(recorderInstances.length).toBe(3);
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

    expect(recorderInstances.length).toBe(5);
    expect((recorderInstances[0] as unknown as MediaRecorder).state).toBe(
      "inactive",
    );
    expect((recorderInstances[1] as unknown as MediaRecorder).state).toBe(
      "recording",
    );
    expect((recorderInstances[2] as unknown as MediaRecorder).state).toBe(
      "inactive",
    );
    expect((recorderInstances[3] as unknown as MediaRecorder).state).toBe(
      "inactive",
    );
    expect((recorderInstances[4] as unknown as MediaRecorder).state).toBe(
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
    expect(recorderInstances.length).toBe(2);
    expect((recorderInstances[0] as unknown as MediaRecorder).state).toBe(
      "inactive",
    );

    await session.close();
  });

  it("full recorder는 timeslice로 시작한다", async () => {
    const session = await startSegmentedRecording();
    const fullRec = recorderInstances[1] as unknown as {
      lastStartTimeslice: number | undefined;
    };
    expect(fullRec.lastStartTimeslice).toBe(FULL_RECORDER_TIMESLICE_MS);
    await session.close();
  });

  it("getFullAudioBlob 호출 시 연속 full recorder의 Blob을 반환한다", async () => {
    const session = await startSegmentedRecording();
    await session.rotateSegment();
    await session.stopFinalSegment();
    const fullBlob = await session.getFullAudioBlob();
    expect(fullBlob).toBeInstanceOf(Blob);
    expect(fullBlob.size).toBeGreaterThan(0);
    await expect(fullBlob.text()).resolves.toBe("segment-1");
    await session.close();
  });

  it("timeslice 구간마다 쌓인 청크가 stop 시 getFullAudioBlob에 모두 포함된다", async () => {
    vi.useFakeTimers();
    const session = await startSegmentedRecording();

    await vi.advanceTimersByTimeAsync(FULL_RECORDER_TIMESLICE_MS);
    await vi.advanceTimersByTimeAsync(FULL_RECORDER_TIMESLICE_MS);
    await session.stopFinalSegment();
    const fullBlob = await session.getFullAudioBlob();
    const text = await fullBlob.text();

    expect(text).toContain("slice-1-0");
    expect(text).toContain("slice-1-1");
    expect(text).toContain("segment-1");

    await session.close();
    vi.useRealTimers();
  });

  it("세그먼트 rotation 후에도 full recorder는 계속 녹음한다", async () => {
    const session = await startSegmentedRecording();
    expect(recorderInstances.length).toBe(2);
    expect((recorderInstances[1] as unknown as MediaRecorder).state).toBe(
      "recording",
    );

    await session.rotateSegment();
    expect((recorderInstances[1] as unknown as MediaRecorder).state).toBe(
      "recording",
    );

    await session.stopFinalSegment();
    await session.getFullAudioBlob();
    expect((recorderInstances[1] as unknown as MediaRecorder).state).toBe(
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
