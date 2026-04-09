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
import {
  DEFAULT_TRANSCRIPTION_SETTINGS,
  parseTranscriptionSettings,
  type TranscriptionSettings,
} from "./types";

export const SETTINGS_STORAGE_KEY = "whirr:transcription-settings";

type SettingsContextValue = {
  settings: TranscriptionSettings;
  updateSettings: (patch: Partial<TranscriptionSettings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<TranscriptionSettings>(
    DEFAULT_TRANSCRIPTION_SETTINGS,
  );

  /* localStorage는 마운트 후에만 읽어 SSR·하이드레이션과 맞춘다. */
  /* eslint-disable react-hooks/set-state-in-effect -- 외부 저장소 → React 상태 동기화 */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw == null || raw === "") {
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      setSettings(parseTranscriptionSettings(parsed));
    } catch {
      setSettings(DEFAULT_TRANSCRIPTION_SETTINGS);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const updateSettings = useCallback(
    (patch: Partial<TranscriptionSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore quota / private mode */
        }
        return next;
      });
    },
    [],
  );

  const value = useMemo(
    () => ({ settings, updateSettings }),
    [settings, updateSettings],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}
