import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mapMediaErrorToMessage, startPcmRecording } from "./audio";

describe("mapMediaErrorToMessage", () => {
  it("NotAllowedError → 권한 안내", () => {
    expect(mapMediaErrorToMessage({ name: "NotAllowedError" })).toMatch(/권한/);
  });

  it("PermissionDeniedError → 권한 안내", () => {
    expect(mapMediaErrorToMessage({ name: "PermissionDeniedError" })).toMatch(
      /권한/,
    );
  });

  it("NotFoundError → 장치 없음", () => {
    expect(mapMediaErrorToMessage({ name: "NotFoundError" })).toMatch(
      /찾을 수 없습니다/,
    );
  });

  it("알 수 없는 오류 → 일반 메시지", () => {
    expect(mapMediaErrorToMessage(new Error("x"))).toMatch(
      /시작할 수 없습니다/,
    );
  });
});

describe("startPcmRecording", () => {
  const trackStop = vi.fn();
  let addModuleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    trackStop.mockClear();
    addModuleMock = vi.fn().mockResolvedValue(undefined);

    class MockAudioContext {
      state: AudioContextState = "running";
      destination = {} as AudioDestinationNode;
      audioWorklet = { addModule: addModuleMock };
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
      createMediaStreamSource = vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
      });
      createGain = vi.fn().mockReturnValue({
        gain: { value: 1 },
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
    class MockAudioWorkletNode {
      port: { onmessage: ((ev: MessageEvent) => void) | null } = {
        onmessage: null,
      };
      connect = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal(
      "AudioWorkletNode",
      MockAudioWorkletNode as unknown as typeof AudioWorkletNode,
    );

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

  it("워클릿을 로드하고 stop 시 트랙을 중지한다", async () => {
    const session = await startPcmRecording(vi.fn());

    expect(addModuleMock).toHaveBeenCalledWith("/audio-processor.js");
    expect(session.analyser).toBeDefined();

    await session.stop();
    expect(trackStop).toHaveBeenCalled();
  });

  it("addModule 실패 시 스트림을 정리하고 reject한다", async () => {
    addModuleMock.mockRejectedValueOnce(new Error("load fail"));

    await expect(startPcmRecording(vi.fn())).rejects.toThrow("load fail");
    expect(trackStop).toHaveBeenCalledTimes(1);
  });

  it("getUserMedia 거부 시 스트림 없이 reject한다", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi
          .fn()
          .mockRejectedValue(new DOMException("", "NotAllowedError")),
      },
    });

    await expect(startPcmRecording(vi.fn())).rejects.toBeInstanceOf(
      DOMException,
    );
    expect(trackStop).not.toHaveBeenCalled();
  });
});
