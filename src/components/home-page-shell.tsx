"use client";

import { useCallback, useState } from "react";
import { MainShell } from "@/components/main-shell";
import { ModelQuickPanel } from "@/components/model-quick-panel";
import { Recorder } from "@/components/recorder";

export function HomePageShell() {
  const [sessionRefresh, setSessionRefresh] = useState(0);
  const onSessionSaved = useCallback((savedId: string) => {
    void savedId;
    setSessionRefresh((k) => k + 1);
  }, []);

  return (
    <MainShell sessionRefreshTrigger={sessionRefresh}>
      <div className="mx-auto w-full max-w-5xl px-0">
        <Recorder
          onSessionSaved={onSessionSaved}
          modelPanel={<ModelQuickPanel />}
        />
      </div>
    </MainShell>
  );
}
