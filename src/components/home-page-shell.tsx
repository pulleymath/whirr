"use client";

import { useCallback, useState } from "react";
import { MainShell } from "@/components/main-shell";
import { Recorder } from "@/components/recorder";

export function HomePageShell() {
  const [sessionRefresh, setSessionRefresh] = useState(0);
  const onSessionSaved = useCallback((savedId: string) => {
    void savedId;
    setSessionRefresh((k) => k + 1);
  }, []);

  return (
    <MainShell sessionRefreshTrigger={sessionRefresh}>
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6">
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          마이크를 허용한 뒤 녹음을 시작하세요.
        </p>
        <Recorder onSessionSaved={onSessionSaved} />
      </div>
    </MainShell>
  );
}
