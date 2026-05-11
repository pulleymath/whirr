"use client";

import type { MeetingContext, SessionContext } from "@/lib/glossary/types";
import { updateSession } from "@/lib/db";
import {
  DEFAULT_MEETING_MINUTES_TEMPLATE,
  resolveMeetingMinutesTemplate,
  type MeetingMinutesTemplate,
} from "@/lib/meeting-minutes/templates";
import { buildScriptMeta } from "@/lib/session-script-meta";
import type { RealtimeEngine, TranscriptionMode } from "@/lib/settings/types";
import {
  transcribeBlobWithRetries,
  userFacingTranscribeError,
} from "@/lib/transcribe-segment";
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
  /** 요약 생성에 사용할 Chat 모델 id */
  meetingMinutesModel: string;
  glossary?: string[];
  sessionContext?: SessionContext | null;
  /** 요약 출력 형식. 생략 시 기본회의 */
  meetingTemplate?: MeetingMinutesTemplate;
  /** 녹음 시점 스크립트 모드 */
  mode: TranscriptionMode;
  /** mode가 realtime일 때 엔진 */
  engine?: RealtimeEngine;
};

export type PostRecordingPipelinePhase =
  | "idle"
  | "transcribing"
  | "summarizing"
  | "done"
  | "error";

export type PostRecordingPipelineContextValue = {
  phase: PostRecordingPipelinePhase;
  isBusy: boolean;
  errorMessage: string | null;
  summaryText: string | null;
  /** 홈 스크립트 영역에 보여 줄 문자열(파이프라인 진행 중·완료 직후) */
  displayTranscript: string | null;
  /** 요약이 완료된 세션 id (idle 리셋 전까지 유지, 토스트 네비게이션용) */
  completedSessionId: string | null;
  enqueue: (input: PostRecordingPipelineEnqueueInput) => void;
};

/** 테스트·고급 조합용. 일반 코드는 `usePostRecordingPipeline`만 사용한다. */
export const PostRecordingPipelineContext =
  createContext<PostRecordingPipelineContextValue | null>(null);

const IDLE_RESET_MS = 2500;

function buildMeetingContextForPersistence(
  input: PostRecordingPipelineEnqueueInput,
): MeetingContext {
  return {
    glossary: input.glossary ?? [],
    sessionContext: input.sessionContext ?? null,
    template: resolveMeetingMinutesTemplate(
      input.meetingTemplate ?? DEFAULT_MEETING_MINUTES_TEMPLATE,
    ),
  };
}

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
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  /** 현재 `runPipeline`에서 처리 중인 세션 id(중복 enqueue 판별용) */
  const currentSessionIdRef = useRef<string | null>(null);
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
      currentSessionIdRef.current = input.sessionId;
      clearIdleTimer();
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const { signal } = ac;

      setErrorMessage(null);
      setSummaryText(null);
      setCompletedSessionId(null);
      setDisplayTranscript(input.partialText.trim() || null);
      setPhase("transcribing");

      const continueOrIdle = () => {
        const next = pendingRef.current.shift();
        if (next) {
          runPipelineRef.current(next);
        } else {
          inFlightRef.current = false;
          currentSessionIdRef.current = null;
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
              setCompletedSessionId(null);
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
              glossary: input.glossary,
              sessionContext: input.sessionContext,
              template: resolveMeetingMinutesTemplate(
                input.meetingTemplate ?? DEFAULT_MEETING_MINUTES_TEMPLATE,
              ),
            }),
            signal,
          });
          if (signal.aborted) {
            return;
          }
          if (!res.ok) {
            await updateSession(input.sessionId, { status: "error" });
            setErrorMessage("요약을 생성하지 못했습니다.");
            setPhase("error");
            setCompletedSessionId(null);
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
          const persistedContext = buildMeetingContextForPersistence(input);
          const scriptMeta = buildScriptMeta({
            mode: input.mode,
            realtimeEngine: input.engine ?? "openai",
            batchModel: input.model,
            language: input.language,
            meetingMinutesModel: input.meetingMinutesModel,
          });
          await updateSession(input.sessionId, {
            summary,
            status: "ready",
            context: persistedContext,
            scriptMeta,
          });
          setSummaryText(summary);
          setCompletedSessionId(input.sessionId);
          setPhase("done");
          idleTimerRef.current = setTimeout(() => {
            setPhase("idle");
            setDisplayTranscript(null);
            setCompletedSessionId(null);
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
          setCompletedSessionId(null);
          continueOrIdle();
        }
      })();
    };
  }, [clearIdleTimer]);

  const enqueue = useCallback((input: PostRecordingPipelineEnqueueInput) => {
    if (
      inFlightRef.current &&
      currentSessionIdRef.current === input.sessionId
    ) {
      return;
    }
    if (pendingRef.current.some((p) => p.sessionId === input.sessionId)) {
      return;
    }
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
      completedSessionId,
      enqueue,
    }),
    [
      phase,
      errorMessage,
      summaryText,
      displayTranscript,
      completedSessionId,
      enqueue,
    ],
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
