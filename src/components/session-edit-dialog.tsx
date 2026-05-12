"use client";

import { SessionGlossaryEditor } from "@/components/session-glossary-editor";
import { SessionMinutesModelSelect } from "@/components/session-minutes-model-select";
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
import { useCallback, useEffect, useRef, useState } from "react";

export type SessionEditSnapshot = {
  scriptText: string;
  sessionContext: SessionContext;
  glossary: string[];
  minutesModel: string;
  template: MeetingMinutesTemplate;
};

function captureSnapshot(
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

  await updateSession(session.id, {
    text: snapshot.scriptText,
    context: contextPayload,
    ...(scriptMetaUpdate ? { scriptMeta: scriptMetaUpdate } : {}),
    status: "ready",
  });
}

export type SessionEditDialogProps = {
  open: boolean;
  session: Session;
  /** 부모에서 요약 생성 중이면 생성 버튼 비활성 */
  mmLoading: boolean;
  onClose: () => void;
  /** 저장 성공 후(모달 닫기 전) 세션 재조회 등 */
  onAfterPersist: () => Promise<boolean | void>;
  /** 암묵적 저장 후 부모가 요약 파이프라인을 시작한다. 모달은 호출 전에 닫힌다. */
  onGenerate: (snapshot: SessionEditSnapshot) => void;
};

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

  const [scriptDraft, setScriptDraft] = useState(session.text);
  const [contextDraft, setContextDraft] = useState<SessionContext>(
    session.context?.sessionContext ?? {
      participants: "",
      topic: "",
      keywords: "",
    },
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

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const capture = useCallback(
    () =>
      captureSnapshot(
        scriptDraft,
        contextDraft,
        glossaryDraft,
        minutesModelDraft,
        templateDraft,
      ),
    [
      scriptDraft,
      contextDraft,
      glossaryDraft,
      minutesModelDraft,
      templateDraft,
    ],
  );

  useEffect(() => {
    if (!open) return;
    setScriptDraft(session.text);
    setContextDraft(
      session.context?.sessionContext ?? {
        participants: "",
        topic: "",
        keywords: "",
      },
    );
    setGlossaryDraft(session.context?.glossary ?? []);
    setMinutesModelDraft(
      session.scriptMeta?.minutesModel ?? DEFAULT_MEETING_MINUTES_MODEL,
    );
    setTemplateDraft(
      session.context?.template ?? DEFAULT_MEETING_MINUTES_TEMPLATE,
    );
    setSaveError(null);
    setSaving(false);
    initialSnapshotRef.current = captureSnapshot(
      session.text,
      session.context?.sessionContext ?? {
        participants: "",
        topic: "",
        keywords: "",
      },
      session.context?.glossary ?? [],
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
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

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

  const handleGenerate = useCallback(() => {
    const snap = capture();
    if (!snap.scriptText.trim()) return;
    onGenerate(snap);
  }, [capture, onGenerate]);

  if (!open) {
    return null;
  }

  const hasScript = scriptDraft.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-70 flex items-end justify-center sm:items-center sm:p-4"
      role="presentation"
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
        className="relative z-10 flex max-h-[min(90vh,48rem)] w-full max-w-3xl flex-col rounded-t-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-xl"
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
          <SessionPropertyRowsEditable
            sessionContext={contextDraft}
            onSessionContextChange={setContextDraft}
            meetingTemplate={templateDraft}
            onMeetingTemplateChange={setTemplateDraft}
            disabled={mmLoading}
          />

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

          <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              요약 생성
            </h3>
            <div className="flex flex-col gap-4">
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
                disabled={mmLoading || !hasScript}
                onClick={handleGenerate}
              >
                {session.summary ? "요약 재생성" : "요약 생성"}
              </Button>
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

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <Button type="button" variant="ghost" onClick={() => requestClose()}>
            닫기
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
