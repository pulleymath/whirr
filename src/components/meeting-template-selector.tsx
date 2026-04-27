"use client";

import { MEETING_MINUTES_TEMPLATE_OPTIONS } from "@/lib/meeting-minutes/templates";
import type { MeetingMinutesTemplate } from "@/lib/meeting-minutes/templates";
import { useId } from "react";

export type MeetingTemplateSelectorProps = {
  value: MeetingMinutesTemplate;
  onChange: (next: MeetingMinutesTemplate) => void;
  disabled?: boolean;
};

export function MeetingTemplateSelector({
  value,
  onChange,
  disabled = false,
}: MeetingTemplateSelectorProps) {
  const baseId = useId();
  const legendId = `${baseId}-legend`;
  const customPromptId = `${baseId}-custom-prompt`;

  const isCustom = value.id === "custom";
  const customPrompt = isCustom ? value.prompt : "";

  return (
    <fieldset
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/40"
      disabled={disabled}
      aria-labelledby={legendId}
      data-testid="meeting-template-selector"
    >
      <legend
        id={legendId}
        className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
      >
        회의록 형식
      </legend>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        출력 구조만 바꿉니다. 내용은 스크립트와 회의 정보를 따릅니다.
      </p>
      <div className="flex flex-col gap-2">
        {MEETING_MINUTES_TEMPLATE_OPTIONS.map((opt) => {
          const checked =
            opt.value === "custom"
              ? value.id === "custom"
              : value.id === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer gap-2 rounded-lg border border-transparent p-1.5 text-sm ${
                disabled
                  ? "cursor-not-allowed opacity-60"
                  : "hover:bg-white dark:hover:bg-zinc-800/80"
              }`}
            >
              <input
                type="radio"
                name={`${baseId}-meeting-template`}
                value={opt.value}
                checked={checked}
                disabled={disabled}
                data-testid={`meeting-template-${opt.value}`}
                onChange={() => {
                  if (opt.value === "custom") {
                    onChange({
                      id: "custom",
                      prompt: isCustom ? customPrompt : "",
                    });
                  } else {
                    onChange({ id: opt.value });
                  }
                }}
                className="mt-0.5"
              />
              <span className="text-zinc-800 dark:text-zinc-200">
                <span className="font-medium">{opt.label}</span>
                <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  {opt.hint}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {isCustom ? (
        <div className="flex flex-col gap-1">
          <label
            htmlFor={customPromptId}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            형식 지침 (Markdown 권장)
          </label>
          <textarea
            id={customPromptId}
            data-testid="meeting-template-custom-prompt"
            rows={5}
            disabled={disabled}
            value={customPrompt}
            onChange={(e) => onChange({ id: "custom", prompt: e.target.value })}
            placeholder={"## 요약\n## 논점\n- 항목은 스크립트 근거만\n## 결정"}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            아래 내용은 출력 형식·섹션 구성 지침으로만 사용됩니다. 회의 사실은
            스크립트와 회의 정보에서만 가져옵니다.
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}
