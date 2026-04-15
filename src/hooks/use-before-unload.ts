"use client";

import { useEffect } from "react";

/**
 * `active`일 때 탭 닫기·새로고침 등에 브라우저 기본 확인을 띄운다.
 */
export function useBeforeUnload(active: boolean): void {
  useEffect(() => {
    if (!active || typeof window === "undefined") {
      return;
    }
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
