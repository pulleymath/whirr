"use client";

import { MeetingMinutesMarkdown } from "@/components/meeting-minutes-markdown";
import {
  NoteDocumentHeader,
  NoteDocumentLayout,
} from "@/components/note-document-shell";
import {
  NOTE_TAB_BUTTON_BASE,
  NOTE_TAB_SURFACE_PAGE_SCROLL_CLASS,
} from "@/components/recorder-note-workspace";
import {
  SessionEditDialog,
  type SessionEditSnapshot,
  persistSessionEditSnapshot,
} from "@/components/session-edit-dialog";
import { SessionPropertyRowsReadOnly } from "@/components/session-property-rows";
import { SessionScriptMetaDisplay } from "@/components/session-script-meta-display";
import { TranscriptView } from "@/components/transcript-view";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  createSessionWithContext,
  getSessionAudio,
  getSessionById,
  updateSession,
  type Session,
} from "@/lib/db";
import {
  downloadRecordingAudio,
  downloadRecordingZip,
} from "@/lib/download-recording";
import type { SessionContext } from "@/lib/glossary/types";
import { sessionContextForApi } from "@/lib/session-context-for-api";
import { fetchMeetingMinutesSummary } from "@/lib/meeting-minutes/fetch-meeting-minutes-client";
import {
  DEFAULT_MEETING_MINUTES_TEMPLATE,
  resolveMeetingMinutesTemplate,
} from "@/lib/meeting-minutes/templates";
import {
  DEFAULT_MEETING_MINUTES_MODEL,
  isAllowedMeetingMinutesModelId,
} from "@/lib/settings/types";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { Check, Copy, Download, Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";

const EMPTY_SESSION_CONTEXT: SessionContext = {
  participants: "",
  topic: "",
  keywords: "",
};

/** 라우트 `id` 세그먼트를 세션 id로 안전히 해석한다. 잘못된 퍼센트 인코딩이면 `null`. */
function parseRouteSessionId(rawId: unknown): string | null {
  const rawStr =
    typeof rawId === "string"
      ? rawId
      : Array.isArray(rawId)
        ? (rawId[0] ?? "")
        : "";
  if (!rawStr) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(rawStr);
    return decoded.trim() === "" ? null : decoded;
  } catch {
    return null;
  }
}

type DetailState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | {
      status: "ready";
      session: Session;
      audioSegments: Blob[];
      audioFullBlob: Blob | null;
    };

type NoteWorkspaceTab = "summary" | "script";

function SessionDetailBody({
  id,
  onRetry,
}: {
  id: string;
  onRetry: () => void;
}) {
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [isDownloading, setIsDownloading] = useState(false);

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
          audioFullBlob: audioRow?.fullBlob ?? null,
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
            audioFullBlob: audioRow?.fullBlob ?? null,
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

  const { session, audioSegments, audioFullBlob } =
    state.status === "ready"
      ? state
      : { session: null, audioSegments: [], audioFullBlob: null };

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
          className="w-fit cursor-pointer text-sm font-medium text-sky-500 hover:text-sky-400"
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
      audioFullBlob={audioFullBlob}
      isDownloading={isDownloading}
      setIsDownloading={setIsDownloading}
      onSessionRefresh={refreshSession}
    />
  );
}

