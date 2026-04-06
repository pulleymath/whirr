import { describe, expect, it } from "vitest";
import {
  AssemblyAIRealtimeProvider,
  createAssemblyAiRealtimeProvider,
} from "@/lib/stt";
import type { TranscriptionProvider } from "@/lib/stt/types";

describe("@/lib/stt exports", () => {
  it("AssemblyAIRealtimeProvider를 export한다", () => {
    expect(AssemblyAIRealtimeProvider).toBeTypeOf("function");
  });

  it("createAssemblyAiRealtimeProvider가 TranscriptionProvider를 반환한다", () => {
    const p: TranscriptionProvider = createAssemblyAiRealtimeProvider("tok");
    expect(p.connect).toBeTypeOf("function");
    expect(p.sendAudio).toBeTypeOf("function");
    expect(p.stop).toBeTypeOf("function");
    expect(p.disconnect).toBeTypeOf("function");
  });
});

describe("TranscriptionProvider", () => {
  it("mock provider가 인터페이스를 만족한다", () => {
    const mock = {
      connect: async (
        onPartial: (text: string) => void,
        onFinal: (text: string) => void,
        onError: (error: Error) => void,
      ) => {
        void onPartial;
        void onFinal;
        void onError;
      },
      sendAudio: (pcmData: ArrayBuffer) => {
        void pcmData;
      },
      stop: async () => {},
      disconnect: () => {},
    } satisfies TranscriptionProvider;

    expect(mock).toBeDefined();
  });

  it("connect는 Promise<void>를 반환한다", async () => {
    const p: TranscriptionProvider = {
      connect: async () => {},
      sendAudio: () => {},
      stop: async () => {},
      disconnect: () => {},
    };
    await expect(
      p.connect(
        () => {},
        () => {},
        () => {},
      ),
    ).resolves.toBeUndefined();
  });
});
