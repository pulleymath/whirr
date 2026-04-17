import {
  MEETING_MINUTES_MODEL_IDS,
  type RealtimeEngine,
  type TranscriptionMode,
} from "@/lib/settings/types";

export const MODE_OPTIONS: {
  value: TranscriptionMode;
  label: string;
  hint: string;
}[] = [
  {
    value: "realtime",
    label: "실시간 스크립트",
    hint: "녹음하면서 실시간으로 텍스트가 표시됩니다.",
  },
  {
    value: "batch",
    label: "녹음 후 스크립트",
    hint: "녹음이 끝난 뒤 한 번에 스크립트로 변환합니다.",
  },
  {
    value: "webSpeechApi",
    label: "Web Speech API",
    hint: "브라우저 내장 음성 인식을 사용합니다. 일부 환경(예: Chrome)에서는 음성이 클라우드로 전송될 수 있으며, 입력 레벨 미터용으로 별도 마이크 캡처가 함께 동작할 수 있습니다.",
  },
];

export const ENGINE_OPTIONS: {
  value: RealtimeEngine;
  label: string;
  hint: string;
}[] = [
  {
    value: "openai",
    label: "OpenAI Realtime",
    hint: "OpenAI Realtime 스크립트(기본).",
  },
  {
    value: "assemblyai",
    label: "AssemblyAI",
    hint: "AssemblyAI Universal Streaming.",
  },
];

export const BATCH_MODEL_OPTIONS = [
  { value: "whisper-1", label: "whisper-1" },
  { value: "gpt-4o-mini-transcribe", label: "gpt-4o-mini-transcribe" },
  { value: "gpt-4o-transcribe", label: "gpt-4o-transcribe" },
] as const;

export const MEETING_MINUTES_MODEL_OPTIONS = MEETING_MINUTES_MODEL_IDS.map(
  (id) => ({
    value: id,
    label: id,
  }),
);