function SessionDetailReadyContent({
  session,
  audioSegments,
  audioFullBlob,
  isDownloading,
  setIsDownloading,
  onSessionRefresh,
}: {
  session: Session;
  audioSegments: Blob[];
  audioFullBlob: Blob | null;
  isDownloading: boolean;
  setIsDownloading: (v: boolean) => void;
  onSessionRefresh: () => Promise<boolean>;
}) {
  const baseId = useId();
  const [activeTab, setActiveTab] = useState<NoteWorkspaceTab>("summary");
  const [editOpen, setEditOpen] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [mmLoading, setMmLoading] = useState(false);
  const [mmError, setMmError] = useState<string | null>(null);
  const [forkedSessionId, setForkedSessionId] = useState<string | null>(null);
  useBeforeUnload(mmLoading);

  const summaryPanelId = `${baseId}-tabpanel-summary`;
  const scriptPanelId = `${baseId}-tabpanel-script`;
  const summaryTabId = `${baseId}-tab-summary`;
  const scriptTabId = `${baseId}-tab-script`;

  const meetingTemplate =
    session.context?.template ?? DEFAULT_MEETING_MINUTES_TEMPLATE;
  const sessionContext =
    session.context?.sessionContext ?? EMPTY_SESSION_CONTEXT;

  const copyScript = useCallback(async () => {
    const t = session.text.trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(session.text);
      setCopiedScript(true);
      window.setTimeout(() => setCopiedScript(false), 1500);
    } catch {
      /* ignore */
    }
  }, [session.text]);

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

  const hasText = session.text.trim().length > 0;

  const runMeetingMinutesFromSnapshot = useCallback(
    async (snap: SessionEditSnapshot, mode: "current" | "new") => {
      const t = snap.scriptText.trim();
      if (!t) return;
      setMmLoading(true);
      setMmError(null);
      setForkedSessionId(null);
      try {
        const minutesModelSafe = isAllowedMeetingMinutesModelId(
          snap.minutesModel,
        )
          ? snap.minutesModel
          : DEFAULT_MEETING_MINUTES_MODEL;

        const sc = sessionContextForApi(snap.sessionContext);
        const templateResolved = resolveMeetingMinutesTemplate(snap.template);
        const contextPayload = {
          glossary: snap.glossary,
          sessionContext: sc,
          template: templateResolved,
        };

        let targetSessionId = session.id;

        if (mode === "current") {
          await persistSessionEditSnapshot(session, snap);
        } else {
          const titleTrim = snap.title.trim();
          const scriptMetaForFork =
            session.scriptMeta != null
              ? { ...session.scriptMeta, minutesModel: minutesModelSafe }
              : undefined;
          targetSessionId = await createSessionWithContext(snap.scriptText, {
            ...(titleTrim ? { title: titleTrim } : {}),
            ...(scriptMetaForFork ? { scriptMeta: scriptMetaForFork } : {}),
            context: contextPayload,
            status: "ready",
          });
        }

        const summary = await fetchMeetingMinutesSummary(
          t,
          minutesModelSafe,
          undefined,
          {
            glossary: snap.glossary,
            sessionContext: sc ?? undefined,
            template: templateResolved,
          },
        );
        await updateSession(targetSessionId, { summary, status: "ready" });

        if (mode === "new") {
          setForkedSessionId(targetSessionId);
        }

        const refreshed = await onSessionRefresh();
        if (!refreshed) {
          setMmError(
            "저장 후 화면을 불러오지 못했습니다. 잠시 후 다시 시도하거나 세션 목록에서 다시 열어 주세요.",
          );
        }
      } catch (e) {
        console.error(e);
        setMmError("요약을 만들지 못했습니다.");
      } finally {
        setMmLoading(false);
      }
    },
    [onSessionRefresh, session],
  );

  const displayTitle = session.title?.trim() ?? "";
  const titleTypographyClass =
    "border-0 bg-transparent px-0 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50";

  return (
    <NoteDocumentLayout>
      <NoteDocumentHeader
        title={
          <h2
            data-testid="recorder-note-title"
            aria-label="노트 제목"
            className={`${titleTypographyClass} truncate py-2 ${
              displayTitle ? "" : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            {displayTitle || "새로운 노트"}
          </h2>
        }
        actions={
          <>
            {audioFullBlob || audioSegments.length > 0 ? (
              <IconButton
                icon={isDownloading ? Loader2 : Download}
                ariaLabel="오디오 다운로드"
                label="오디오 다운로드"
                variant="primary"
                disabled={isDownloading}
                iconClassName={isDownloading ? "animate-spin" : ""}
                onClick={async () => {
                  setIsDownloading(true);
                  try {
                    const prefix = `session-${session.id}`;
                    if (audioFullBlob && audioFullBlob.size > 0) {
                      downloadRecordingAudio(audioFullBlob, prefix);
                    } else {
                      await downloadRecordingZip(audioSegments, prefix);
                    }
                  } catch {
                    /* 다운로드 실패 시 로딩만 해제 */
                  } finally {
                    setIsDownloading(false);
                  }
                }}
              />
            ) : null}
            <IconButton
              icon={Pencil}
              ariaLabel="편집"
              label="편집"
              variant="outline"
              disabled={mmLoading}
              onClick={() => setEditOpen(true)}
            />
          </>
        }
      />

      {mmLoading ? (
        <p
          className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400"
          role="status"
          data-testid="session-detail-mm-progress"
        >
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          요약 생성 중…
        </p>
      ) : null}

      {mmError ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {mmError}
        </p>
      ) : null}

      {forkedSessionId && !mmLoading ? (
        <p
          className="text-sm text-zinc-700 dark:text-zinc-300"
          role="status"
          data-testid="session-detail-fork-notice"
        >
          새 세션에 요약을 저장했습니다.{" "}
          <Link
            href={`/sessions/${encodeURIComponent(forkedSessionId)}`}
            className="font-medium text-sky-600 underline hover:text-sky-500 dark:text-sky-400"
          >
            새 노트 열기
          </Link>
        </p>
      ) : null}

      <SessionPropertyRowsReadOnly
        sessionContext={sessionContext}
        meetingTemplate={meetingTemplate}
      />

      <div className="flex flex-col gap-2">
        <div
          role="tablist"
          aria-label="노트 본문"
          className="flex gap-1 border-b border-zinc-200 dark:border-zinc-700"
        >
          <button
            id={summaryTabId}
            type="button"
            role="tab"
            aria-selected={activeTab === "summary"}
            aria-controls={summaryPanelId}
            data-testid="note-tab-summary"
            onClick={() => setActiveTab("summary")}
            className={
              activeTab === "summary"
                ? `${NOTE_TAB_BUTTON_BASE} -mb-px border-sky-500 text-sky-600 dark:text-sky-400`
                : `${NOTE_TAB_BUTTON_BASE} border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200`
            }
          >
            AI 요약
          </button>
          <button
            id={scriptTabId}
            type="button"
            role="tab"
            aria-selected={activeTab === "script"}
            aria-controls={scriptPanelId}
            data-testid="note-tab-script"
            onClick={() => setActiveTab("script")}
            className={
              activeTab === "script"
                ? `${NOTE_TAB_BUTTON_BASE} -mb-px border-sky-500 text-sky-600 dark:text-sky-400`
                : `${NOTE_TAB_BUTTON_BASE} border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200`
            }
          >
            스크립트
          </button>
        </div>

        <div
          id={summaryPanelId}
          role="tabpanel"
          aria-labelledby={summaryTabId}
          hidden={activeTab !== "summary"}
          className={NOTE_TAB_SURFACE_PAGE_SCROLL_CLASS}
        >
          <div className="flex flex-col gap-4" role="region" aria-label="요약">
            {session.summary ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <IconButton
                  icon={copiedSummary ? Check : Copy}
                  ariaLabel="요약 전체 복사"
                  label={copiedSummary ? "복사됨" : undefined}
                  variant="outline"
                  onClick={() => void copySummaryMarkdown()}
                />
              </div>
            ) : null}
            {session.summary ? (
              <div className="text-sm leading-relaxed">
                <MeetingMinutesMarkdown markdown={session.summary} />
              </div>
            ) : hasText ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                아직 요약이 없습니다. 우측 상단 &apos;편집&apos;에서 요약을
                생성하세요.
              </p>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                스크립트가 비어 있으면 요약을 만들 수 없습니다.
              </p>
            )}
          </div>
        </div>

        <div
          id={scriptPanelId}
          role="tabpanel"
          aria-labelledby={scriptTabId}
          hidden={activeTab !== "script"}
          className={NOTE_TAB_SURFACE_PAGE_SCROLL_CLASS}
        >
          <div
            className="flex flex-col gap-4"
            role="region"
            aria-label="스크립트"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="min-w-0 flex-1">
                {session.scriptMeta ? (
                  <SessionScriptMetaDisplay scriptMeta={session.scriptMeta} />
                ) : null}
              </div>
              <div className="shrink-0">
                <IconButton
                  icon={copiedScript ? Check : Copy}
                  ariaLabel="스크립트 텍스트 복사"
                  label={copiedScript ? "복사됨" : undefined}
                  variant="outline"
                  disabled={!session.text.trim()}
                  onClick={() => void copyScript()}
                />
              </div>
            </div>
            <TranscriptView
              variant="plain"
              showHeading={false}
              partial=""
              finals={[]}
              staticScript={session.text}
              emptyStateHint="스크립트가 비어 있습니다."
              textareaTestId="session-detail-script-readonly"
              textareaAriaLabel="스크립트 읽기 전용"
              pageScrollBody
            />
          </div>
        </div>
      </div>

      <SessionEditDialog
        key={session.id}
        open={editOpen}
        session={session}
        mmLoading={mmLoading}
        onClose={() => setEditOpen(false)}
        onAfterPersist={onSessionRefresh}
        onGenerate={(snap, mode) => {
          setEditOpen(false);
          void runMeetingMinutesFromSnapshot(snap, mode);
        }}
      />
    </NoteDocumentLayout>
  );
}

export function SessionDetail() {
  const params = useParams();
  const id = parseRouteSessionId(params?.id);

  const [retryToken, setRetryToken] = useState(0);

  if (id == null) {
    return (
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <p className="text-zinc-800 dark:text-zinc-200">
          세션을 찾을 수 없습니다.
        </p>
        <Link
          href="/"
          className="w-fit cursor-pointer text-sm font-medium text-sky-500 hover:text-sky-400"
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
