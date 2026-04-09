"use client";

import type { ReactNode } from "react";
import { RecordingActivityProvider } from "@/lib/recording-activity/context";
import { SettingsProvider } from "@/lib/settings/context";

export function MainAppProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <RecordingActivityProvider>{children}</RecordingActivityProvider>
    </SettingsProvider>
  );
}
