"use client";

import { type LucideIcon } from "lucide-react";

const VARIANT_CLASSES: Record<"ghost" | "outline" | "primary", string> = {
  ghost:
    "border-transparent bg-transparent text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900",
  outline:
    "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
  primary:
    "border-transparent bg-sky-600 text-white hover:bg-sky-500 dark:bg-sky-600 dark:hover:bg-sky-500",
};

export type IconButtonProps = {
  icon: LucideIcon;
  /** 접근성용 라벨 (아이콘만 있을 때 필수) */
  ariaLabel: string;
  /** 있으면 아이콘 옆에 텍스트 */
  label?: string;
  variant?: "ghost" | "outline" | "primary";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  /** Lucide 아이콘에 추가 클래스 (예: animate-spin) */
  iconClassName?: string;
  type?: "button" | "submit";
};

export function IconButton({
  icon: Icon,
  ariaLabel,
  label,
  variant = "outline",
  disabled,
  onClick,
  className = "",
  iconClassName = "",
  type = "button",
}: IconButtonProps) {
  const base =
    "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${VARIANT_CLASSES[variant]} ${className}`.trim()}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${iconClassName}`.trim()}
        aria-hidden
      />
      {label ? <span>{label}</span> : null}
    </button>
  );
}
