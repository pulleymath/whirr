"use client";

export type SessionGlossaryEditorProps = {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

export function SessionGlossaryEditor({
  value,
  onChange,
  disabled = false,
}: SessionGlossaryEditorProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="session-glossary-textarea"
        className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
      >
        용어 사전 (세션)
      </label>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        요약 생성 시 참고할 용어입니다. 한 줄에 하나씩 입력하세요.
      </p>
      <textarea
        id="session-glossary-textarea"
        data-testid="session-glossary-textarea"
        disabled={disabled}
        rows={4}
        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        value={value.join("\n")}
        onChange={(e) => {
          const lines = e.target.value
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          onChange(lines);
        }}
        spellCheck={false}
      />
    </div>
  );
}
