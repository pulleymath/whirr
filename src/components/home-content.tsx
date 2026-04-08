"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SessionList } from "@/components/session-list";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

/** Tailwind `duration-200`(200ms)과 반드시 같게 유지 — 닫힘 언마운트 지연과 동기화 */
const DRAWER_TRANSITION_MS = 200;

/**
 * 홈(`/`)과 세션 상세(`/sessions/[id]`)가 공유하는 메인 영역 레이아웃(데스크톱 History 사이드바,
 * 모바일 drawer, 중앙 `children` 슬롯). 이름은 역사적 잔재이며 도메인은 “메인 크롬 본문”에 가깝다.
 */
export type HomeContentProps = {
  drawerOpen: boolean;
  onCloseDrawer: () => void;
  sessionRefreshTrigger?: number;
  children: ReactNode;
};

export function HomeContent({
  drawerOpen,
  onCloseDrawer,
  sessionRefreshTrigger = 0,
  children,
}: HomeContentProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerEntered, setDrawerEntered] = useState(false);

  /* drawerOpen prop과 오버레이 마운트·진입 애니메이션 상태를 동기화한다. */
  /* eslint-disable react-hooks/set-state-in-effect -- 외부 prop(drawerOpen) → 로컬 전이 상태 동기화 */
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

  const sidebarHistory = (
    <div className="flex w-full flex-col">
      <h2
        id="history-heading"
        className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
      >
        History
      </h2>
      <SessionList refreshTrigger={sessionRefreshTrigger} />
    </div>
  );

  const backdropMotion = reducedMotion
    ? ""
    : "transition-opacity duration-200 ease-out";
  const panelMotion = reducedMotion
    ? ""
    : "transition-transform duration-200 ease-out";

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
          {children}
        </div>
      </div>

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
            onClick={onCloseDrawer}
            data-testid="history-drawer-backdrop"
          />
          <div
            className={`absolute left-0 top-0 flex h-full w-[min(100%,20rem)] flex-col border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950 ${panelMotion} ${drawerEntered ? "translate-x-0" : "-translate-x-full"}`}
            data-testid="history-drawer-panel"
          >
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
              <SessionList refreshTrigger={sessionRefreshTrigger} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
