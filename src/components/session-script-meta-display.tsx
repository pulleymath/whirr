"use client";

import type { SessionScriptMeta } from "@/lib/session-script-meta";
import { formatScriptMetaLine } from "@/lib/settings/labels";

export type SessionScriptMetaDisplayProps = {
  scriptMeta: SessionScriptMeta | undefined;
};

export function SessionScriptMetaDisplay({
  scriptMeta,
}: SessionScriptMetaDisplayProps) {
  if (!scriptMeta) {
    return null;
  }
  return (
    <div
      className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200"
      data-testid="session-script-meta-display"
    >
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        스크립트 모델{" "}
      </span>
      <span className="font-mono text-xs">
        {formatScriptMetaLine(scriptMeta)}
      </span>
    </div>
  );
}
