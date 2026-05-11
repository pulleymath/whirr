export type TranscriptViewVariant = "card" | "embedded" | "plain";

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
  /** `embedded`는 노트 작업면용 경량 카드. `plain`은 탭·문서 캔버스 안에서 쓰는 넓은 본문형. */
  variant?: TranscriptViewVariant;
  /** 루트 `section`에 추가 클래스. */
  className?: string;
};

const SECTION_VARIANT_CLASS: Record<TranscriptViewVariant, string> = {
  card: "rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
  embedded:
    "rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40",
  plain:
    "flex min-h-0 flex-1 flex-col gap-3 border-0 bg-transparent p-0 shadow-none dark:bg-transparent",
};

const TEXTAREA_VARIANT_CLASS: Record<TranscriptViewVariant, string> = {
  card: "min-h-48",
  embedded: "min-h-36",
  plain:
    "min-h-[min(44vh,17rem)] flex-1 resize-none border-0 bg-transparent px-0 py-0 text-[15px] leading-[1.7] text-zinc-800 shadow-none outline-none ring-0 placeholder:text-zinc-400 focus:border-transparent focus:outline-none focus:ring-0 dark:text-zinc-200 dark:placeholder:text-zinc-500",
};

export function TranscriptView({
  partial,
  finals,
  errorMessage,
  showHeading = true,
  emptyStateHint = null,
  loadingMessage = null,
  isSegmentInFlight = false,
  variant = "card",
  className = "",
}: TranscriptViewProps) {
  const hasContent = finals.length > 0 || partial.length > 0;
  const joinedFinals = finals.join("\n");
  const textareaValue = isSegmentInFlight
    ? [joinedFinals, "…"].filter(Boolean).join("\n")
    : joinedFinals;
  const emptyHint = emptyStateHint ?? "녹음을 시작하면 스크립트가 표시됩니다.";
  const showEmptyHint = !hasContent && !loadingMessage;
  const showLivePartialRow =
    Boolean(loadingMessage?.trim()) || partial.trim().length > 0;

  const sectionClass = `${SECTION_VARIANT_CLASS[variant]} ${className}`.trim();

  return (
    <section
      className={sectionClass}
      aria-label="실시간 스크립트"
      data-testid="transcript-view-card"
    >
      {showHeading ? (
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          스크립트
        </h2>
      ) : null}

      {errorMessage ? (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {showLivePartialRow ? (
        <div
          className={
            variant === "plain"
              ? "min-h-6 shrink-0 border-b border-zinc-200/60 pb-3 text-[15px] leading-relaxed text-zinc-600 dark:border-zinc-700/60 dark:text-zinc-300"
              : "min-h-6 text-sm text-zinc-700 dark:text-zinc-300"
          }
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
          ) : (
            <span className="italic text-zinc-600 dark:text-zinc-400">
              {partial}
            </span>
          )}
        </div>
      ) : null}

      <textarea
        readOnly
        disabled
        spellCheck={false}
        value={textareaValue}
        placeholder={showEmptyHint ? emptyHint : ""}
        data-testid="transcript-textarea"
        aria-label="실시간 스크립트 텍스트"
        className={
          variant === "plain"
            ? `w-full cursor-default font-sans ${TEXTAREA_VARIANT_CLASS.plain}`
            : `mt-3 w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-sm leading-relaxed text-zinc-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 ${TEXTAREA_VARIANT_CLASS[variant]}`.trim()
        }
      />

      {isSegmentInFlight ? (
        <p
          className={`text-xs text-zinc-500 dark:text-zinc-400 ${variant === "plain" ? "shrink-0" : "mt-2"}`}
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
