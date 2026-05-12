"use client";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { ReactNode } from "react";

export type RevealSectionProps = {
  visible: boolean;
  testId: string;
  children: ReactNode;
};

/** 숨김 시 `h-0`로 레이아웃에 빈틈을 남기지 않는다. 세로 간격은 부모 `NoteDocumentLayout`의 `gap`에 맡긴다. */
export function RevealSection({
  visible,
  testId,
  children,
}: RevealSectionProps) {
  const reducedMotion = usePrefersReducedMotion();

  const className = reducedMotion
    ? visible
      ? "overflow-visible opacity-100"
      : "pointer-events-none h-0 max-h-0 overflow-hidden opacity-0"
    : visible
      ? "translate-y-0 overflow-visible opacity-100 blur-0 motion-safe:transition-[opacity,transform,filter] motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none"
      : "pointer-events-none h-0 max-h-0 translate-y-2 overflow-hidden opacity-0 blur-sm motion-safe:transition-[opacity,transform,filter] motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none";

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
