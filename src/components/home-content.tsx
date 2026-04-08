"use client";

import { useCallback, useState } from "react";
import { Recorder } from "@/components/recorder";
import { SessionList } from "@/components/session-list";

export type HomeContentProps = {
  drawerOpen: boolean;
  onCloseDrawer: () => void;
};

export function HomeContent({ drawerOpen, onCloseDrawer }: HomeContentProps) {
  const [sessionRefresh, setSessionRefresh] = useState(0);
  const onSessionSaved = useCallback((savedId: string) => {
    void savedId;
    setSessionRefresh((k) => k + 1);
  }, []);

  const sidebarHistory = (
    <div className="flex w-full flex-col">
      <h2
        id="history-heading"
        className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
      >
        History
      </h2>
      <SessionList refreshTrigger={sessionRefresh} />
    </div>
  );

  return (
    <>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 md:flex-row md:items-start md:gap-10">
        <aside
          className="hidden w-full max-w-xs shrink-0 md:block md:max-w-[18rem]"
          aria-labelledby="history-heading"
        >
          <div className="sticky top-6 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            {sidebarHistory}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-6">
          <Recorder onSessionSaved={onSessionSaved} />
        </div>
      </div>

      {drawerOpen ? (
        <div
          className="fixed inset-0 z-50 md:hidden"
          aria-modal="true"
          role="dialog"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="History 닫기"
            onClick={onCloseDrawer}
          />
          <div className="absolute left-0 top-0 flex h-full w-[min(100%,20rem)] flex-col border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                History
              </span>
              <button
                type="button"
                onClick={onCloseDrawer}
                className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                aria-label="닫기"
              >
                닫기
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <SessionList refreshTrigger={sessionRefresh} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
