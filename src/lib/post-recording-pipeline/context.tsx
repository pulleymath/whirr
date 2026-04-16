"use client";

import {
  transcribeBlobWithRetries,
  userFacingTranscribeError,
} from "@/lib/transcribe-segment";
import { updateSession } from "@/lib/db";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type PostRecordingPipelineEnqueueInput = {
  sessionId: string;
  partialText: string;
  finalBlob: Blob | null;
  model: string;
  language: string;
  /** 회의록 생성에 사용할 Chat 모델 id */
  meetingMinutesModel: string;
};

export type PostRecordingPipelinePhase =
  | "idle"
  | "transcribing"
  | "summarizing"
  | "done"
  | "error";

type PostRecordingPipelineContextValue = {
  phase: PostRecordingPipelinePhase;
  isBusy: boolean;
  errorMessage: string | null;
  summaryText: string | null;
  /** 홈 전사 영역에 보여 줄 문자열(파이프라인 진행 중·완료 직후) */
  displayTranscript: string | null;
  enqueue: (input: PostRecordingPipelineEnqueueInput) => void;
};

const PostRecordingPipelineContext =
  createContext<PostRecordingPipelineContextValue | null>(null);

const IDLE_RESET_MS = 2500;

export function PostRecordingPipelineProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<PostRecordingPipelinePhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [displayTranscript, setDisplayTranscript] = useState<string | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const pendingRef = useRef<PostRecordingPipelineEnqueueInput[]>([]);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current != null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      clearIdleTimer();
    };
  }, [clearIdleTimer]);

  const runPipelineRef = useRef<
    (input: PostRecordingPipelineEnqueueInput) => void
  >(() => {});

  useLayoutEffect(() => {
    runPipelineRef.current = (input: PostRecordingPipelineEnqueueInput) => {
      inFlightRef.current = true;
      clearIdleTimer();
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const { signal } = ac;

      setErrorMessage(null);
      setSummaryText(null);
      setDisplayTranscript(input.partialText.trim() || null);
      setPhase("transcribing");

      const continueOrIdle = () => {
        const next = pendingRef.current.shift();
        if (next) {
          runPipelineRef.current(next);
        } else {
          inFlightRef.current = false;
        }
      };

      void (async () => {
        try {
          let fullText = input.partialText.trim();
          if (input.finalBlob && input.finalBlob.size > 0) {
            const tr = await transcribeBlobWithRetries(input.finalBlob, {
              model: input.model,
              language: input.language,
              signal,
            });
            if (signal.aborted) {
              return;
            }
            if (!tr.ok) {
              await updateSession(input.sessionId, { status: "error" });
              setErrorMessage(userFacingTranscribeError(tr.errRaw));
              setPhase("error");
              continueOrIdle();
              return;
            }
            const piece = tr.text.trim();
            fullText = [fullText, piece].filter(Boolean).join(" ");
          }

          await updateSession(input.sessionId, {
            text: fullText,
            status: "summarizing",
          });
          setDisplayTranscript(fullText);
          setPhase("summarizing");

          const res = await fetch("/api/meeting-minutes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: fullText,
              model: input.meetingMinutesModel,
            }),
            signal,
          });
          if (signal.aborted) {
            return;
          }
          if (!res.ok) {
            await updateSession(input.sessionId, { status: "error" });
            setErrorMessage("회의록을 생성하지 못했습니다.");
            setPhase("error");
            continueOrIdle();
            return;
          }
          const data: unknown = await res.json();
          const summary =
            data &&
            typeof data === "object" &&
            data !== null &&
            "summary" in data &&
            typeof (data as { summary: unknown }).summary === "string"
              ? (data as { summary: string }).summary
              : "";
          await updateSession(input.sessionId, {
            summary,
            status: "ready",
          });
          setSummaryText(summary);
          setPhase("done");
          idleTimerRef.current = setTimeout(() => {
            setPhase("idle");
            setDisplayTranscript(null);
            idleTimerRef.current = null;
            continueOrIdle();
          }, IDLE_RESET_MS);
        } catch (e) {
          if (signal.aborted) {
            return;
          }
          console.error("[post-recording-pipeline]", e);
          try {
            await updateSession(input.sessionId, { status: "error" });
          } catch {
            /* ignore */
          }
          setErrorMessage("처리 중 오류가 발생했습니다.");
          setPhase("error");
          continueOrIdle();
        }
      })();
    };
  }, [clearIdleTimer]);

  const enqueue = useCallback((input: PostRecordingPipelineEnqueueInput) => {
    if (inFlightRef.current) {
      pendingRef.current.push(input);
      return;
    }
    runPipelineRef.current(input);
  }, []);

  const value = useMemo(
    () => ({
      phase,
      isBusy:
        phase === "transcribing" || phase === "summarizing" || phase === "done",
      errorMessage,
      summaryText,
      displayTranscript,
      enqueue,
    }),
    [phase, errorMessage, summaryText, displayTranscript, enqueue],
  );

  return (
    <PostRecordingPipelineContext.Provider value={value}>
      {children}
    </PostRecordingPipelineContext.Provider>
  );
}

export function usePostRecordingPipeline(): PostRecordingPipelineContextValue {
  const ctx = useContext(PostRecordingPipelineContext);
  if (!ctx) {
    throw new Error(
      "usePostRecordingPipeline must be used within PostRecordingPipelineProvider",
    );
  }
  return ctx;
}
