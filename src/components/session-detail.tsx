"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSessionAudio,
  getSessionById,
  updateSession,
  type Session,
} from "@/lib/db";
import { MainTranscriptTabs } from "@/components/main-transcript-tabs";
import { MeetingMinutesMarkdown } from "@/components/meeting-minutes-markdown";
import { downloadRecordingSegments } from "@/lib/download-recording";
import { fetchMeetingMinutesSummary } from "@/lib/meeting-minutes/fetch-meeting-minutes-client";
import { useSettings } from "@/lib/settings/context";

type DetailState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; session: Session; audioSegments: Blob[] };

function SessionDetailBody({
  id,
  onRetry,
}: {
  id: string;
  onRetry: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [isDownloading, setIsDownloading] = useState(false);

  /** 저장 후 화면 갱신용. 실패 시 전역 오류 화면 대신 false를 반환한다(호출부에서 회의록 영역 오류 처리). */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const [row, audioRow] = await Promise.all([
        getSessionById(id),
        getSessionAudio(id),
      ]);
      if (row) {
        setState({
          status: "ready",
          session: row,
          audioSegments: audioRow?.segments ?? [],
        });
        return true;
      }
      setState({ status: "missing" });
      return false;
    } catch {
      return false;
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [row, audioRow] = await Promise.all([
          getSessionById(id),
          getSessionAudio(id),
        ]);
        if (cancelled) {
          return;
        }
        if (row) {
          setState({
            status: "ready",
            session: row,
            audioSegments: audioRow?.segments ?? [],
          });
        } else {
          setState({ status: "missing" });
        }
      } catch {
        if (!cancelled) {
          setState({ status: "error" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const { session, audioSegments } =
    state.status === "ready" ? state : { session: null, audioSegments: [] };

  const audioUrl = useMemo(() => {
    if (audioSegments.length > 0) {
      return URL.createObjectURL(
        new Blob(audioSegments, { type: "audio/webm" }),
      );
    }
    return null;
  }, [audioSegments]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  if (state.status === "loading") {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">불러오는 중…</p>
    );
  }

  if (state.status === "missing") {
    return (
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <p className="text-zinc-800 dark:text-zinc-200">
          세션을 찾을 수 없습니다.
        </p>
        <Link
          href="/"
          className="w-fit text-sm font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
        >
          홈으로
        </Link>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <p className="text-zinc-800 dark:text-zinc-200" role="alert">
          세션을 불러오지 못했습니다.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            홈으로
          </Link>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <SessionDetailReadyContent
      session={session}
      audioUrl={audioUrl}
      audioSegments={audioSegments}
      isDownloading={isDownloading}
      setIsDownloading={setIsDownloading}
      onBack={() => router.back()}
      onSessionRefresh={refreshSession}
    />
  );
}

function SessionDetailReadyContent({
  session,
  audioUrl,
  audioSegments,
  isDownloading,
  setIsDownloading,
  onBack,
  onSessionRefresh,
}: {
  session: Session;
  audioUrl: string | null;
  audioSegments: Blob[];
  isDownloading: boolean;
  setIsDownloading: (v: boolean) => void;
  onBack: () => void;
  onSessionRefresh: () => Promise<boolean>;
}) {
  const { settings } = useSettings();
  const [scriptDraft, setScriptDraft] = useState(session.text);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [scriptSaving, setScriptSaving] = useState(false);
  const [scriptSaveError, setScriptSaveError] = useState<string | null>(null);
  const [mmLoading, setMmLoading] = useState(false);
  const [mmError, setMmError] = useState<string | null>(null);

  useEffect(() => {
    setScriptDraft(session.text);
  }, [session.id, session.text]);

  const copyScript = useCallback(async () => {
    const t = scriptDraft.trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(scriptDraft);
      setCopiedScript(true);
      window.setTimeout(() => setCopiedScript(false), 1500);
    } catch {
      /* ignore */
    }
  }, [scriptDraft]);

  const copySummaryMarkdown = useCallback(async () => {
    const s = session.summary?.trim();
    if (!s) return;
    try {
      await navigator.clipboard.writeText(session.summary ?? "");
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 1500);
    } catch {
      /* ignore */
    }
  }, [session.summary]);

  const hasText = scriptDraft.trim().length > 0;
  const scriptDirty = scriptDraft !== session.text;

  const handleSaveScript = useCallback(async () => {
    if (!scriptDirty) return;
    setScriptSaving(true);
    setScriptSaveError(null);
    try {
      await updateSession(session.id, { text: scriptDraft, status: "ready" });
      const refreshed = await onSessionRefresh();
      if (!refreshed) {
        setScriptSaveError(
          "저장 후 화면을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
    } catch (e) {
      console.error(e);
      setScriptSaveError("스크립트를 저장하지 못했습니다.");
    } finally {
      setScriptSaving(false);
    }
  }, [onSessionRefresh, scriptDirty, scriptDraft, session.id]);

  const handleMeetingMinutes = useCallback(async () => {
    const t = scriptDraft.trim();
    if (!t) return;
    setMmLoading(true);
    setMmError(null);
    try {
      const summary = await fetchMeetingMinutesSummary(
        t,
        settings.meetingMinutesModel,
      );
      await updateSession(session.id, { summary, status: "ready" });
      const refreshed = await onSessionRefresh();
      if (!refreshed) {
        setMmError(
          "저장 후 화면을 불러오지 못했습니다. 잠시 후 다시 시도하거나 세션 목록에서 다시 열어 주세요.",
        );
      }
    } catch (e) {
      console.error(e);
      setMmError("회의록을 만들지 못했습니다.");
    } finally {
      setMmLoading(false);
    }
  }, [onSessionRefresh, session.id, scriptDraft, settings.meetingMinutesModel]);

  const summaryPanel = (
    <div
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      role="region"
      aria-label="회의록"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          회의록
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {session.summary ? (
            <>
              <button
                type="button"
                onClick={() => void copySummaryMarkdown()}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                aria-label="회의록 전체 복사"
              >
                {copiedSummary ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    복사됨
                  </span>
                ) : (
                  "전체 복사"
                )}
              </button>
              <button
                type="button"
                disabled={mmLoading || !hasText}
                onClick={() => void handleMeetingMinutes()}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {mmLoading ? "생성 중…" : "다시 생성"}
              </button>
            </>
          ) : null}
        </div>
      </div>
      {session.summary ? (
        <div className="mt-4 text-sm leading-relaxed">
          <MeetingMinutesMarkdown markdown={session.summary} />
        </div>
      ) : hasText ? (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            아직 회의록이 없습니다.
          </p>
          <button
            type="button"
            disabled={mmLoading}
            onClick={() => void handleMeetingMinutes()}
            className="w-fit rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {mmLoading ? "생성 중…" : "회의록 생성"}
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          스크립트가 비어 있으면 회의록을 만들 수 없습니다.
        </p>
      )}
      {mmError ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {mmError}
        </p>
      ) : null}
    </div>
  );

  const transcriptPanel = (
    <div
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      role="region"
      aria-label="스크립트"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          스크립트
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!scriptDraft.trim()}
            onClick={() => void copyScript()}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            aria-label="스크립트 텍스트 복사"
          >
            {copiedScript ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                복사됨
              </span>
            ) : (
              "복사"
            )}
          </button>
          <button
            type="button"
            disabled={!scriptDirty || scriptSaving}
            onClick={() => void handleSaveScript()}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {scriptSaving ? "저장 중…" : "스크립트 저장"}
          </button>
        </div>
      </div>
      <textarea
        id={`session-script-${session.id}`}
        data-testid="session-detail-script-textarea"
        value={scriptDraft}
        onChange={(e) => setScriptDraft(e.target.value)}
        rows={14}
        spellCheck={false}
        aria-label="스크립트 편집"
        className="mt-4 min-h-[12rem] w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-sm leading-relaxed text-zinc-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      />
      {scriptDirty ? (
        <p
          className="mt-2 text-xs text-amber-800 dark:text-amber-200/90"
          role="status"
        >
          저장하지 않은 내용은 회의록 생성·재생성에 반영됩니다. 세션 목록 등에
          맞추려면 스크립트 저장을 눌러 주세요.
        </p>
      ) : null}
      {scriptSaveError ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {scriptSaveError}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          뒤로
        </button>

        <div className="flex items-center gap-3">
          {audioUrl && (
            <audio
              src={audioUrl}
              controls
              className="h-9 w-48 sm:w-64"
              aria-label="오디오 재생"
            />
          )}

          {audioSegments.length > 0 && (
            <button
              type="button"
              disabled={isDownloading}
              onClick={async () => {
                setIsDownloading(true);
                try {
                  await downloadRecordingSegments(
                    audioSegments,
                    `session-${session.id}`,
                  );
                } finally {
                  setIsDownloading(false);
                }
              }}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {isDownloading ? "다운로드 중..." : "오디오 다운로드"}
            </button>
          )}
        </div>
      </div>

      <MainTranscriptTabs
        key={session.id}
        defaultActive="summary"
        tabOrder="summary-first"
        summaryPanel={summaryPanel}
        transcriptPanel={transcriptPanel}
      />
    </div>
  );
}

export function SessionDetail() {
  const params = useParams();
  const rawId = params?.id;
  const id =
    typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";

  const [retryToken, setRetryToken] = useState(0);

  if (!id) {
    return (
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <p className="text-zinc-800 dark:text-zinc-200">
          세션을 찾을 수 없습니다.
        </p>
        <Link
          href="/"
          className="w-fit text-sm font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
        >
          홈으로
        </Link>
      </div>
    );
  }

  return (
    <SessionDetailBody
      key={`${id}-${retryToken}`}
      id={id}
      onRetry={() => setRetryToken((t) => t + 1)}
    />
  );
}
