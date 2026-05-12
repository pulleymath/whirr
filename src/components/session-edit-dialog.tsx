"use client";

import { MeetingTemplatePreview } from "@/components/meeting-template-preview";
import { NOTE_TAB_SURFACE_CLASS } from "@/components/recorder-note-workspace";
import { SessionPropertyRowsEditable } from "@/components/session-property-rows";
import { Button } from "@/components/ui/button";
import { updateSession, type Session } from "@/lib/db";
import type { MeetingContext, SessionContext } from "@/lib/glossary/types";
import { sessionContextForApi } from "@/lib/session-context-for-api";
import {
  DEFAULT_MEETING_MINUTES_TEMPLATE,
  resolveMeetingMinutesTemplate,
  type MeetingMinutesTemplate,
} from "@/lib/meeting-minutes/templates";
import {
  DEFAULT_MEETING_MINUTES_MODEL,
  isAllowedMeetingMinutesModelId,
} from "@/lib/settings/types";
import { Loader2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export type SessionEditSnapshot = {
  title: string;
  scriptText: string;
  sessionContext: SessionContext;
  glossary: string[];
  minutesModel: string;
  template: MeetingMinutesTemplate;
};

function captureSnapshot(
  title: string,
  scriptText: string,
  sessionContext: SessionContext,
  glossary: string[],
  minutesModel: string,
  template: MeetingMinutesTemplate,
): SessionEditSnapshot {
  const t =
    template.id === "custom"
      ? { id: "custom" as const, prompt: template.prompt }
      : { id: template.id };
  return {
    title,
    scriptText,
    sessionContext: { ...sessionContext },
    glossary: [...glossary],
    minutesModel,
    template: t,
  };
}

function snapshotsEqual(
  a: SessionEditSnapshot,
  b: SessionEditSnapshot,
): boolean {
  return (
    a.title === b.title &&
    a.scriptText === b.scriptText &&
    a.sessionContext.participants === b.sessionContext.participants &&
    a.sessionContext.topic === b.sessionContext.topic &&
    a.sessionContext.keywords === b.sessionContext.keywords &&
    a.minutesModel === b.minutesModel &&
    JSON.stringify(a.glossary) === JSON.stringify(b.glossary) &&
    JSON.stringify(a.template) === JSON.stringify(b.template)
  );
}

export async function persistSessionEditSnapshot(
  session: Session,
  snapshot: SessionEditSnapshot,
): Promise<void> {
  const minutesModelSafe = isAllowedMeetingMinutesModelId(snapshot.minutesModel)
    ? snapshot.minutesModel
    : DEFAULT_MEETING_MINUTES_MODEL;

  const sc = sessionContextForApi(snapshot.sessionContext);
  const templateResolved = resolveMeetingMinutesTemplate(snapshot.template);
  const contextPayload: MeetingContext = {
    glossary: snapshot.glossary,
    sessionContext: sc,
    template: templateResolved,
  };
  const scriptMetaUpdate =
    session.scriptMeta != null
      ? { ...session.scriptMeta, minutesModel: minutesModelSafe }
      : undefined;

  const titleTrim = snapshot.title.trim();

  await updateSession(session.id, {
    text: snapshot.scriptText,
    context: contextPayload,
    ...(titleTrim ? { title: titleTrim } : {}),
    ...(scriptMetaUpdate ? { scriptMeta: scriptMetaUpdate } : {}),
    status: "ready",
  });
}

export type SessionEditDialogProps = {
  open: boolean;
  session: Session;
  /** 부모에서 요약 생성 중이면 액션 비활성 */
  mmLoading: boolean;
  onClose: () => void;
  /** 저장 성공 후(모달 닫기 전) 세션 재조회 등 */
  onAfterPersist: () => Promise<boolean | void>;
  /** 암묵적 저장 후 부모가 요약 파이프라인을 시작한다. 모달은 호출 전에 닫힌다. */
  onGenerate: (snapshot: SessionEditSnapshot, mode: "current" | "new") => void;
};

type DialogPhase = "closed" | "open" | "closing";

export function SessionEditDialog({
  open,
  session,
  mmLoading,
  onClose,
  onAfterPersist,
  onGenerate,
}: SessionEditDialogProps) {
  const dialogTitleId = "session-edit-dialog-title";
  const initialSnapshotRef = useRef<SessionEditSnapshot | null>(null);
  const frozenGlossaryRef = useRef<string[]>([]);

  const [phase, setPhase] = useState<DialogPhase>(() =>
    open ? "open" : "closed",
  );
  const [paintEnter, setPaintEnter] = useState(false);

  const [titleDraft, setTitleDraft] = useState(session.title ?? "");
  const [scriptDraft, setScriptDraft] = useState(session.text);
  const [contextDraft, setContextDraft] = useState<SessionContext>(
    session.context?.sessionContext ?? {
      participants: "",
      topic: "",
      keywords: "",
    },
  );
  const [minutesModelDraft, setMinutesModelDraft] = useState(
    session.scriptMeta?.minutesModel ?? DEFAULT_MEETING_MINUTES_MODEL,
  );
  const [templateDraft, setTemplateDraft] = useState<MeetingMinutesTemplate>(
    session.context?.template ?? DEFAULT_MEETING_MINUTES_TEMPLATE,
  );

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const capture = useCallback(() => {
    return captureSnapshot(
      titleDraft,
      scriptDraft,
      contextDraft,
      frozenGlossaryRef.current,
      minutesModelDraft,
      templateDraft,
    );
  }, [titleDraft, scriptDraft, contextDraft, minutesModelDraft, templateDraft]);

  useLayoutEffect(() => {
    if (open) {
      setPhase("open");
      setPaintEnter(false);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPaintEnter(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setPaintEnter(false);
    setPhase((prev) =>
      prev === "open" || prev === "closing" ? "closing" : "closed",
    );
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setTitleDraft(session.title ?? "");
    setScriptDraft(session.text);
    setContextDraft(
      session.context?.sessionContext ?? {
        participants: "",
        topic: "",
        keywords: "",
      },
    );
    frozenGlossaryRef.current = [...(session.context?.glossary ?? [])];
    setMinutesModelDraft(
      session.scriptMeta?.minutesModel ?? DEFAULT_MEETING_MINUTES_MODEL,
    );
    setTemplateDraft(
      session.context?.template ?? DEFAULT_MEETING_MINUTES_TEMPLATE,
    );
    setSaveError(null);
    setSaving(false);
    initialSnapshotRef.current = captureSnapshot(
      session.title ?? "",
      session.text,
      session.context?.sessionContext ?? {
        participants: "",
        topic: "",
        keywords: "",
      },
      frozenGlossaryRef.current,
      session.scriptMeta?.minutesModel ?? DEFAULT_MEETING_MINUTES_MODEL,
      session.context?.template ?? DEFAULT_MEETING_MINUTES_TEMPLATE,
    );
  }, [open, session]);

  const computeIsDirty = useCallback(() => {
    const init = initialSnapshotRef.current;
    if (!init) return false;
    return !snapshotsEqual(init, capture());
  }, [capture]);

  const requestClose = useCallback(() => {
    if (computeIsDirty()) {
      const ok = window.confirm("저장하지 않은 변경이 있습니다. 닫으시겠어요?");
      if (!ok) return;
    }
    onClose();
  }, [computeIsDirty, onClose]);

  useEffect(() => {
    if (phase === "closed") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, requestClose]);

  const handleShellTransitionEnd = () => {
    setPhase((p) => (p === "closing" ? "closed" : p));
  };

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSaving(true);
    try {
      await persistSessionEditSnapshot(session, capture());
      const refreshed = await onAfterPersist();
      if (refreshed === false) {
        setSaveError(
          "저장 후 화면을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
        return;
      }
      initialSnapshotRef.current = capture();
      onClose();
    } catch (e) {
      console.error(e);
      setSaveError("저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }, [session, capture, onAfterPersist, onClose]);

  const handleRegenerate = useCallback(
    (mode: "current" | "new") => {
      const snap = capture();
      if (!snap.scriptText.trim()) return;
      onGenerate(snap, mode);
    },
    [capture, onGenerate],
  );

  if (phase === "closed" && !open) {
    return null;
  }

  const hasScript = scriptDraft.trim().length > 0;
  const animatingOut =
    phase === "closing" ||
    (phase === "open" && !paintEnter) ||
    (open && phase === "closed");

  const titleTypographyClass =
    "w-full border-0 bg-transparent px-0 py-2 text-2xl font-semibold tracking-tight text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-50 dark:placeholder:text-zinc-500";

  return (
    <div
      className={`fixed inset-0 z-70 flex items-end justify-center transition-[opacity,transform] duration-200 ease-out sm:items-center sm:p-4 ${
        animatingOut
          ? "pointer-events-none opacity-0 max-sm:translate-y-6 sm:scale-95"
          : "opacity-100 max-sm:translate-y-0 sm:scale-100"
      }`}
      role="presentation"
      data-phase={phase}
      data-testid="session-edit-dialog-root"
      onTransitionEnd={handleShellTransitionEnd}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/40"
        aria-label="편집 닫기"
        onClick={() => requestClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        data-testid="session-edit-dialog"
        className="relative z-10 flex max-h-[min(94vh,56rem)] w-full max-w-5xl flex-col rounded-t-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2
            id={dialogTitleId}
            className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
          >
            노트 편집
          </h2>
          <button
            type="button"
            onClick={() => requestClose()}
            className="cursor-pointer rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            aria-label="닫기"
          >
            닫기
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            disabled={mmLoading}
            placeholder="새로운 노트"
            aria-label="노트 제목"
            data-testid="session-edit-dialog-title"
            className={titleTypographyClass}
          />

          <SessionPropertyRowsEditable
            sessionContext={contextDraft}
            onSessionContextChange={setContextDraft}
            meetingTemplate={templateDraft}
            onMeetingTemplateChange={setTemplateDraft}
            disabled={mmLoading}
            minutesModel={minutesModelDraft}
            onMinutesModelChange={setMinutesModelDraft}
          />

          <div
            className={`${NOTE_TAB_SURFACE_CLASS} mt-4 min-h-[min(28vh,14rem)]`}
          >
            <MeetingTemplatePreview
              value={templateDraft}
              onChange={setTemplateDraft}
              disabled={mmLoading}
            />
          </div>

          <div className="mt-4">
            <label
              htmlFor={`session-edit-script-${session.id}`}
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              스크립트
            </label>
            <textarea
              id={`session-edit-script-${session.id}`}
              data-testid="session-edit-dialog-script"
              value={scriptDraft}
              onChange={(e) => setScriptDraft(e.target.value)}
              rows={12}
              spellCheck={false}
              aria-label="스크립트 편집"
              disabled={mmLoading}
              className="min-h-[min(32vh,14rem)] w-full resize-y rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-3 py-3 font-mono text-sm leading-relaxed text-zinc-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700/90 dark:bg-zinc-900/60 dark:text-zinc-200"
            />
          </div>

          {saveError ? (
            <p
              className="mt-3 text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {saveError}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <Button type="button" variant="ghost" onClick={() => requestClose()}>
            닫기
          </Button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={saving || !computeIsDirty()}
              onClick={() => void handleSave()}
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  저장 중…
                </span>
              ) : (
                "저장"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mmLoading || !hasScript}
              onClick={() => handleRegenerate("current")}
            >
              현재 세션에 요약 재생성
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mmLoading || !hasScript}
              onClick={() => handleRegenerate("new")}
            >
              새 세션에 요약 재생성
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
