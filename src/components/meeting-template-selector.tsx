"use client";

import { MEETING_MINUTES_TEMPLATE_OPTIONS } from "@/lib/meeting-minutes/templates";
import type { MeetingMinutesTemplate } from "@/lib/meeting-minutes/templates";
import { useId } from "react";

export type MeetingTemplateSelectorVariant = "fieldset" | "plain" | "select";

export type MeetingTemplateSelectorProps = {
  value: MeetingMinutesTemplate;
  onChange: (next: MeetingMinutesTemplate) => void;
  disabled?: boolean;
  /** `plain`은 테두리·배경을 줄여 노트 본문에 붙인다. `select`는 드롭다운 전용. */
  variant?: MeetingTemplateSelectorVariant;
};

const VARIANT_FIELDSET_CLASS: Record<"fieldset" | "plain", string> = {
  fieldset:
    "flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/40",
  plain: "flex flex-col gap-3 border-0 bg-transparent p-0 dark:bg-transparent",
};

export function MeetingTemplateSelector({
  value,
  onChange,
  disabled = false,
  variant = "fieldset",
}: MeetingTemplateSelectorProps) {
  const baseId = useId();
  const legendId = `${baseId}-legend`;
  const customPromptId = `${baseId}-custom-prompt`;
  const selectId = `${baseId}-meeting-template-select`;

  const isCustom = value.id === "custom";
  const customPrompt = isCustom ? value.prompt : "";

  const selectValue: (typeof MEETING_MINUTES_TEMPLATE_OPTIONS)[number]["value"] =
    value.id === "custom" ? "custom" : value.id;

  if (variant === "select") {
    return (
      <div className="flex flex-col gap-1">
        <select
          id={selectId}
          data-testid="meeting-template-selector"
          disabled={disabled}
          aria-label="요약 형식"
          value={selectValue}
          onChange={(e) => {
            const next = e.target
              .value as (typeof MEETING_MINUTES_TEMPLATE_OPTIONS)[number]["value"];
            if (next === "custom") {
              onChange({
                id: "custom",
                prompt: isCustom ? customPrompt : "",
              });
            } else {
              onChange({ id: next });
            }
          }}
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          {MEETING_MINUTES_TEMPLATE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          출력 구조만 바꿉니다. 내용은 스크립트와 회의 정보를 따릅니다.
        </p>
      </div>
    );
  }

  return (
    <fieldset
      className={VARIANT_FIELDSET_CLASS[variant]}
      disabled={disabled}
      aria-labelledby={legendId}
      data-testid="meeting-template-selector"
    >
      <legend
        id={legendId}
        className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
      >
        요약 형식
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
