"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { GlobalGlossary } from "./types";

export const GLOSSARY_STORAGE_KEY = "whirr:global-glossary";

const DEFAULT_GLOSSARY: GlobalGlossary = { terms: [] };

function parseGlobalGlossary(raw: unknown): GlobalGlossary {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_GLOSSARY;
  }
  const terms = (raw as { terms?: unknown }).terms;
  if (!Array.isArray(terms)) {
    return DEFAULT_GLOSSARY;
  }
  const cleaned = terms.filter((t): t is string => typeof t === "string");
  return { terms: cleaned };
}

type GlossaryContextValue = {
  glossary: GlobalGlossary;
  updateGlossary: (terms: string[]) => void;
};

const GlossaryContext = createContext<GlossaryContextValue | null>(null);

export function GlossaryProvider({ children }: { children: ReactNode }) {
  const [glossary, setGlossary] = useState<GlobalGlossary>(DEFAULT_GLOSSARY);

  /* eslint-disable react-hooks/set-state-in-effect -- 외부 저장소 → React 상태 동기화 */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GLOSSARY_STORAGE_KEY);
      if (raw == null || raw === "") {
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      setGlossary(parseGlobalGlossary(parsed));
    } catch {
      setGlossary(DEFAULT_GLOSSARY);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const updateGlossary = useCallback((terms: string[]) => {
    const next: GlobalGlossary = { terms: [...terms] };
    setGlossary(next);
    try {
      localStorage.setItem(GLOSSARY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const value = useMemo(
    () => ({ glossary, updateGlossary }),
    [glossary, updateGlossary],
  );

  return (
    <GlossaryContext.Provider value={value}>
      {children}
    </GlossaryContext.Provider>
  );
}

export function useGlossary(): GlossaryContextValue {
  const ctx = useContext(GlossaryContext);
  if (!ctx) {
    throw new Error("useGlossary must be used within GlossaryProvider");
  }
  return ctx;
}
