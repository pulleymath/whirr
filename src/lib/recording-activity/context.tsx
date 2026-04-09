"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type RecordingActivityContextValue = {
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
};

const RecordingActivityContext =
  createContext<RecordingActivityContextValue | null>(null);

export function RecordingActivityProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const value = useMemo(() => ({ isRecording, setIsRecording }), [isRecording]);
  return (
    <RecordingActivityContext.Provider value={value}>
      {children}
    </RecordingActivityContext.Provider>
  );
}

export function useRecordingActivity(): RecordingActivityContextValue {
  const ctx = useContext(RecordingActivityContext);
  if (!ctx) {
    throw new Error(
      "useRecordingActivity must be used within RecordingActivityProvider",
    );
  }
  return ctx;
}
