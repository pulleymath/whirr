import { AssemblyAIRealtimeProvider } from "./assemblyai";
import { OpenAIRealtimeProvider } from "./openai-realtime";
import type { TranscriptionProvider } from "./types";
export { AssemblyAIRealtimeProvider } from "./assemblyai";
export {
  OPENAI_REALTIME_SESSION_PCM_RATE,
  OPENAI_REALTIME_TRANSCRIBE_MODEL,
  openAiGaTranscriptionSession,
  OpenAIRealtimeProvider,
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
