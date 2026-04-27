"use client";

import Link from "next/link";
import { MeetingTemplateSelector } from "@/components/meeting-template-selector";
import { RecordingCard } from "@/components/recording-card";
import { RevealSection } from "@/components/recorder-reveal-section";
import { SessionContextInput } from "@/components/session-context-input";
import { TranscriptView } from "@/components/transcript-view";
import type { SessionContext } from "@/lib/glossary/types";
import {
  DEFAULT_MEETING_MINUTES_TEMPLATE,
  type MeetingMinutesTemplate,
} from "@/lib/meeting-minutes/templates";
import { useState } from "react";

const EMPTY_CONTEXT: SessionContext = {
  participants: "",
  topic: "",
  keywords: "",
};

type PreviewPhase = "idle" | "recording" | "script";

/**
 * 녹음·STT·API 없이 Recorder 레이아웃·애니메이션만 브라우저에서 확인할 때 쓴다.
 * `/recorder-preview`에서만 라우트됨(프로덕션 빌드에서는 비활성).
 */
export function RecorderUiPreview() {
  const [phase, setPhase] = useState<PreviewPhase>("idle");
  const [sessionContext, setSessionContext] =
    useState<SessionContext>(EMPTY_CONTEXT);
  const [meetingTemplate, setMeetingTemplate] =
    useState<MeetingMinutesTemplate>(DEFAULT_MEETING_MINUTES_TEMPLATE);

  const recordingActive = phase !== "idle";
  const hasScript = phase === "script";
  const showSessionContext = recordingActive;
  const showTranscript = recordingActive && hasScript;

  const displayElapsedMs = recordingActive ? 125_000 : 0;
  const displayLevel = recordingActive ? 0.35 : 0;
  const batchRecording = recordingActive;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
        <p>
          <strong className="font-semibold">UI 프리뷰</strong> — 마이크·API 호출
          없음. 단계만 고릅니다.
        </p>
        <Link
          href="/"
          className="shrink-0 text-amber-800 underline underline-offset-2 hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-50"
        >
          홈으로
        </Link>
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="프리뷰 단계"
      >
        {(
          [
            ["idle", "녹음 전 (카드만)"],
            ["recording", "녹음 중 (컨텍스트까지)"],
            ["script", "스크립트 수신 후"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setPhase(value)}
            className={
              phase === value
                ? "rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className="mx-auto flex w-full max-w-5xl flex-col"
        data-testid="recorder-root"
        data-transcription-mode="batch"
        data-preview="true"
      >
        <RecordingCard
          elapsedMs={displayElapsedMs}
          level={displayLevel}
          showStart={!recordingActive}
          showStop={recordingActive}
          recordingActive={recordingActive}
          onStart={() => {}}
          onStop={() => {}}
          isBatchMode
          batchRecording={batchRecording}
          segmentProgress={batchRecording ? 0.42 : 0}
          completedCount={batchRecording ? 2 : 0}
          totalCount={batchRecording ? 5 : 0}
          failedCount={0}
          stoppedRetry={null}
          messages={
            batchRecording && !hasScript
              ? [
                  {
                    text: "녹음 중입니다. 5분마다 스크립트 결과가 업데이트됩니다.",
                    tone: "warning" as const,
                  },
                ]
              : []
          }
        />

        <RevealSection
          visible={showSessionContext}
          testId="reveal-session-context"
        >
          <SessionContextInput
            value={sessionContext}
            onChange={setSessionContext}
            disabled={false}
            topContent={
              <MeetingTemplateSelector
                value={meetingTemplate}
                onChange={setMeetingTemplate}
                disabled={false}
              />
            }
          />
        </RevealSection>

        <RevealSection visible={showTranscript} testId="reveal-transcript">
          <TranscriptView
            partial=""
            finals={
              hasScript
                ? [
                    "첫 번째 세그먼트에서 나온 스크립트입니다.\n두 번째 줄 예시입니다.",
                  ]
                : []
            }
            errorMessage={null}
            showHeading={false}
            emptyStateHint={
              batchRecording && !hasScript
                ? "녹음 중입니다. 5분마다 스크립트 결과가 업데이트됩니다."
                : null
            }
            loadingMessage={null}
            isSegmentInFlight={false}
          />
        </RevealSection>
      </div>
    </div>
  );
}
