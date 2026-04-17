type TranscriptViewProps = {
  partial: string;
  finals: string[];
  errorMessage?: string | null;
  /** false면 내부「스크립트」제목을 숨긴다(탭 레이블과 중복 방지). */
  showHeading?: boolean;
  /** partial·finals가 비었을 때 기본 안내 대신 표시할 문구(예: 배치 녹음 중 안내) */
  emptyStateHint?: string | null;
  /** 설정 시 상단 영역에 로딩 문구를 표시한다(예: 일괄 스크립트 중) */
  loadingMessage?: string | null;
  /** 배치 녹음 중 세그먼트 스크립트 변환이 진행 중일 때 finals 끝에 로딩 점 표시 */
  isSegmentInFlight?: boolean;
};

export function TranscriptView({
  partial,
  finals,
  errorMessage,
  showHeading = true,
  emptyStateHint = null,
  loadingMessage = null,
  isSegmentInFlight = false,
}: TranscriptViewProps) {
  const hasContent = finals.length > 0 || partial.length > 0;
  const joinedFinals = finals.join("\n");
  const textareaValue = isSegmentInFlight
    ? [joinedFinals, "…"].filter(Boolean).join("\n")
    : joinedFinals;
  const emptyHint = emptyStateHint ?? "녹음을 시작하면 스크립트가 표시됩니다.";
  const showEmptyHint = !hasContent && !loadingMessage;

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      aria-label="실시간 스크립트"
      data-testid="transcript-view-card"
    >
      {showHeading ? (
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          스크립트
        </h2>
      ) : null}

      {errorMessage ? (
        <p
          className="mb-3 text-sm text-rose-600 dark:text-rose-400"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <div
        className="min-h-6 text-sm text-zinc-700 dark:text-zinc-300"
        aria-live="polite"
        aria-atomic="true"
        data-testid="transcript-partial"
      >
        {loadingMessage ? (
          <span
            className="text-zinc-600 dark:text-zinc-400"
            role="status"
            data-testid="transcript-loading"
          >
            {loadingMessage}
          </span>
        ) : partial ? (
          <span className="italic text-zinc-600 dark:text-zinc-400">
            {partial}
          </span>
        ) : (
          <span className="text-zinc-400 dark:text-zinc-500">
            {showEmptyHint ? emptyHint : ""}
          </span>
        )}
      </div>

      <textarea
        readOnly
        disabled
        spellCheck={false}
        value={textareaValue}
        placeholder={showEmptyHint ? emptyHint : ""}
        data-testid="transcript-textarea"
        aria-label="실시간 스크립트 텍스트"
        className="mt-3 min-h-48 w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-sm leading-relaxed text-zinc-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      />

      {isSegmentInFlight ? (
        <p
          className="mt-2 text-xs text-zinc-500 dark:text-zinc-400"
          data-testid="transcript-segment-loading"
        >
          최신 세그먼트 스크립트를 반영하는 중…
        </p>
      ) : null}

      <ul className="sr-only" aria-hidden data-testid="transcript-finals">
        {finals.map((line, i) => (
          <li key={`${i}-${line.slice(0, 12)}`}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
