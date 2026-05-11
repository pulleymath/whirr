"use client";

import { MEETING_MINUTES_MODEL_OPTIONS } from "@/lib/settings/options";

export type SessionMinutesModelSelectProps = {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
};

export function SessionMinutesModelSelect({
  value,
  onChange,
  disabled = false,
}: SessionMinutesModelSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="session-minutes-model"
        className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
      >
        요약 작성 모델
      </label>
      <select
        id="session-minutes-model"
        data-testid="session-minutes-model-select"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      >
        {MEETING_MINUTES_MODEL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
