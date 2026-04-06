type TranscriptViewProps = {
  partial: string;
  finals: string[];
  errorMessage?: string | null;
};

export function TranscriptView({
  partial,
  finals,
  errorMessage,
}: TranscriptViewProps) {
  const hasContent = finals.length > 0 || partial.length > 0;

  return (
    <section
      className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      aria-label="실시간 전사"
    >
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        전사
      </h2>

      {errorMessage ? (
        <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div
        className="min-h-[1.5rem] text-sm text-zinc-700 dark:text-zinc-300"
        aria-live="polite"
        aria-atomic="true"
        data-testid="transcript-partial"
      >
        {partial ? (
          <span className="italic text-zinc-600 dark:text-zinc-400">
            {partial}
          </span>
        ) : (
          <span className="text-zinc-400 dark:text-zinc-500">
            {hasContent ? "" : "녹음을 시작하면 전사가 표시됩니다."}
          </span>
        )}
      </div>

      <ul
        className="flex max-h-48 flex-col gap-2 overflow-y-auto text-sm text-zinc-800 dark:text-zinc-200"
        aria-label="확정된 문장"
        data-testid="transcript-finals"
      >
        {finals.map((line, i) => (
          <li key={`${i}-${line.slice(0, 12)}`} className="leading-relaxed">
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}
