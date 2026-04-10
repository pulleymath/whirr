/** @vitest-environment happy-dom */
import type { TranscriptionProvider } from "@/lib/stt/types";
import {
  SESSION_EXPIRED_OR_DISCONNECTED,
  SESSION_PROACTIVE_RENEW,
} from "@/lib/stt/user-facing-error";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTranscription } from "../use-transcription";

describe("useTranscription", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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
        "음성 인식 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
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
      }),
    );

    await act(async () => {
      expect(await result.current.prepareStreaming()).toBe(true);
    });

    act(() => {
      onError(new Error("STT_PROVIDER_ERROR"));
    });

    await waitFor(() => {
      expect(result.current.errorMessage).toBe(
        "음성 인식 서버에서 오류가 반환되었습니다. 잠시 후 다시 시도해 주세요.",
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
      useTranscription({ fetchToken, createProvider }),
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
      }),
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
      }),
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

  it("tokenlessProvider가 있으면 fetchToken·createProvider 없이 연결된다", async () => {
    const fetchToken = vi.fn();
    const createProvider = vi.fn();
    let onError: (e: Error) => void = () => {};
    const mockProvider: TranscriptionProvider = {
      connect: async (_op, _of, oe) => {
        onError = oe;
      },
      sendAudio: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };
    const tokenlessProvider = vi.fn(() => mockProvider);

    const { result } = renderHook(() =>
      useTranscription({ fetchToken, createProvider, tokenlessProvider }),
    );

    await act(async () => {
      expect(await result.current.prepareStreaming()).toBe(true);
    });

    expect(fetchToken).not.toHaveBeenCalled();
    expect(createProvider).not.toHaveBeenCalled();
    expect(tokenlessProvider).toHaveBeenCalled();

    act(() => {
      onError(new Error("WEB_SPEECH:network"));
    });

    await waitFor(() => {
      expect(result.current.errorMessage).toBe(
        "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.",
      );
    });
  });

  it("tokenless 경로에서 finalizeStreaming이 stop·disconnect를 호출한다", async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    const disconnect = vi.fn();
    const mockProvider: TranscriptionProvider = {
      connect: async () => {},
      sendAudio: vi.fn(),
      stop,
      disconnect,
    };
    const { result } = renderHook(() =>
      useTranscription({
        tokenlessProvider: () => mockProvider,
      }),
    );

    await act(async () => {
      expect(await result.current.prepareStreaming()).toBe(true);
    });

    await act(async () => {
      await result.current.finalizeStreaming();
    });

    expect(stop).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
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
      }),
    );

    await act(async () => {
      expect(await result.current.prepareStreaming()).toBe(true);
    });

    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("복구 가능한 provider 에러 시 fetchToken·createProvider로 재연결한다", async () => {
    const fetchToken = vi.fn().mockResolvedValue("t");
    let onErrorA: (e: Error) => void = () => {};
    const mockA: TranscriptionProvider = {
      connect: async (_p, _f, oe) => {
        onErrorA = oe;
      },
      sendAudio: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };
    const mockB: TranscriptionProvider = {
      connect: async () => {},
      sendAudio: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };
    const createProvider = vi
      .fn()
      .mockReturnValueOnce(mockA)
      .mockReturnValueOnce(mockB);

    const { result } = renderHook(() =>
      useTranscription({ fetchToken, createProvider }),
    );

    await act(async () => {
      expect(await result.current.prepareStreaming()).toBe(true);
    });
    expect(createProvider).toHaveBeenCalledTimes(1);

    await act(async () => {
      onErrorA(new Error(SESSION_EXPIRED_OR_DISCONNECTED));
    });

    await waitFor(() => {
      expect(fetchToken).toHaveBeenCalledTimes(2);
      expect(createProvider).toHaveBeenCalledTimes(2);
    });
  });

  it("재연결 전에 확정된 finals는 유지된다", async () => {
    const fetchToken = vi.fn().mockResolvedValue("t");
    let onErrorA: (e: Error) => void = () => {};
    let onFinalA: (text: string) => void = () => {};
    const mockA: TranscriptionProvider = {
      connect: async (_p, of, oe) => {
        onFinalA = of;
        onErrorA = oe;
      },
      sendAudio: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };
    const mockB: TranscriptionProvider = {
      connect: async () => {},
      sendAudio: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };
    const createProvider = vi
      .fn()
      .mockReturnValueOnce(mockA)
      .mockReturnValueOnce(mockB);

    const { result } = renderHook(() =>
      useTranscription({ fetchToken, createProvider }),
    );

    await act(async () => {
      expect(await result.current.prepareStreaming()).toBe(true);
    });
    act(() => {
      onFinalA("보존");
    });
    await act(async () => {
      onErrorA(new Error(SESSION_EXPIRED_OR_DISCONNECTED));
    });
    await waitFor(() => {
      expect(result.current.finals).toEqual(["보존"]);
    });
  });

  it("복구 가능 에러가 연속 3회 초과 시 재연결을 중단하고 한도 초과 메시지를 표시한다", async () => {
    const fetchToken = vi.fn().mockResolvedValue("t");
    let onErr: (e: Error) => void = () => {};
    const mock: TranscriptionProvider = {
      connect: async (_p, _f, oe) => {
        onErr = oe;
      },
      sendAudio: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };
    const createProvider = vi.fn().mockReturnValue(mock);

    const { result } = renderHook(() =>
      useTranscription({ fetchToken, createProvider }),
    );

    await act(async () => {
      expect(await result.current.prepareStreaming()).toBe(true);
    });

    for (let i = 0; i < 3; i++) {
      await act(async () => {
        onErr(new Error(SESSION_EXPIRED_OR_DISCONNECTED));
      });
      await waitFor(() => {
        expect(fetchToken.mock.calls.length).toBeGreaterThanOrEqual(i + 2);
      });
    }

    await act(async () => {
      onErr(new Error(SESSION_EXPIRED_OR_DISCONNECTED));
    });

    await waitFor(() => {
      expect(result.current.errorMessage).toBe(
        "음성 인식 연결이 끊어졌습니다. 녹음을 다시 시작해 주세요.",
      );
    });
  });

  it("복구 가능 에러 재연결 시 reconnectToast를 잠깐 표시한다", async () => {
    vi.useFakeTimers();
    const fetchToken = vi.fn().mockResolvedValue("t");
    let onErrorA: (e: Error) => void = () => {};
    const mockA: TranscriptionProvider = {
      connect: async (_p, _f, oe) => {
        onErrorA = oe;
      },
      sendAudio: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };
    const mockB: TranscriptionProvider = {
      connect: async () => {},
      sendAudio: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };
    const createProvider = vi
      .fn()
      .mockReturnValueOnce(mockA)
      .mockReturnValueOnce(mockB);

    const { result } = renderHook(() =>
      useTranscription({ fetchToken, createProvider }),
    );

    await act(async () => {
      expect(await result.current.prepareStreaming()).toBe(true);
    });

    await act(async () => {
      onErrorA(new Error(SESSION_PROACTIVE_RENEW));
    });

    expect(result.current.reconnectToast).toBe("세션을 곧 갱신합니다.");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.reconnectToast).toBeNull();
    vi.useRealTimers();
  });
});
