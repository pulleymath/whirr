"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { SessionList } from "@/components/session-list";
import { SettingsPanel } from "@/components/settings-panel";
import { useRecordingActivity } from "@/lib/recording-activity/context";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export type MainShellProps = {
  children: ReactNode;
  sessionRefreshTrigger?: number;
};

/** Tailwind `duration-200`(200ms)과 반드시 같게 유지 — 닫힘 언마운트 지연과 동기화 */
const DRAWER_TRANSITION_MS = 200;

export function MainShell({
  children,
  sessionRefreshTrigger = 0,
}: MainShellProps) {
  const pathname = usePathname();
  const reducedMotion = usePrefersReducedMotion();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerEntered, setDrawerEntered] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { isRecording } = useRecordingActivity();

  useEffect(() => {
    // 라우트 변경 시 History drawer를 닫는다. Next.js 클라이언트 네비게이션과 동기화.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 라우터↔UI 동기화
    setDrawerOpen(false);
  }, [pathname]);

  /* drawerOpen과 오버레이 마운트·진입 애니메이션 상태를 동기화한다. */
  /* eslint-disable react-hooks/set-state-in-effect -- drawer 열림/닫힘 → 전이 상태 동기화 */
  useEffect(() => {
    if (drawerOpen) {
      setDrawerVisible(true);
      if (reducedMotion) {
        setDrawerEntered(true);
        return;
      }
      setDrawerEntered(false);
      let innerId = 0;
      const outerId = requestAnimationFrame(() => {
        innerId = requestAnimationFrame(() => {
          setDrawerEntered(true);
        });
      });
      return () => {
        cancelAnimationFrame(outerId);
        if (innerId) {
          cancelAnimationFrame(innerId);
        }
      };
    }

    if (reducedMotion) {
      setDrawerEntered(false);
      setDrawerVisible(false);
      return;
    }

    setDrawerEntered(false);
    const closeFallbackMs = DRAWER_TRANSITION_MS + 24;
    const tid = window.setTimeout(() => {
      setDrawerVisible(false);
    }, closeFallbackMs);
    return () => clearTimeout(tid);
  }, [drawerOpen, reducedMotion]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const backdropMotion = reducedMotion
    ? ""
    : "transition-opacity duration-200 ease-out";
  const panelMotion = reducedMotion
    ? ""
    : "transition-transform duration-200 ease-out";

  const sidebarContent = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          History
        </h2>
        <SessionList refreshTrigger={sessionRefreshTrigger} />
      </div>
      <div className="shrink-0 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          disabled={isRecording}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
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
          설정
        </button>
      </div>
    </div>
  );

  return (
    <div className="grid h-dvh grid-cols-1 grid-rows-[3.5rem_1fr] md:grid-cols-[16rem_1fr]">
      <header className="col-span-full flex items-center border-b border-zinc-200/80 bg-white px-4 dark:border-zinc-800/80 dark:bg-zinc-950">
        <button
          type="button"
          onClick={openDrawer}
          className="mr-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 shadow-sm md:hidden dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          aria-label="History 열기"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
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
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          <Link
            href="/"
            className="rounded-sm hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:hover:text-zinc-300 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950"
          >
            Whirr
          </Link>
        </h1>
      </header>

      <aside className="hidden min-h-0 border-r border-zinc-200 bg-zinc-50/50 md:flex dark:border-zinc-800 dark:bg-zinc-950">
        {sidebarContent}
      </aside>

      <main className="overflow-y-auto bg-white dark:bg-zinc-900/50">
        <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-8 md:px-8">
          {children}
        </div>
      </main>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isRecording={isRecording}
      />

      {drawerVisible ? (
        <div
          className="fixed inset-0 z-50 md:hidden"
          aria-modal="true"
          role="dialog"
          data-testid="history-drawer-root"
        >
          <button
            type="button"
            className={`absolute inset-0 bg-black/40 ${backdropMotion} ${drawerEntered ? "opacity-100" : "opacity-0"}`}
            aria-label="History 닫기"
            onClick={closeDrawer}
            data-testid="history-drawer-backdrop"
          />
          <div
            className={`absolute left-0 top-0 flex h-full w-[min(100%,18rem)] flex-col border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950 ${panelMotion} ${drawerEntered ? "translate-x-0" : "-translate-x-full"}`}
            data-testid="history-drawer-panel"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                History
              </span>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                aria-label="닫기"
              >
                닫기
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex h-full flex-col">{sidebarContent}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
