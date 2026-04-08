export type SummaryTabUiState =
  | "idle"
  | "recording"
  | "summarizing"
  | "complete"
  | "error";

export type SummaryTabPanelProps = {
  state: SummaryTabUiState;
  /** `complete`일 때 표시할 요약 본문(플레이스홀더 허용) */
  summaryText?: string;
  errorMessage?: string | null;
};

export function SummaryTabPanel({
  state,
  summaryText,
  errorMessage,
}: SummaryTabPanelProps) {
  switch (state) {
    case "idle":
      return (
        <div
          className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400"
          role="region"
          aria-label="요약 안내"
        >
          <p>
            녹음을 시작하면 전사가 쌓이고, 종료 후 요약을 생성할 수 있습니다.
          </p>
        </div>
      );
    case "recording":
      return (
        <div
          className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
          role="status"
          aria-label="요약 상태"
        >
          <p>녹음 중입니다. 중지한 뒤 요약을 준비합니다.</p>
        </div>
      );
    case "summarizing":
      return (
        <div
          className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
          role="status"
          aria-label="요약 생성 중"
        >
          <p>요약을 생성하는 중입니다…</p>
        </div>
      );
    case "complete":
      return (
        <div
          className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          role="region"
          aria-label="요약 결과"
        >
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            요약
          </p>
          <p
            className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200"
            data-testid="summary-body"
          >
            {summaryText ?? "요약이 여기에 표시됩니다."}
          </p>
        </div>
      );
    case "error":
      return (
        <div
          className="rounded-xl border border-rose-200 bg-rose-50/80 p-6 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
          role="alert"
          aria-label="요약 오류"
        >
          <p>
            {errorMessage ??
              "요약을 가져오지 못했습니다. 잠시 후 다시 시도하세요."}
          </p>
        </div>
      );
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
