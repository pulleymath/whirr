"use client";

import type { ReactNode } from "react";
import { PostRecordingPipelineProvider } from "@/lib/post-recording-pipeline/context";
import { RecordingActivityProvider } from "@/lib/recording-activity/context";
import { SettingsProvider } from "@/lib/settings/context";

export function MainAppProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <RecordingActivityProvider>
        <PostRecordingPipelineProvider>
          {children}
        </PostRecordingPipelineProvider>
      </RecordingActivityProvider>
    </SettingsProvider>
  );
}
