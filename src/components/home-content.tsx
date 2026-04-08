"use client";

import { useCallback, useState } from "react";
import { Recorder } from "@/components/recorder";
import { SessionList } from "@/components/session-list";

export function HomeContent() {
  const [sessionRefresh, setSessionRefresh] = useState(0);
  const onSessionSaved = useCallback((savedId: string) => {
    void savedId;
    setSessionRefresh((k) => k + 1);
  }, []);

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-12">
      <Recorder onSessionSaved={onSessionSaved} />
      <section
        className="flex w-full flex-col gap-3"
        aria-labelledby="past-sessions-heading"
      >
        <h2
          id="past-sessions-heading"
          className="text-center text-sm font-semibold text-zinc-800 dark:text-zinc-200"
        >
          지난 세션
        </h2>
        <div className="flex justify-center">
          <SessionList refreshTrigger={sessionRefresh} />
        </div>
      </section>
    </div>
  );
}
