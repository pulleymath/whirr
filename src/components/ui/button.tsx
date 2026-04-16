"use client";

import { type ReactNode } from "react";

const VARIANT_CLASSES: Record<"primary" | "outline" | "ghost", string> = {
  primary:
    "border-transparent bg-emerald-600 text-white hover:bg-emerald-500 disabled:hover:bg-emerald-600",
  outline:
    "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
  ghost:
    "border-transparent bg-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
};

export type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "outline" | "ghost";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
  "aria-label"?: string;
};

export function Button({
  children,
  variant = "primary",
  disabled,
  onClick,
  className = "",
  type = "button",
  "aria-label": ariaLabel,
}: ButtonProps) {
  const base =
    "inline-flex cursor-pointer items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${VARIANT_CLASSES[variant]} ${className}`.trim()}
    >
      {children}
    </button>
  );
}
