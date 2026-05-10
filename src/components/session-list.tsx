"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getAllSessions } from "@/lib/db";
import {
  formatSessionListTime,
  groupSessionsByDate,
} from "@/lib/group-sessions-by-date";
import {
  previewSessionText,
  SESSION_LIST_PREVIEW_MAX,
} from "@/lib/session-preview";
import { useRecordingActivity } from "@/lib/recording-activity/context";

function sessionHref(id: string): string {
  return `/sessions/${encodeURIComponent(id)}`;
}

export type SessionListProps = {
  refreshTrigger?: number;
};

export function SessionList({ refreshTrigger = 0 }: SessionListProps) {
  const { isRecording } = useRecordingActivity();
  const pathname = usePathname();
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

  const pathnameDecoded = useMemo(() => {
    if (!pathname?.startsWith("/sessions/")) {
      return null;
    }
    const raw = pathname.slice("/sessions/".length);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [pathname]);

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
    <nav aria-label="저장된 녹음 세션" className="flex w-full flex-col gap-5">
      {groups.map((g) => (
        <section key={g.dateKey} aria-labelledby={`session-day-${g.dateKey}`}>
          <h2
            id={`session-day-${g.dateKey}`}
            className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
          >
            {g.label}
          </h2>
          <ul
            className="flex flex-col border-t border-zinc-200/90 dark:border-zinc-700/80"
            role="list"
          >
            {g.sessions.map((s) => {
              const preview = previewSessionText(
                s.text,
                SESSION_LIST_PREVIEW_MAX,
              );
              const timeLabel = formatSessionListTime(s.createdAt);
              const href = sessionHref(s.id);
              const isActive = pathnameDecoded === s.id;
              const rowClass = isActive
                ? "block bg-zinc-100/90 px-3 py-3 text-left outline-none transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500/60 dark:bg-zinc-800/80 dark:hover:bg-zinc-800"
                : "block px-3 py-3 text-left outline-none transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500/60 dark:hover:bg-zinc-900/60";
              const disabledClass =
                "cursor-not-allowed opacity-50 hover:bg-transparent dark:hover:bg-transparent";
              return (
                <li
                  key={s.id}
                  className="border-b border-zinc-200/90 last:border-b-0 dark:border-zinc-700/80"
                >
                  {isRecording ? (
                    <span
                      className={`${rowClass} ${disabledClass}`}
                      aria-disabled="true"
                      aria-label={`${timeLabel}, ${preview || "빈 스크립트"} (녹음 중에는 이동할 수 없습니다)`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                          {timeLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-zinc-800 dark:text-zinc-200">
                        {preview || "—"}
                      </p>
                    </span>
                  ) : (
                    <Link
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                      className={rowClass}
                      aria-label={`${timeLabel}, ${preview || "빈 스크립트"}`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                          {timeLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-zinc-800 dark:text-zinc-200">
                        {preview || "—"}
                      </p>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
