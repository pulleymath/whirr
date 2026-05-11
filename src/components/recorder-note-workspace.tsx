"use client";

import { MeetingTemplateSelector } from "@/components/meeting-template-selector";
import type { SessionContext } from "@/lib/glossary/types";
import {
  previewMeetingMinutesTemplate,
  type MeetingMinutesTemplate,
} from "@/lib/meeting-minutes/templates";
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

function NotionPropertyRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-11 flex-col gap-1 border-b border-zinc-200/90 py-2 sm:flex-row sm:items-start sm:gap-3 dark:border-zinc-700/80">
      <div className="shrink-0 pt-1 text-sm text-zinc-500 dark:text-zinc-400 sm:w-28">
        {label}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const NOTION_CONTROL_CLASS =
  "w-full border-0 bg-transparent px-0 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-50 dark:placeholder:text-zinc-500";

/** AI 요약·스크립트 탭 본문 공통 표면 (노션/클로바 노트류 문서 캔버스) */
const NOTE_TAB_SURFACE_CLASS =
  "mt-1 flex min-h-[min(56vh,28rem)] w-full flex-col rounded-2xl border border-zinc-200/80 bg-white px-4 py-5 shadow-sm ring-1 ring-zinc-950/[0.04] dark:border-zinc-800/80 dark:bg-zinc-950/55 dark:ring-white/[0.06] sm:px-6 sm:py-6";

const NOTE_TAB_BUTTON_BASE =
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

  const patch = (partial: Partial<SessionContext>) => {
    onSessionContextChange({ ...sessionContext, ...partial });
  };

  const isCustom = meetingTemplate.id === "custom";
  const customPrompt = isCustom ? meetingTemplate.prompt : "";
  const builtInPreview = !isCustom
    ? previewMeetingMinutesTemplate(meetingTemplate)
    : null;

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

      <div className="mt-2 flex flex-col" data-testid="session-context-input">
        {pipelineBusy ? (
          <p
            className="mb-2 text-xs text-zinc-600 dark:text-zinc-400"
            role="status"
          >
            요약 생성 중에는 수정할 수 없습니다.
          </p>
        ) : null}

        <NotionPropertyRow label="참석자">
          <input
            id={`${baseId}-participants`}
            type="text"
            className={NOTION_CONTROL_CLASS}
            value={sessionContext.participants}
            onChange={(e) => patch({ participants: e.target.value })}
            disabled={pipelineBusy}
            data-testid="session-context-participants"
            placeholder="고풀리 PM, 이풀리 엔지니어"
            autoComplete="off"
          />
        </NotionPropertyRow>

        <NotionPropertyRow label="주제">
          <input
            id={`${baseId}-topic`}
            type="text"
            className={NOTION_CONTROL_CLASS}
            value={sessionContext.topic}
            onChange={(e) => patch({ topic: e.target.value })}
            disabled={pipelineBusy}
            data-testid="session-context-topic"
            placeholder="2분기 제품 로드맵 및 출시 일정 점검"
          />
        </NotionPropertyRow>

        <NotionPropertyRow label="키워드">
          <input
            id={`${baseId}-keywords`}
            type="text"
            className={NOTION_CONTROL_CLASS}
            value={sessionContext.keywords}
            onChange={(e) => patch({ keywords: e.target.value })}
            disabled={pipelineBusy}
            data-testid="session-context-keywords"
            placeholder="우선순위, 리스크, 의사결정, 액션 아이템"
          />
        </NotionPropertyRow>

        <NotionPropertyRow label="요약 형식">
          <MeetingTemplateSelector
            value={meetingTemplate}
            onChange={onMeetingTemplateChange}
            disabled={pipelineBusy}
            variant="select"
          />
        </NotionPropertyRow>
      </div>

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
            <div className="flex min-h-0 flex-1 flex-col">{summaryPanelContent}</div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2.5">
              <div className="space-y-1">
                <p className="text-xs font-normal leading-relaxed text-zinc-400 dark:text-zinc-500">
                  선택한 요약 형식의{" "}
                  <span className="text-zinc-400/70 dark:text-zinc-500/80">
                    목차·구성 예시
                  </span>
                  를 보여줍니다.
                </p>

                <p className="text-[11px] leading-relaxed text-zinc-400/80 dark:text-zinc-500/90 whitespace-pre-wrap">
                  {isCustom
                    ? "Markdown 권장하며 비워 두면 기본 회의 형식으로 생성됩니다.\n입력한 내용은 섹션 구성·톤 가이드로만 쓰이며, 최종 요약 본문이 아닙니다."
                    : "실제 요약 문장은 녹음이 끝난 뒤 스크립트를 바탕으로 생성됩니다."}
                </p>
              </div>

              {isCustom ? (
                <textarea
                  id={`${baseId}-custom-prompt-workspace`}
                  data-testid="meeting-minutes-custom-prompt-editor"
                  disabled={pipelineBusy}
                  value={customPrompt}
                  onChange={(e) =>
                    onMeetingTemplateChange({
                      id: "custom",
                      prompt: e.target.value,
                    })
                  }
                  placeholder={
                    "## 요약\n## 논점\n- 항목은 스크립트 근거만\n## 결정"
                  }
                  className="min-h-[min(48vh,18rem)] w-full flex-1 resize-none border-0 bg-transparent p-0 font-mono text-[13px] leading-relaxed text-zinc-800 placeholder:text-zinc-400/90 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-200 dark:placeholder:text-zinc-500"
                />
              ) : (
                <pre
                  data-testid="meeting-minutes-template-preview"
                  className="m-0 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-zinc-400 selection:bg-zinc-200/50 dark:text-zinc-500 dark:selection:bg-zinc-700/40"
                >
                  {builtInPreview}
                </pre>
              )}
            </div>
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
