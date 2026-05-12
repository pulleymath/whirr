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
      <Recorder onSessionSaved={onSessionSaved} fixedMode="batch" />
    </MainShell>
  );
}
