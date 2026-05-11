import type { RealtimeEngine, TranscriptionMode } from "@/lib/settings/types";

/** 세션 생성 시점의 스크립트·요약 모델 메타(레거시 세션은 생략 가능). */
export type SessionScriptMeta = {
  mode: TranscriptionMode;
  engine?: RealtimeEngine;
  batchModel?: string;
  language: string;
  minutesModel: string;
};

export type BuildScriptMetaInput = {
  mode: TranscriptionMode;
  realtimeEngine: RealtimeEngine;
  batchModel: string;
  language: string;
  meetingMinutesModel: string;
};

export function buildScriptMeta(
  input: BuildScriptMetaInput,
): SessionScriptMeta {
  const base: SessionScriptMeta = {
    mode: input.mode,
    language: input.language,
    minutesModel: input.meetingMinutesModel,
  };
  if (input.mode === "realtime") {
    return { ...base, engine: input.realtimeEngine };
  }
  if (input.mode === "batch") {
    return { ...base, batchModel: input.batchModel };
  }
  return base;
}
