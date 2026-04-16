"use client";

import { PipelineToastNotifier } from "@/components/pipeline-toast-notifier";
import { GlossaryProvider } from "@/lib/glossary/context";
import { PostRecordingPipelineProvider } from "@/lib/post-recording-pipeline/context";
import { RecordingActivityProvider } from "@/lib/recording-activity/context";
import { SettingsProvider } from "@/lib/settings/context";
import type { ReactNode } from "react";

export function MainAppProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <GlossaryProvider>
        <RecordingActivityProvider>
          <PostRecordingPipelineProvider>
            <PipelineToastNotifier />
            {children}
          </PostRecordingPipelineProvider>
        </RecordingActivityProvider>
      </GlossaryProvider>
    </SettingsProvider>
  );
}
