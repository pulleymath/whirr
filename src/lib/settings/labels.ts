import type { SessionScriptMeta } from "@/lib/session-script-meta";
import type { RealtimeEngine, TranscriptionMode } from "@/lib/settings/types";

const MODE_LABEL: Record<TranscriptionMode, string> = {
  realtime: "실시간 스크립트",
  batch: "녹음 후 스크립트",
  webSpeechApi: "Web Speech API",
};

const ENGINE_LABEL: Record<RealtimeEngine, string> = {
  openai: "OpenAI Realtime",
  assemblyai: "AssemblyAI",
};

/** 세션 상세 등 읽기 전용 한 줄 라벨 (모델/엔진 · 모드 · 언어). */
export function formatScriptMetaLine(meta: SessionScriptMeta): string {
  const mode = MODE_LABEL[meta.mode];
  const lang = meta.language;
  let modelPart = "";
  if (meta.mode === "realtime" && meta.engine) {
    modelPart = ENGINE_LABEL[meta.engine] ?? meta.engine;
  } else if (meta.mode === "batch" && meta.batchModel) {
    modelPart = meta.batchModel;
  } else if (meta.mode === "webSpeechApi") {
    modelPart = "브라우저 내장";
  } else {
    modelPart = "—";
  }
  return `${modelPart} · ${mode} · ${lang}`;
}
