"use client";

import type { ReactNode } from "react";
import type { SessionContext } from "@/lib/glossary/types";
import { useId, useState } from "react";

export type SessionContextInputProps = {
  value: SessionContext;
  onChange: (next: SessionContext) => void;
  disabled?: boolean;
  topContent?: ReactNode;
};

export function SessionContextInput({
  value,
  onChange,
  disabled = false,
  topContent = null,
}: SessionContextInputProps) {
  const baseId = useId();
  const [open, setOpen] = useState(true);

  const patch = (partial: Partial<SessionContext>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      data-testid="session-context-input"
    >
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          회의 컨텍스트
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {open ? "접기" : "펼치기"}
        </span>
      </button>

      {open ? (
        <div className="mt-4 flex flex-col gap-4">
          {topContent}

          {disabled ? (
            <p
              className="text-xs text-zinc-600 dark:text-zinc-400"
              role="status"
            >
              회의록 생성 중에는 수정할 수 없습니다.
            </p>
          ) : null}

          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${baseId}-participants`}
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              참석자
            </label>
            <textarea
              id={`${baseId}-participants`}
              className="min-h-[72px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              value={value.participants}
              onChange={(e) => patch({ participants: e.target.value })}
              disabled={disabled}
              data-testid="session-context-participants"
              placeholder={"김지호 PM\n이나영 엔지니어"}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${baseId}-topic`}
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              주제
            </label>
            <input
              id={`${baseId}-topic`}
              type="text"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              value={value.topic}
              onChange={(e) => patch({ topic: e.target.value })}
              disabled={disabled}
              data-testid="session-context-topic"
              placeholder="2분기 제품 로드맵 및 출시 일정 점검"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${baseId}-keywords`}
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              키워드
            </label>
            <input
              id={`${baseId}-keywords`}
              type="text"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              value={value.keywords}
              onChange={(e) => patch({ keywords: e.target.value })}
              disabled={disabled}
              data-testid="session-context-keywords"
              placeholder="우선순위, 리스크, 의사결정, 액션 아이템"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
