/** 스크립트 모드 */
export type TranscriptionMode = "realtime" | "batch" | "webSpeechApi";

/** 실시간 스크립트에서 사용할 엔진 */
export type RealtimeEngine = "openai" | "assemblyai";

/** 녹음 완료 후 회의록 생성 기본 모델 (OpenAI Chat Completions `model`) */
export const DEFAULT_MEETING_MINUTES_MODEL = "gpt-5.4-nano" as const;

/** 설정·서버 API에서 허용하는 회의록 Chat 모델 id (화이트리스트). */
export const MEETING_MINUTES_MODEL_IDS = [
  DEFAULT_MEETING_MINUTES_MODEL,
  "gpt-4o",
  "gpt-4o-mini",
] as const;

export function isAllowedMeetingMinutesModelId(id: string): boolean {
  return (MEETING_MINUTES_MODEL_IDS as readonly string[]).includes(id);
}

export type TranscriptionSettings = {
  /** 스크립트 모드: 실시간 / 녹음 후 일괄 / Web Speech API */
  mode: TranscriptionMode;
  /** 실시간 스크립트 시 사용할 엔진 (mode='realtime'일 때만 적용) */
  realtimeEngine: RealtimeEngine;
  /** 녹음 후 일괄 스크립트 시 사용할 모델 (mode='batch'일 때만 적용) */
  batchModel: string;
  /** 녹음 완료 후 회의록 작성에 사용할 모델 */
  meetingMinutesModel: string;
  /** 스크립트 언어 코드 (ISO 639-1 또는 auto) */
  language: string;
};

export const DEFAULT_TRANSCRIPTION_SETTINGS: TranscriptionSettings = {
  mode: "batch",
  realtimeEngine: "openai",
  batchModel: "gpt-4o-mini-transcribe",
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
  /* 프로덕션에서는 스크립트 모드를 사용자가 바꿀 수 없으므로 저장값을 적용하지 않는다. */
  if (
    process.env.NODE_ENV !== "production" &&
    isTranscriptionMode(o.mode)
  ) {
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
    base.meetingMinutesModel = isAllowedMeetingMinutesModelId(
      o.meetingMinutesModel,
    )
      ? o.meetingMinutesModel
      : DEFAULT_MEETING_MINUTES_MODEL;
  }
  if (typeof o.language === "string" && o.language.length > 0) {
    base.language = o.language;
  }
  return base;
}
