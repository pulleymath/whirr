/** 전사 모드 */
export type TranscriptionMode = "realtime" | "batch" | "webSpeechApi";

/** 실시간 전사에서 사용할 엔진 */
export type RealtimeEngine = "openai" | "assemblyai";

/** 녹음 완료 후 회의록 생성 기본 모델 (OpenAI Chat Completions `model`) */
export const DEFAULT_MEETING_MINUTES_MODEL = "gpt-5.4-nano" as const;

export type TranscriptionSettings = {
  /** 전사 모드: 실시간 / 녹음 후 일괄 / Web Speech API */
  mode: TranscriptionMode;
  /** 실시간 전사 시 사용할 엔진 (mode='realtime'일 때만 적용) */
  realtimeEngine: RealtimeEngine;
  /** 녹음 후 일괄 전사 시 사용할 모델 (mode='batch'일 때만 적용) */
  batchModel: string;
  /** 녹음 완료 후 회의록 작성에 사용할 모델 */
  meetingMinutesModel: string;
  /** 전사 언어 코드 (ISO 639-1 또는 auto) */
  language: string;
};

export const DEFAULT_TRANSCRIPTION_SETTINGS: TranscriptionSettings = {
  mode: "realtime",
  realtimeEngine: "openai",
  batchModel: "whisper-1",
  meetingMinutesModel: DEFAULT_MEETING_MINUTES_MODEL,
  language: "ko",
};

const MODES: TranscriptionMode[] = ["realtime", "batch", "webSpeechApi"];
const ENGINES: RealtimeEngine[] = ["openai", "assemblyai"];

function isTranscriptionMode(v: unknown): v is TranscriptionMode {
  return typeof v === "string" && MODES.includes(v as TranscriptionMode);
}

function isRealtimeEngine(v: unknown): v is RealtimeEngine {
  return typeof v === "string" && ENGINES.includes(v as RealtimeEngine);
}

export function parseTranscriptionSettings(
  raw: unknown,
): TranscriptionSettings {
  const base: TranscriptionSettings = { ...DEFAULT_TRANSCRIPTION_SETTINGS };
  if (!raw || typeof raw !== "object") {
    return base;
  }
  const o = raw as Record<string, unknown>;
  if (isTranscriptionMode(o.mode)) {
    base.mode = o.mode;
  }
  if (isRealtimeEngine(o.realtimeEngine)) {
    base.realtimeEngine = o.realtimeEngine;
  }
  if (typeof o.batchModel === "string" && o.batchModel.length > 0) {
    base.batchModel = o.batchModel;
  }
  if (
    typeof o.meetingMinutesModel === "string" &&
    o.meetingMinutesModel.length > 0
  ) {
    base.meetingMinutesModel = o.meetingMinutesModel;
  }
  if (typeof o.language === "string" && o.language.length > 0) {
    base.language = o.language;
  }
  return base;
}
