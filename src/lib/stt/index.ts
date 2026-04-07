import { AssemblyAIRealtimeProvider } from "./assemblyai";
import { OpenAIRealtimeProvider } from "./openai-realtime";
import type { TranscriptionProvider } from "./types";

export { AssemblyAIRealtimeProvider } from "./assemblyai";
export {
  OpenAIRealtimeProvider,
  OPENAI_REALTIME_TRANSCRIBE_MODEL,
  openAiGaTranscriptionSession,
} from "./openai-realtime";
export type { TranscriptionProvider } from "./types";

export function createAssemblyAiRealtimeProvider(
  token: string,
): TranscriptionProvider {
  return new AssemblyAIRealtimeProvider(token);
}

export function createOpenAiRealtimeProvider(
  token: string,
): TranscriptionProvider {
  return new OpenAIRealtimeProvider(token);
}
