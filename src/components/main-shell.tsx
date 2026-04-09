"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { HomeContent } from "@/components/home-content";
import { SettingsPanel } from "@/components/settings-panel";
import { useRecordingActivity } from "@/lib/recording-activity/context";

export type MainShellProps = {
  children: ReactNode;
  sessionRefreshTrigger?: number;
};

export function MainShell({
  children,
  sessionRefreshTrigger = 0,
}: MainShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { isRecording } = useRecordingActivity();

  useEffect(() => {
    // 라우트 변경 시 History drawer를 닫는다. Next.js 클라이언트 네비게이션과 동기화.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 라우터↔UI 동기화
    setDrawerOpen(false);
  }, [pathname]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <header className="relative flex w-full items-center justify-center border-b border-zinc-200/80 px-4 py-4 dark:border-zinc-800/80">
        <button
          type="button"
          onClick={openDrawer}
          className="absolute left-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 shadow-sm md:hidden dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          aria-label="History 열기"
        >
          <span className="sr-only">History</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </svg>
        </button>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Whirr
        </h1>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          disabled={isRecording}
          className="absolute right-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 shadow-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          aria-label="설정"
        >
          <span className="sr-only">설정</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isRecording={isRecording}
      />

      <div className="flex flex-1 flex-col px-4 py-8 md:px-8">
        <HomeContent
          drawerOpen={drawerOpen}
          onCloseDrawer={closeDrawer}
          sessionRefreshTrigger={sessionRefreshTrigger}
        >
          {children}
        </HomeContent>
      </div>
    </div>
  );
}
