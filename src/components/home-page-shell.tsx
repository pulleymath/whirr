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
      <>
        <p className="mx-auto mb-8 max-w-2xl text-center text-sm text-zinc-600 dark:text-zinc-400">
          마이크를 허용한 뒤 녹음을 시작하세요.
        </p>
        <Recorder onSessionSaved={onSessionSaved} />
      </>
    </MainShell>
  );
}
