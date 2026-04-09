/** Whisper REST 프록시 업로드 상한 (OpenAI 문서 기준 25MB) */
export const STT_TRANSCRIBE_MAX_BYTES = 25 * 1024 * 1024;

/** 클라이언트 임의 모델 주입 방지 — 설정 UI와 동일한 허용 집합 */
const ALLOWED_MODEL_IDS = new Set([
  "whisper-1",
  "gpt-4o-transcribe",
  "gpt-4o-mini-transcribe",
]);

export const TRANSCRIBE_MODEL_MAX_LENGTH = 64;

export function isAllowedTranscribeModel(model: string): boolean {
  const t = model.trim();
  if (!t || t.length > TRANSCRIBE_MODEL_MAX_LENGTH) {
    return false;
  }
  return ALLOWED_MODEL_IDS.has(t);
}

const ALLOWED = new Set([
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
]);

export function isAllowedTranscribeAudioMime(type: string): boolean {
  const t = type.trim().toLowerCase();
  if (!t) {
    return false;
  }
  return ALLOWED.has(t);
}
