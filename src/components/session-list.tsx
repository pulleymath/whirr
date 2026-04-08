"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAllSessions } from "@/lib/db";
import {
  formatSessionListTime,
  groupSessionsByDate,
} from "@/lib/group-sessions-by-date";
import {
  previewSessionText,
  SESSION_LIST_PREVIEW_MAX,
} from "@/lib/session-preview";

export type SessionListProps = {
  refreshTrigger?: number;
};

export function SessionList({ refreshTrigger = 0 }: SessionListProps) {
  const [groups, setGroups] = useState<ReturnType<typeof groupSessionsByDate>>(
    [],
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const all = await getAllSessions();
        if (!cancelled) {
          setGroups(groupSessionsByDate(all));
        }
      } catch {
        if (!cancelled) {
          setGroups([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  if (loading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">불러오는 중…</p>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        저장된 세션이 없습니다.
      </p>
    );
  }

  return (
    <nav
      aria-label="저장된 녹음 세션"
      className="flex w-full max-w-md flex-col gap-6"
    >
      {groups.map((g) => (
        <section key={g.dateKey} aria-labelledby={`session-day-${g.dateKey}`}>
          <h2
            id={`session-day-${g.dateKey}`}
            className="mb-3 text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-400"
          >
            {g.label}
          </h2>
          <ul className="flex flex-col gap-2">
            {g.sessions.map((s) => {
              const preview = previewSessionText(
                s.text,
                SESSION_LIST_PREVIEW_MAX,
              );
              const timeLabel = formatSessionListTime(s.createdAt);
              return (
                <li key={s.id}>
                  <Link
                    href={`/sessions/${encodeURIComponent(s.id)}`}
                    className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                    aria-label={`${timeLabel}, ${preview || "빈 전사"}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {timeLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">
                      {preview || "—"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
