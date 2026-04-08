import { TabPanelBody } from "@/components/tab-panel-body";

type TranscriptViewProps = {
  partial: string;
  finals: string[];
  errorMessage?: string | null;
  /** false면 내부「전사」제목을 숨긴다(탭 레이블과 중복 방지). */
  showHeading?: boolean;
};

export function TranscriptView({
  partial,
  finals,
  errorMessage,
  showHeading = true,
}: TranscriptViewProps) {
  const hasContent = finals.length > 0 || partial.length > 0;

  return (
    <section className="w-full max-w-md" aria-label="실시간 전사">
      <TabPanelBody>
        {showHeading ? (
          <h2 className="mb-3 shrink-0 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            전사
          </h2>
        ) : null}

        {errorMessage ? (
          <p
            className="mb-3 shrink-0 text-sm text-rose-600 dark:text-rose-400"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

        <div
          className="min-h-[1.5rem] shrink-0 text-sm text-zinc-700 dark:text-zinc-300"
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
          className="mt-3 flex flex-col gap-2"
          aria-label="확정된 문장"
          data-testid="transcript-finals"
        >
          {finals.map((line, i) => (
            <li key={`${i}-${line.slice(0, 12)}`} className="leading-relaxed">
              {line}
            </li>
          ))}
        </ul>
      </TabPanelBody>
    </section>
  );
}
