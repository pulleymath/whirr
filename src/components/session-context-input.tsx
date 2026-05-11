"use client";

import type { ReactNode } from "react";
import type { SessionContext } from "@/lib/glossary/types";
import { useId, useState } from "react";

export type SessionContextInputVariant = "card" | "embedded";

export type SessionContextInputProps = {
  value: SessionContext;
  onChange: (next: SessionContext) => void;
  disabled?: boolean;
  topContent?: ReactNode;
  /** `embedded`는 노트 작업면 안에서 카드 느낌을 줄인다. */
  variant?: SessionContextInputVariant;
  /** 루트 `section`에 추가 클래스(레이아웃·여백 조정용). */
  className?: string;
};

const VARIANT_SECTION_CLASS: Record<SessionContextInputVariant, string> = {
  card: "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
  embedded:
    "rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40",
};

export function SessionContextInput({
  value,
  onChange,
  disabled = false,
  topContent = null,
  variant = "card",
  className = "",
}: SessionContextInputProps) {
  const baseId = useId();
  const [open, setOpen] = useState(true);

  const patch = (partial: Partial<SessionContext>) => {
    onChange({ ...value, ...partial });
  };

  const sectionClass = `${VARIANT_SECTION_CLASS[variant]} ${className}`.trim();

  return (
    <section className={sectionClass} data-testid="session-context-input">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          회의 정보
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
              요약 생성 중에는 수정할 수 없습니다.
            </p>
          ) : null}

          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${baseId}-participants`}
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              참석자
            </label>
            <input
              id={`${baseId}-participants`}
              type="text"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              value={value.participants}
              onChange={(e) => patch({ participants: e.target.value })}
              disabled={disabled}
              data-testid="session-context-participants"
              placeholder="고풀리 PM, 이풀리 엔지니어"
              autoComplete="off"
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
