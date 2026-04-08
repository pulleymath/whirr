import type { Session } from "@/lib/db";

export type SessionDayGroup = {
  dateKey: string;
  label: string;
  sessions: Session[];
};

/** 로컬 달력 기준 `YYYY-MM-DD` (그룹 키·정렬용). */
export function localDateKeyFromTimestamp(createdAt: number): string {
  const d = new Date(createdAt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatSessionGroupLabel(dateKey: string): string {
  const [ys, ms, ds] = dateKey.split("-").map(Number);
  const d = new Date(ys, ms - 1, ds);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function formatSessionListTime(createdAt: number): string {
  return new Date(createdAt).toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * `sessions`는 날짜 무관 전역 최신순(예: `getAllSessions()` 결과)이어야 한다.
 * 같은 날짜 안에서는 입력 순서를 유지한다.
 */
export function groupSessionsByDate(sessions: Session[]): SessionDayGroup[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = localDateKeyFromTimestamp(s.createdAt);
    const list = map.get(key);
    if (list) {
      list.push(s);
    } else {
      map.set(key, [s]);
    }
  }
  const keys = [...map.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  return keys.map((dateKey) => ({
    dateKey,
    label: formatSessionGroupLabel(dateKey),
    sessions: map.get(dateKey)!,
  }));
}
