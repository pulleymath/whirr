/** 목록 행 미리보기 최대 글자 수(UI·테스트 공통). */
export const SESSION_LIST_PREVIEW_MAX = 80;

/** 목록용 미리보기: 앞뒤 공백 제거 후 `maxLen` 초과 시 말줄임. */
export function previewSessionText(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) {
    return t;
  }
  return `${t.slice(0, maxLen)}…`;
}
