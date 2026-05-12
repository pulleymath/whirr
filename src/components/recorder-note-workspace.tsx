"use client";

import { MeetingTemplatePreview } from "@/components/meeting-template-preview";
import { SessionPropertyRowsEditable } from "@/components/session-property-rows";
import type { SessionContext } from "@/lib/glossary/types";
import type { MeetingMinutesTemplate } from "@/lib/meeting-minutes/templates";
import type { ReactNode } from "react";
import { useId, useState } from "react";

export type RecorderNoteWorkspaceProps = {
  noteTitle: string;
  onNoteTitleChange: (value: string) => void;
  sessionContext: SessionContext;
  onSessionContextChange: (next: SessionContext) => void;
  meetingTemplate: MeetingMinutesTemplate;
  onMeetingTemplateChange: (next: MeetingMinutesTemplate) => void;
  pipelineBusy: boolean;
  children?: ReactNode;
  /** 지정 시 AI 요약 탭에 템플릿 미리보기 대신 이 콘텐츠를 렌더한다(세션 상세 등). */
  summaryPanelContent?: ReactNode;
  /** true면 제목을 입력 필드 없이 표시만 한다. */
  titleReadOnly?: boolean;
};

type NoteWorkspaceTab = "summary" | "script";

/** AI 요약·스크립트 탭 본문 공통 표면 (노션/클로바 노트류 문서 캔버스) */
export const NOTE_TAB_SURFACE_CLASS =
  "mt-1 flex min-h-[min(56vh,28rem)] w-full flex-col rounded-2xl border border-zinc-200/80 bg-white px-4 py-5 shadow-sm ring-1 ring-zinc-950/[0.04] dark:border-zinc-800/80 dark:bg-zinc-950/55 dark:ring-white/[0.06] sm:px-6 sm:py-6";

export const NOTE_TAB_BUTTON_BASE =
  "cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950";

/**
 * 홈 녹음 상단: 편집 가능한 노트 제목, Notion 스타일 속성 행(참석자·주제·키워드), 요약 형식, AI 요약/스크립트 탭.
 */
export function RecorderNoteWorkspace({
  noteTitle,
  onNoteTitleChange,
  sessionContext,
  onSessionContextChange,
  meetingTemplate,
  onMeetingTemplateChange,
  pipelineBusy,
  children,
  summaryPanelContent,
  titleReadOnly = false,
}: RecorderNoteWorkspaceProps) {
  const baseId = useId();
  const [activeTab, setActiveTab] = useState<NoteWorkspaceTab>("summary");
  const summaryPanelId = `${baseId}-tabpanel-summary`;
  const scriptPanelId = `${baseId}-tabpanel-script`;
  const summaryTabId = `${baseId}-tab-summary`;
  const scriptTabId = `${baseId}-tab-script`;

  const displayTitle = noteTitle.trim();
  const titleTypographyClass =
    "w-full border-0 bg-transparent px-0 py-2 text-2xl font-semibold tracking-tight focus:outline-none focus:ring-0 dark:text-zinc-50";

  return (
    <div className="flex flex-col gap-1" data-testid="recorder-note-workspace">
      {titleReadOnly ? (
        <h2
          data-testid="recorder-note-title"
          aria-label="노트 제목"
          className={`${titleTypographyClass} ${
            displayTitle
              ? "text-zinc-900 dark:text-zinc-50"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {displayTitle || "새로운 노트"}
        </h2>
      ) : (
        <input
          type="text"
          value={noteTitle}
          onChange={(e) => onNoteTitleChange(e.target.value)}
          disabled={pipelineBusy}
          placeholder="새로운 노트"
          aria-label="노트 제목"
          data-testid="recorder-note-title"
          className={`${titleTypographyClass} text-zinc-900 placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:placeholder:text-zinc-500`}
        />
      )}

      <SessionPropertyRowsEditable
        sessionContext={sessionContext}
        onSessionContextChange={onSessionContextChange}
        meetingTemplate={meetingTemplate}
        onMeetingTemplateChange={onMeetingTemplateChange}
        disabled={pipelineBusy}
      />

      <div className="mt-4 flex flex-col gap-2">
        <div
          role="tablist"
          aria-label="노트 본문"
          className="flex gap-1 border-b border-zinc-200 dark:border-zinc-700"
        >
          <button
            id={summaryTabId}
            type="button"
            role="tab"
            aria-selected={activeTab === "summary"}
            aria-controls={summaryPanelId}
            data-testid="note-tab-summary"
            onClick={() => setActiveTab("summary")}
            className={
              activeTab === "summary"
                ? `${NOTE_TAB_BUTTON_BASE} -mb-px border-sky-500 text-sky-600 dark:text-sky-400`
                : `${NOTE_TAB_BUTTON_BASE} border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200`
            }
          >
            AI 요약
          </button>
          <button
            id={scriptTabId}
            type="button"
            role="tab"
            aria-selected={activeTab === "script"}
            aria-controls={scriptPanelId}
            data-testid="note-tab-script"
            onClick={() => setActiveTab("script")}
            className={
              activeTab === "script"
                ? `${NOTE_TAB_BUTTON_BASE} -mb-px border-sky-500 text-sky-600 dark:text-sky-400`
                : `${NOTE_TAB_BUTTON_BASE} border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200`
            }
          >
            스크립트
          </button>
        </div>

        <div
          id={summaryPanelId}
          role="tabpanel"
          aria-labelledby={summaryTabId}
          hidden={activeTab !== "summary"}
          className={NOTE_TAB_SURFACE_CLASS}
        >
          {summaryPanelContent != null ? (
            <div className="flex min-h-0 flex-1 flex-col">
              {summaryPanelContent}
            </div>
          ) : (
            <MeetingTemplatePreview
              value={meetingTemplate}
              onChange={onMeetingTemplateChange}
              disabled={pipelineBusy}
            />
          )}
        </div>

        <div
          id={scriptPanelId}
          role="tabpanel"
          aria-labelledby={scriptTabId}
          hidden={activeTab !== "script"}
          className={NOTE_TAB_SURFACE_CLASS}
        >
          {children ? (
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-12 text-center">
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                아직 스크립트가 없습니다
              </p>
              <p className="max-w-sm text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                녹음을 시작하면 이 영역에 실시간 스크립트가 쌓입니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
