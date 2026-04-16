"use client";

import { useId, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export type MainTranscriptTabsProps = {
  transcriptPanel: ReactNode;
  summaryPanel: ReactNode;
  /** 기본 선택 탭. 생략 시 `transcript` */
  defaultActive?: "transcript" | "summary";
  /** 탭 버튼 순서. `summary-first`이면 회의록이 왼쪽 */
  tabOrder?: "transcript-first" | "summary-first";
};

const TAB_TRANSCRIPT = "스크립트";
const TAB_SUMMARY = "회의록";

export function MainTranscriptTabs({
  transcriptPanel,
  summaryPanel,
  defaultActive = "transcript",
  tabOrder = "transcript-first",
}: MainTranscriptTabsProps) {
  const baseId = useId();
  const [active, setActive] = useState<"transcript" | "summary">(defaultActive);
  const reducedMotion = usePrefersReducedMotion();

  const transcriptPanelId = `${baseId}-panel-transcript`;
  const summaryPanelId = `${baseId}-panel-summary`;
  const transcriptTabId = `${baseId}-tab-transcript`;
  const summaryTabId = `${baseId}-tab-summary`;

  const transcriptTabClass = (isOn: boolean) =>
    isOn
      ? "flex-1 cursor-pointer rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
      : "flex-1 cursor-pointer rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";

  const transcriptButton = (
    <button
      id={transcriptTabId}
      type="button"
      role="tab"
      aria-selected={active === "transcript"}
      aria-controls={transcriptPanelId}
      tabIndex={active === "transcript" ? 0 : -1}
      onClick={() => setActive("transcript")}
      className={transcriptTabClass(active === "transcript")}
    >
      {TAB_TRANSCRIPT}
    </button>
  );

  const summaryButton = (
    <button
      id={summaryTabId}
      type="button"
      role="tab"
      aria-selected={active === "summary"}
      aria-controls={summaryPanelId}
      tabIndex={active === "summary" ? 0 : -1}
      onClick={() => setActive("summary")}
      className={transcriptTabClass(active === "summary")}
    >
      {TAB_SUMMARY}
    </button>
  );

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        role="tablist"
        aria-label="스크립트 및 회의록"
        className="flex w-full gap-1 rounded-lg border border-zinc-200 bg-zinc-100/80 p-1 dark:border-zinc-800 dark:bg-zinc-900/60"
      >
        {tabOrder === "summary-first" ? (
          <>
            {summaryButton}
            {transcriptButton}
          </>
        ) : (
          <>
            {transcriptButton}
            {summaryButton}
          </>
        )}
      </div>

      <div
        id={transcriptPanelId}
        role="tabpanel"
        aria-labelledby={transcriptTabId}
        hidden={active !== "transcript"}
        className={active === "transcript" ? "w-full" : "hidden"}
      >
        {active === "transcript" ? (
          <div
            key="transcript"
            className="w-full"
            style={
              reducedMotion
                ? undefined
                : { animation: "tab-panel-in 180ms ease-out both" }
            }
            data-testid="tab-panel-motion-wrap"
          >
            {transcriptPanel}
          </div>
        ) : null}
      </div>

      <div
        id={summaryPanelId}
        role="tabpanel"
        aria-labelledby={summaryTabId}
        hidden={active !== "summary"}
        className={active === "summary" ? "w-full" : "hidden"}
      >
        {active === "summary" ? (
          <div
            key="summary"
            className="w-full"
            style={
              reducedMotion
                ? undefined
                : { animation: "tab-panel-in 180ms ease-out both" }
            }
            data-testid="tab-panel-motion-wrap"
          >
            {summaryPanel}
          </div>
        ) : null}
      </div>
    </div>
  );
}
