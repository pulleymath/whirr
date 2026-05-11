"use client";

import { MeetingMinutesMarkdown } from "@/components/meeting-minutes-markdown";
import { RecorderNoteWorkspace } from "@/components/recorder-note-workspace";
import { SessionGlossaryEditor } from "@/components/session-glossary-editor";
import { SessionMinutesModelSelect } from "@/components/session-minutes-model-select";
import { SessionScriptMetaDisplay } from "@/components/session-script-meta-display";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  getSessionAudio,
  getSessionById,
  updateSession,
  type Session,
} from "@/lib/db";
import { downloadRecordingZip } from "@/lib/download-recording";
import type { MeetingContext, SessionContext } from "@/lib/glossary/types";
import { fetchMeetingMinutesSummary } from "@/lib/meeting-minutes/fetch-meeting-minutes-client";
import {
  DEFAULT_MEETING_MINUTES_TEMPLATE,
  resolveMeetingMinutesTemplate,
  type MeetingMinutesTemplate,
} from "@/lib/meeting-minutes/templates";
import {
  DEFAULT_MEETING_MINUTES_MODEL,
  isAllowedMeetingMinutesModelId,
} from "@/lib/settings/types";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { Check, Copy, Download, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const EMPTY_SESSION_CONTEXT: SessionContext = {
  participants: "",
  topic: "",
  keywords: "",
};

function sessionContextForApi(value: SessionContext): SessionContext | null {
  if (
    !value.participants.trim() &&
    !value.topic.trim() &&
    !value.keywords.trim()
  ) {
    return null;
  }
  return value;
}

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

  /** 저장 후 화면 갱신용. 실패 시 전역 오류 화면 대신 false를 반환한다(호출부에서 요약 영역 오류 처리). */
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
  const [scriptDraft, setScriptDraft] = useState(session.text);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [scriptSaving, setScriptSaving] = useState(false);
  const [scriptSaveError, setScriptSaveError] = useState<string | null>(null);
  const [mmLoading, setMmLoading] = useState(false);
  const [mmError, setMmError] = useState<string | null>(null);
  useBeforeUnload(mmLoading);
  const [contextDraft, setContextDraft] = useState<SessionContext>(
    session.context?.sessionContext ?? EMPTY_SESSION_CONTEXT,
  );
  const [glossaryDraft, setGlossaryDraft] = useState<string[]>(
    session.context?.glossary ?? [],
  );
  const [minutesModelDraft, setMinutesModelDraft] = useState(
    session.scriptMeta?.minutesModel ?? DEFAULT_MEETING_MINUTES_MODEL,
  );
  const [templateDraft, setTemplateDraft] = useState<MeetingMinutesTemplate>(
    session.context?.template ?? DEFAULT_MEETING_MINUTES_TEMPLATE,
  );

  useEffect(() => {
    setScriptDraft(session.text);
  }, [session.id, session.text]);

  useEffect(() => {
    setContextDraft(session.context?.sessionContext ?? EMPTY_SESSION_CONTEXT);
    setGlossaryDraft(session.context?.glossary ?? []);
    setMinutesModelDraft(
      session.scriptMeta?.minutesModel ?? DEFAULT_MEETING_MINUTES_MODEL,
    );
    setTemplateDraft(
      session.context?.template ?? DEFAULT_MEETING_MINUTES_TEMPLATE,
    );
  }, [session.id, session.context, session.scriptMeta]);

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
      const minutesModelSafe = isAllowedMeetingMinutesModelId(minutesModelDraft)
        ? minutesModelDraft
        : DEFAULT_MEETING_MINUTES_MODEL;

      const sc = sessionContextForApi(contextDraft);
      const templateResolved = resolveMeetingMinutesTemplate(templateDraft);
      const contextPayload: MeetingContext = {
        glossary: glossaryDraft,
        sessionContext: sc,
        template: templateResolved,
      };
      const scriptMetaUpdate =
        session.scriptMeta != null
          ? { ...session.scriptMeta, minutesModel: minutesModelSafe }
          : undefined;

      await updateSession(session.id, {
        context: contextPayload,
        ...(scriptMetaUpdate ? { scriptMeta: scriptMetaUpdate } : {}),
      });

      const summary = await fetchMeetingMinutesSummary(
        t,
        minutesModelSafe,
        undefined,
        {
          glossary: glossaryDraft,
          sessionContext: sc ?? undefined,
          template: templateResolved,
        },
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
      setMmError("요약을 만들지 못했습니다.");
    } finally {
      setMmLoading(false);
    }
  }, [
    contextDraft,
    glossaryDraft,
    minutesModelDraft,
    onSessionRefresh,
    session.id,
    session.scriptMeta,
    scriptDraft,
    templateDraft,
  ]);

  const summaryPanelContent = (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4"
      role="region"
      aria-label="요약"
    >
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
        <div className="min-h-0 flex-1 overflow-y-auto text-sm leading-relaxed">
          <MeetingMinutesMarkdown markdown={session.summary} />
        </div>
      ) : hasText ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          아직 요약이 없습니다. 스크립트 탭 하단에서 요약을 생성하세요.
        </p>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          스크립트가 비어 있으면 요약을 만들 수 없습니다.
        </p>
      )}
    </div>
  );

  const scriptTabBody = (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4"
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
        className="min-h-[min(40vh,16rem)] w-full flex-1 resize-y rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-3 py-3 font-mono text-sm leading-relaxed text-zinc-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-zinc-700/90 dark:bg-zinc-900/60 dark:text-zinc-200"
      />
      {scriptDirty ? (
        <p
          className="text-xs text-amber-800 dark:text-amber-200/90"
          role="status"
        >
          저장하지 않은 내용은 요약 생성·재생성에 반영됩니다. 세션 목록 등에
          맞추려면 스크립트 저장을 눌러 주세요.
        </p>
      ) : null}
      {scriptSaveError ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {scriptSaveError}
        </p>
      ) : null}

      <section
        className="border-t border-zinc-200 pt-5 dark:border-zinc-700"
        aria-label="요약 생성 설정"
      >
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          요약 생성
        </h2>
        <div className="flex flex-col gap-4">
          <SessionScriptMetaDisplay scriptMeta={session.scriptMeta} />
          <SessionGlossaryEditor
            value={glossaryDraft}
            onChange={setGlossaryDraft}
            disabled={mmLoading}
          />
          <SessionMinutesModelSelect
            value={minutesModelDraft}
            onChange={setMinutesModelDraft}
            disabled={mmLoading}
          />
          <Button
            type="button"
            variant="primary"
            disabled={mmLoading || !hasText}
            onClick={() => void handleMeetingMinutes()}
          >
            {mmLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                생성 중…
              </span>
            ) : session.summary ? (
              "요약 재생성"
            ) : (
              "요약 생성"
            )}
          </Button>
          {mmError ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {mmError}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {audioSegments.length > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <IconButton
            icon={isDownloading ? Loader2 : Download}
            ariaLabel={"오디오 다운로드"}
            label={"오디오 다운로드"}
            variant="primary"
            disabled={isDownloading}
            iconClassName={isDownloading ? "animate-spin" : ""}
            onClick={async () => {
              setIsDownloading(true);
              try {
                await downloadRecordingZip(
                  audioSegments,
                  `session-${session.id}`,
                );
              } catch {
                /* ZIP 생성·다운로드 실패는 UI만 복구(로딩 해제). 별도 토스트 없음. */
              } finally {
                setIsDownloading(false);
              }
            }}
          />
        </div>
      ) : null}

      <RecorderNoteWorkspace
        key={session.id}
        noteTitle={session.title?.trim() ?? ""}
        onNoteTitleChange={() => {}}
        titleReadOnly
        sessionContext={contextDraft}
        onSessionContextChange={setContextDraft}
        meetingTemplate={templateDraft}
        onMeetingTemplateChange={setTemplateDraft}
        pipelineBusy={mmLoading}
        summaryPanelContent={summaryPanelContent}
      >
        {scriptTabBody}
      </RecorderNoteWorkspace>
    </div>
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
