/** @vitest-environment happy-dom */
import type { TranscriptionProvider } from "@/lib/stt/types";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTranscription } from "../use-transcription";

describe("useTranscription", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("토큰 fetch 실패 시 에러 메시지를 설정한다", async () => {
    const fetchToken = vi.fn().mockRejectedValue(new Error("no token"));
    const { result } = renderHook(() => useTranscription({ fetchToken }));

    let ok = true;
    await act(async () => {
      ok = await result.current.prepareStreaming();
    });

    expect(ok).toBe(false);
    await waitFor(() => {
      expect(result.current.errorMessage).toBe(
        "음성 인식 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
      );
    });
  });

  it("Provider connect의 onError 호출 시 사용자용 에러 메시지를 설정한다", async () => {
    let onError: (e: Error) => void = () => {};
    const mockProvider: TranscriptionProvider = {
      connect: async (_op, _of, oe) => {
        onError = oe;
      },
      sendAudio: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };

    const { result } = renderHook(() =>
      useTranscription({
        fetchToken: vi.fn().mockResolvedValue("t"),
        createProvider: () => mockProvider,
      })
    );

    await act(async () => {
      expect(await result.current.prepareStreaming()).toBe(true);
    });

    act(() => {
      onError(new Error("STT_PROVIDER_ERROR"));
    });

    await waitFor(() => {
      expect(result.current.errorMessage).toBe(
        "음성 인식 서버에서 오류가 반환되었습니다. 잠시 후 다시 시도해 주세요."
      );
    });
  });

  it("prepareStreaming 후 partial·final 콜백이 상태를 갱신한다", async () => {
    let onPartial: (text: string) => void = () => {};
    let onFinal: (text: string) => void = () => {};
    const mockProvider: TranscriptionProvider = {
      connect: async (op, of, oe) => {
        void oe;
        onPartial = op;
        onFinal = of;
      },
      sendAudio: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };

    const fetchToken = vi.fn().mockResolvedValue("tok");
    const createProvider = vi.fn().mockReturnValue(mockProvider);

    const { result } = renderHook(() =>
      useTranscription({ fetchToken, createProvider })
    );

    let ok = false;
    await act(async () => {
      ok = await result.current.prepareStreaming();
    });
    expect(ok).toBe(true);

    act(() => {
      onPartial("부분");
    });
    expect(result.current.partial).toBe("부분");

    act(() => {
      onFinal("최종");
    });
    expect(result.current.finals).toEqual(["최종"]);
    expect(result.current.partial).toBe("");
  });

  it("sendPcm은 기본(OpenAI)에서 청크를 즉시 sendAudio로 보낸다", async () => {
    const sendAudio = vi.fn();
    const mockProvider: TranscriptionProvider = {
      connect: async () => {},
      sendAudio,
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };

    const { result } = renderHook(() =>
      useTranscription({
        fetchToken: vi.fn().mockResolvedValue("t"),
        createProvider: () => mockProvider,
      })
    );

    await act(async () => {
      expect(await result.current.prepareStreaming()).toBe(true);
    });

    act(() => {
      result.current.sendPcm(new ArrayBuffer(800));
    });
    expect(sendAudio).toHaveBeenCalledTimes(1);
    expect((sendAudio.mock.calls[0]![0] as ArrayBuffer).byteLength).toBe(800);
  });

  it("useAssemblyAiPcmFraming이면 최소 50ms PCM까지 모아 sendAudio로 보낸다", async () => {
    const sendAudio = vi.fn();
    const mockProvider: TranscriptionProvider = {
      connect: async () => {},
      sendAudio,
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };

    const { result } = renderHook(() =>
      useTranscription({
        fetchToken: vi.fn().mockResolvedValue("t"),
        createProvider: () => mockProvider,
        useAssemblyAiPcmFraming: true,
      })
    );

    await act(async () => {
      expect(await result.current.prepareStreaming()).toBe(true);
    });

    /* 16kHz mono s16le 50ms = 1600 bytes */
    act(() => {
      result.current.sendPcm(new ArrayBuffer(800));
    });
    expect(sendAudio).not.toHaveBeenCalled();

    act(() => {
      result.current.sendPcm(new ArrayBuffer(800));
    });
    expect(sendAudio).toHaveBeenCalledTimes(1);
    expect((sendAudio.mock.calls[0]![0] as ArrayBuffer).byteLength).toBe(1600);
  });

  it("언마운트 시 disconnect를 호출한다", async () => {
    const disconnect = vi.fn();
    const mockProvider: TranscriptionProvider = {
      connect: async () => {},
      sendAudio: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect,
    };

    const { result, unmount } = renderHook(() =>
      useTranscription({
        fetchToken: vi.fn().mockResolvedValue("t"),
        createProvider: () => mockProvider,
      })
    );

    await act(async () => {
      expect(await result.current.prepareStreaming()).toBe(true);
    });

    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
