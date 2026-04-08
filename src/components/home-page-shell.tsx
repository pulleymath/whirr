"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { HomeContent } from "@/components/home-content";

export function HomePageShell() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    // 라우트 변경 시 History drawer를 닫는다. Next.js 클라이언트 네비게이션과 동기화.
    // pathname은 라우터 외부 소스이며, 이 effect가 라우트↔UI 동기화를 담당한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
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
      </header>

      <div className="flex flex-1 flex-col px-4 py-8 md:px-8">
        <p className="mx-auto mb-8 max-w-2xl text-center text-sm text-zinc-600 dark:text-zinc-400">
          실시간 음성 전사 앱입니다. 마이크를 허용한 뒤 녹음을 시작하세요.
        </p>
        <HomeContent drawerOpen={drawerOpen} onCloseDrawer={closeDrawer} />
      </div>
    </div>
  );
}
