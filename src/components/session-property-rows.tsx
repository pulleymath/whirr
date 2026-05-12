"use client";

import { MeetingTemplateSelector } from "@/components/meeting-template-selector";
import type { SessionContext } from "@/lib/glossary/types";
import { MEETING_MINUTES_MODEL_OPTIONS } from "@/lib/settings/options";
import {
  MEETING_MINUTES_TEMPLATE_OPTIONS,
  type MeetingMinutesTemplate,
} from "@/lib/meeting-minutes/templates";
import { useId, type ReactNode } from "react";

export function NotionPropertyRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
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

export const NOTION_CONTROL_CLASS =
  "w-full border-0 bg-transparent px-0 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-50 dark:placeholder:text-zinc-500";

const EMPTY_PLACEHOLDER = "—";

function formatMeetingTemplateReadOnly(
  meetingTemplate: MeetingMinutesTemplate,
): string {
  if (meetingTemplate.id === "custom") {
    const p = meetingTemplate.prompt.trim();
    if (!p) return "직접입력";
    const head = p.length > 120 ? `${p.slice(0, 120)}…` : p;
    return `직접입력 · ${head}`;
  }
  const opt = MEETING_MINUTES_TEMPLATE_OPTIONS.find(
    (o) => o.value === meetingTemplate.id,
  );
  return opt?.label ?? meetingTemplate.id;
}

function displayOrDash(value: string): string {
  const t = value.trim();
  return t === "" ? EMPTY_PLACEHOLDER : t;
}

export type SessionPropertyRowsReadOnlyProps = {
  sessionContext: SessionContext;
  meetingTemplate: MeetingMinutesTemplate;
};

/** 세션 상세 등: 참석자·주제·키워드·요약 형식을 읽기 전용으로 표시한다. */
export function SessionPropertyRowsReadOnly({
  sessionContext,
  meetingTemplate,
}: SessionPropertyRowsReadOnlyProps) {
  return (
    <div className="flex flex-col" data-testid="session-property-rows-readonly">
      <NotionPropertyRow label="참석자">
        <p className="px-0 py-1 text-sm text-zinc-900 dark:text-zinc-50">
          {displayOrDash(sessionContext.participants)}
        </p>
      </NotionPropertyRow>
      <NotionPropertyRow label="주제">
        <p className="px-0 py-1 text-sm text-zinc-900 dark:text-zinc-50">
          {displayOrDash(sessionContext.topic)}
        </p>
      </NotionPropertyRow>
      <NotionPropertyRow label="키워드">
        <p className="px-0 py-1 text-sm text-zinc-900 dark:text-zinc-50">
          {displayOrDash(sessionContext.keywords)}
        </p>
      </NotionPropertyRow>
      <NotionPropertyRow label="요약 형식">
        <p className="px-0 py-1 text-sm text-zinc-900 dark:text-zinc-50">
          {formatMeetingTemplateReadOnly(meetingTemplate)}
        </p>
      </NotionPropertyRow>
    </div>
  );
}

export type SessionPropertyRowsEditableProps = {
  sessionContext: SessionContext;
  onSessionContextChange: (next: SessionContext) => void;
  meetingTemplate: MeetingMinutesTemplate;
  onMeetingTemplateChange: (next: MeetingMinutesTemplate) => void;
  disabled: boolean;
  /** 지정 시 마지막 행에 "작성 모델" 선택을 표시한다(세션 편집 모달 등). */
  minutesModel?: string;
  onMinutesModelChange?: (modelId: string) => void;
};

/** 홈 녹음·편집 모달 등: Notion 스타일 속성 행을 편집 가능하게 렌더한다. */
export function SessionPropertyRowsEditable({
  sessionContext,
  onSessionContextChange,
  meetingTemplate,
  onMeetingTemplateChange,
  disabled,
  minutesModel,
  onMinutesModelChange,
}: SessionPropertyRowsEditableProps) {
  const baseId = useId();

  const patch = (partial: Partial<SessionContext>) => {
    onSessionContextChange({ ...sessionContext, ...partial });
  };

  return (
    <div className="flex flex-col" data-testid="session-context-input">
      {disabled ? (
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
          disabled={disabled}
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
          disabled={disabled}
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
          disabled={disabled}
          data-testid="session-context-keywords"
          placeholder="우선순위, 리스크, 의사결정, 액션 아이템"
        />
      </NotionPropertyRow>

      <NotionPropertyRow label="요약 형식">
        <MeetingTemplateSelector
          value={meetingTemplate}
          onChange={onMeetingTemplateChange}
          disabled={disabled}
          variant="select"
        />
      </NotionPropertyRow>

      {minutesModel != null && onMinutesModelChange != null ? (
        <NotionPropertyRow label="작성 모델">
          <select
            id={`${baseId}-minutes-model`}
            data-testid="session-minutes-model-select"
            disabled={disabled}
            value={minutesModel}
            onChange={(e) => onMinutesModelChange(e.target.value)}
            className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            {MEETING_MINUTES_MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </NotionPropertyRow>
      ) : null}
    </div>
  );
}
