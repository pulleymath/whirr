"use client";

import { MeetingMinutesMarkdown } from "@/components/meeting-minutes-markdown";
import { MeetingTemplatePreview } from "@/components/meeting-template-preview";
import {
  NOTE_TAB_BUTTON_BASE,
  NOTE_TAB_SURFACE_CLASS,
  NOTE_TAB_SURFACE_PAGE_SCROLL_CLASS,
} from "@/components/recorder-note-workspace";
import { SessionPropertyRowsEditable } from "@/components/session-property-rows";
import { TranscriptView } from "@/components/transcript-view";
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
  useId,
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

function userConfirm(message: string): boolean {
  if (typeof window === "undefined") return true;
  const { confirm } = window;
  return typeof confirm === "function" ? confirm(message) : true;
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

type EditModalTab = "summary" | "templatePreview" | "script";

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
  const baseId = useId();
  const [activeEditTab, setActiveEditTab] = useState<EditModalTab>("summary");

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

  const handleMeetingTemplateChange = useCallback(
    (next: MeetingMinutesTemplate) => {
      setTemplateDraft((prev) => {
        const changed = JSON.stringify(prev) !== JSON.stringify(next);
        if (changed) {
          queueMicrotask(() => setActiveEditTab("templatePreview"));
        }
        return next;
      });
    },
    [],
  );

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
    setActiveEditTab("summary");
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
      const ok = userConfirm("저장하지 않은 변경이 있습니다. 닫으시겠어요?");
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
      if (mode === "current") {
        const ok = userConfirm(
          "현재 세션에 저장된 AI 요약이 새로 생성된 요약으로 덮어써집니다. 계속하시겠어요?",
        );
        if (!ok) return;
      }
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

  const summaryTabId = `${baseId}-tab-summary`;
  const previewTabId = `${baseId}-tab-template-preview`;
  const scriptTabId = `${baseId}-tab-script`;
  const summaryPanelId = `${baseId}-tabpanel-summary`;
  const previewPanelId = `${baseId}-tabpanel-template-preview`;
  const scriptPanelId = `${baseId}-tabpanel-script`;

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
            편집
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
            onMeetingTemplateChange={handleMeetingTemplateChange}
            disabled={mmLoading}
            minutesModel={minutesModelDraft}
            onMinutesModelChange={setMinutesModelDraft}
          />

          <div className="mt-4 flex flex-col gap-2">
            <div
              role="tablist"
              aria-label="편집 모달 본문"
              className="flex gap-1 border-b border-zinc-200 dark:border-zinc-700"
            >
              <button
                id={summaryTabId}
                type="button"
                role="tab"
                aria-selected={activeEditTab === "summary"}
                aria-controls={summaryPanelId}
                data-testid="note-tab-summary"
                onClick={() => setActiveEditTab("summary")}
                className={
                  activeEditTab === "summary"
                    ? `${NOTE_TAB_BUTTON_BASE} -mb-px border-sky-500 text-sky-600 dark:text-sky-400`
                    : `${NOTE_TAB_BUTTON_BASE} border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200`
                }
              >
                AI 요약
              </button>
              <button
                id={previewTabId}
                type="button"
                role="tab"
                aria-selected={activeEditTab === "templatePreview"}
                aria-controls={previewPanelId}
                data-testid="session-edit-tab-template-preview"
                onClick={() => setActiveEditTab("templatePreview")}
                className={
                  activeEditTab === "templatePreview"
                    ? `${NOTE_TAB_BUTTON_BASE} -mb-px border-sky-500 text-sky-600 dark:text-sky-400`
                    : `${NOTE_TAB_BUTTON_BASE} border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200`
                }
              >
                요약 형식 미리보기
              </button>
              <button
                id={scriptTabId}
                type="button"
                role="tab"
                aria-selected={activeEditTab === "script"}
                aria-controls={scriptPanelId}
                data-testid="note-tab-script"
                onClick={() => setActiveEditTab("script")}
                className={
                  activeEditTab === "script"
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
              hidden={activeEditTab !== "summary"}
              className={NOTE_TAB_SURFACE_PAGE_SCROLL_CLASS}
            >
              <div
                className="flex flex-col gap-4"
                role="region"
                aria-label="요약"
              >
                {session.summary?.trim() ? (
                  <div className="text-sm leading-relaxed">
                    <MeetingMinutesMarkdown markdown={session.summary} />
                  </div>
                ) : hasScript ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    아직 요약이 없습니다. 하단의 요약 재생성 버튼으로 생성할 수
                    있습니다.
                  </p>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    스크립트가 비어 있으면 요약을 만들 수 없습니다.
                  </p>
                )}
              </div>
            </div>

            <div
              id={previewPanelId}
              role="tabpanel"
              aria-labelledby={previewTabId}
              hidden={activeEditTab !== "templatePreview"}
              className={`${NOTE_TAB_SURFACE_CLASS} min-h-[min(28vh,14rem)]`}
            >
              <MeetingTemplatePreview
                value={templateDraft}
                onChange={handleMeetingTemplateChange}
                disabled={mmLoading}
              />
            </div>

            <div
              id={scriptPanelId}
              role="tabpanel"
              aria-labelledby={scriptTabId}
              hidden={activeEditTab !== "script"}
              className={NOTE_TAB_SURFACE_PAGE_SCROLL_CLASS}
            >
              <div
                className="flex flex-col"
                role="region"
                aria-label="스크립트"
              >
                <TranscriptView
                  variant="plain"
                  showHeading={false}
                  partial=""
                  finals={[]}
                  staticScript={scriptDraft}
                  onStaticScriptChange={setScriptDraft}
                  scriptInputDisabled={mmLoading}
                  emptyStateHint="녹음을 시작하면 스크립트가 표시됩니다."
                  textareaTestId="session-edit-dialog-script"
                  textareaAriaLabel="스크립트 편집"
                  pageScrollBody
                />
              </div>
            </div>
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

        <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
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
        </div>
      </div>
    </div>
  );
}
