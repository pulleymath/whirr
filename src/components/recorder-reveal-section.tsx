"use client";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { ReactNode } from "react";

export type RevealSectionProps = {
  visible: boolean;
  testId: string;
  children: ReactNode;
};

/** 세로 간격은 루트 `gap` 대신 `mt-6`로 두어, `h-0` 숨김 래퍼가 flex gap 빈틈을 남기지 않게 한다. */
export function RevealSection({
  visible,
  testId,
  children,
}: RevealSectionProps) {
  const reducedMotion = usePrefersReducedMotion();

  const className = reducedMotion
    ? visible
      ? "mt-6 overflow-visible opacity-100"
      : "pointer-events-none mt-0 h-0 max-h-0 overflow-hidden opacity-0"
    : visible
      ? "mt-6 translate-y-0 overflow-visible opacity-100 blur-0 motion-safe:transition-[opacity,transform,filter] motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none"
      : "pointer-events-none mt-0 h-0 max-h-0 translate-y-2 overflow-hidden opacity-0 blur-sm motion-safe:transition-[opacity,transform,filter] motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none";

  return (
    <div
      data-testid={testId}
      aria-hidden={visible ? undefined : true}
      inert={visible ? undefined : true}
      className={className}
    >
      {children}
    </div>
  );
}
