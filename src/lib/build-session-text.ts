const FINAL_SEPARATOR = " ";

export function buildSessionText(finals: string[], partial: string): string {
  const cleaned = finals.map((s) => s.trim()).filter(Boolean);
  const joined = cleaned.join(FINAL_SEPARATOR);
  const p = partial.trim();
  if (joined && p) {
    return `${joined}${FINAL_SEPARATOR}${p}`;
  }
  if (joined) {
    return joined;
  }
  return p;
}
