"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import {
  getSessionAudio,
  getSessionById,
  updateSession,
  type Session,
} from "@/lib/db";
import { MainTranscriptTabs } from "@/components/main-transcript-tabs";
import { MeetingMinutesMarkdown } from "@/components/meeting-minutes-markdown";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
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
          className="w-fit cursor-pointer text-sm font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
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
          <Button variant="primary" onClick={onRetry}>
            다시 시도
          </Button>
          <Link
            href="/"
            className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
      audioSegments={audioSegments}
      isDownloading={isDownloading}
      setIsDownloading={setIsDownloading}
      onSessionRefresh={refreshSession}
    />
  );
}

function SessionDetailReadyContent({
  session,
  audioSegments,
  isDownloading,
  setIsDownloading,
  onSessionRefresh,
}: {
  session: Session;
  audioSegments: Blob[];
  isDownloading: boolean;
  setIsDownloading: (v: boolean) => void;
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
      {session.summary ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <IconButton
            icon={copiedSummary ? Check : Copy}
            ariaLabel="회의록 전체 복사"
            label={copiedSummary ? "복사됨" : undefined}
            variant="outline"
            onClick={() => void copySummaryMarkdown()}
          />
          <IconButton
            icon={mmLoading ? Loader2 : RefreshCw}
            ariaLabel="다시 생성"
            label={mmLoading ? "생성 중…" : undefined}
            variant="outline"
            disabled={mmLoading || !hasText}
            iconClassName={mmLoading ? "animate-spin" : ""}
            onClick={() => void handleMeetingMinutes()}
          />
        </div>
      ) : null}
      {session.summary ? (
        <div className="mt-4 text-sm leading-relaxed">
          <MeetingMinutesMarkdown markdown={session.summary} />
        </div>
      ) : hasText ? (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            아직 회의록이 없습니다.
          </p>
          <IconButton
            icon={mmLoading ? Loader2 : Sparkles}
            ariaLabel="회의록 생성"
            label={mmLoading ? "생성 중…" : "회의록 생성"}
            variant="primary"
            disabled={mmLoading}
            iconClassName={mmLoading ? "animate-spin" : ""}
            className="w-fit"
            onClick={() => void handleMeetingMinutes()}
          />
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
      <div className="flex flex-wrap items-center justify-end gap-2">
        <IconButton
          icon={copiedScript ? Check : Copy}
          ariaLabel="스크립트 텍스트 복사"
          label={copiedScript ? "복사됨" : undefined}
          variant="outline"
          disabled={!scriptDraft.trim()}
          onClick={() => void copyScript()}
        />
        <IconButton
          icon={scriptSaving ? Loader2 : Save}
          ariaLabel="스크립트 저장"
          label={scriptSaving ? "저장 중…" : undefined}
          variant="primary"
          disabled={!scriptDirty || scriptSaving}
          iconClassName={scriptSaving ? "animate-spin" : ""}
          onClick={() => void handleSaveScript()}
        />
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
      {audioSegments.length > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <IconButton
            icon={isDownloading ? Loader2 : Download}
            ariaLabel="오디오 다운로드"
            label={isDownloading ? "다운로드 중..." : "오디오 다운로드"}
            variant="primary"
            disabled={isDownloading}
            iconClassName={isDownloading ? "animate-spin" : ""}
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
          />
        </div>
      ) : null}

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
          className="w-fit cursor-pointer text-sm font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
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
