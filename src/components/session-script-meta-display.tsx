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
    <p
      className="min-w-0 truncate text-xs leading-snug text-zinc-500 dark:text-zinc-500"
      data-testid="session-script-meta-display"
    >
      <span className="font-mono text-zinc-600 dark:text-zinc-400">
        {formatScriptMetaLine(scriptMeta)}
      </span>
    </p>
  );
}
