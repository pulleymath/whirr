import { AssemblyAIRealtimeProvider } from "./assemblyai";
import type { TranscriptionProvider } from "./types";

export { AssemblyAIRealtimeProvider } from "./assemblyai";
export type { TranscriptionProvider } from "./types";

export function createAssemblyAiRealtimeProvider(
  token: string,
): TranscriptionProvider {
  return new AssemblyAIRealtimeProvider(token);
}
