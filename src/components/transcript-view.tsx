"use client";

import { useLayoutEffect, useRef, type ChangeEvent } from "react";

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
  /**
   * 저장된 스크립트 한 덩어리 표시·편집. 지정 시 partial/finals·로딩 행은 쓰지 않는다(홈 스크립트 탭 plain UI와 동일).
   */
  staticScript?: string;
  onStaticScriptChange?: (next: string) => void;
  /** staticScript 편집 모드에서 입력 비활성 */
  scriptInputDisabled?: boolean;
  /** textarea `data-testid` (기본 transcript-textarea) */
  textareaTestId?: string;
  /** textarea 접근 이름 */
  textareaAriaLabel?: string;
  /**
   * true면 plain+static에서 뷰포트 고정 높이·내부 스크롤 대신 본문 높이만큼만 차지(부모 스크롤).
   */
  pageScrollBody?: boolean;
};

const SECTION_VARIANT_CLASS: Record<TranscriptViewVariant, string> = {
  card: "rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
  embedded:
    "rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40",
  plain:
    "flex min-h-0 flex-1 flex-col gap-3 border-0 bg-transparent p-0 shadow-none dark:bg-transparent",
};

const SECTION_PLAIN_PAGE_SCROLL_CLASS =
  "flex flex-col gap-3 border-0 bg-transparent p-0 shadow-none dark:bg-transparent";

const TEXTAREA_VARIANT_CLASS: Record<TranscriptViewVariant, string> = {
  card: "min-h-48",
  embedded: "min-h-36",
  plain:
    "min-h-[min(44vh,17rem)] flex-1 resize-none border-0 bg-transparent px-0 py-0 text-[15px] leading-[1.7] text-zinc-800 shadow-none outline-none ring-0 placeholder:text-zinc-400 focus:border-transparent focus:outline-none focus:ring-0 dark:text-zinc-200 dark:placeholder:text-zinc-500",
};

const PLAIN_STATIC_PAGE_SCROLL_TEXT_CLASS =
  "w-full min-h-[12rem] resize-none overflow-hidden border-0 bg-transparent px-0 py-0 font-sans text-[15px] leading-[1.7] text-zinc-800 shadow-none outline-none ring-0 placeholder:text-zinc-400 focus:border-transparent focus:outline-none focus:ring-0 dark:text-zinc-200 dark:placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-60";

const PLAIN_STATIC_READONLY_PRE_CLASS =
  "w-full whitespace-pre-wrap break-words font-sans text-[15px] leading-[1.7] text-zinc-800 dark:text-zinc-200";

const STATIC_PAGE_SCROLL_MIN_PX = 272;

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
  staticScript,
  onStaticScriptChange,
  scriptInputDisabled = false,
  textareaTestId = "transcript-textarea",
  textareaAriaLabel = "실시간 스크립트 텍스트",
  pageScrollBody = false,
}: TranscriptViewProps) {
  const isStaticScript = staticScript !== undefined;
  const editableStatic = isStaticScript && onStaticScriptChange != null;
  const staticPageScroll = isStaticScript && pageScrollBody;

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const hasContent = isStaticScript
    ? staticScript.trim().length > 0
    : finals.length > 0 || partial.length > 0;
  const joinedFinals = finals.join("\n");
  const textareaValue = isStaticScript
    ? staticScript
    : isSegmentInFlight
      ? [joinedFinals, "…"].filter(Boolean).join("\n")
      : joinedFinals;
  const emptyHint = emptyStateHint ?? "녹음을 시작하면 스크립트가 표시됩니다.";
  const showEmptyHint = !hasContent && !loadingMessage;
  const showLivePartialRow =
    !isStaticScript &&
    (Boolean(loadingMessage?.trim()) || partial.trim().length > 0);

  const textareaReadOnly = isStaticScript ? !editableStatic : true;
  const textareaDisabled = isStaticScript
    ? editableStatic && scriptInputDisabled
    : true;

  useLayoutEffect(() => {
    if (!editableStatic || !staticPageScroll || !textAreaRef.current) return;
    const el = textAreaRef.current;
    el.style.height = "0px";
    const next = Math.max(STATIC_PAGE_SCROLL_MIN_PX, el.scrollHeight);
    el.style.height = `${next}px`;
  }, [editableStatic, staticPageScroll, staticScript, scriptInputDisabled]);

  const plainSectionClass =
    variant === "plain"
      ? `${staticPageScroll ? SECTION_PLAIN_PAGE_SCROLL_CLASS : SECTION_VARIANT_CLASS.plain} ${className}`.trim()
      : "";

  const sectionClass =
    variant === "plain"
      ? plainSectionClass
      : `${SECTION_VARIANT_CLASS[variant]} ${className}`.trim();

  const textareaClass =
    variant === "plain"
      ? staticPageScroll && editableStatic
        ? `${PLAIN_STATIC_PAGE_SCROLL_TEXT_CLASS} cursor-text`
        : `w-full font-sans ${TEXTAREA_VARIANT_CLASS.plain} ${
            editableStatic
              ? "cursor-text resize-y disabled:cursor-not-allowed disabled:opacity-60"
              : "cursor-default resize-none"
          }`.trim()
      : `mt-3 w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-sm leading-relaxed text-zinc-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 ${TEXTAREA_VARIANT_CLASS[variant]}`.trim();

  const onStaticInput =
    editableStatic && onStaticScriptChange
      ? (e: ChangeEvent<HTMLTextAreaElement>) =>
          onStaticScriptChange(e.target.value)
      : undefined;

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

      {isStaticScript && !editableStatic ? (
        hasContent ? (
          <pre
            data-testid={textareaTestId}
            className={PLAIN_STATIC_READONLY_PRE_CLASS}
            aria-label={textareaAriaLabel}
          >
            {staticScript}
          </pre>
        ) : (
          <p
            className="text-sm text-zinc-500 dark:text-zinc-400"
            data-testid={textareaTestId}
          >
            {emptyHint}
          </p>
        )
      ) : (
        <textarea
          ref={editableStatic && staticPageScroll ? textAreaRef : undefined}
          readOnly={textareaReadOnly}
          disabled={textareaDisabled}
          spellCheck={false}
          value={textareaValue}
          placeholder={showEmptyHint ? emptyHint : ""}
          data-testid={textareaTestId}
          aria-label={textareaAriaLabel}
          onChange={onStaticInput}
          className={textareaClass}
        />
      )}

      {!isStaticScript && isSegmentInFlight ? (
        <p
          className={`text-xs text-zinc-500 dark:text-zinc-400 ${variant === "plain" ? "shrink-0" : "mt-2"}`}
          data-testid="transcript-segment-loading"
        >
          최신 세그먼트 스크립트를 반영하는 중…
        </p>
      ) : null}

      {!isStaticScript ? (
        <ul className="sr-only" aria-hidden data-testid="transcript-finals">
          {finals.map((line, i) => (
            <li key={`${i}-${line.slice(0, 12)}`}>{line}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
