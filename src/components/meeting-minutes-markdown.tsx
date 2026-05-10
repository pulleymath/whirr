import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function cx(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

const baseText = "text-zinc-800 dark:text-zinc-200";
const heading = "font-semibold text-zinc-900 dark:text-zinc-50";
const link =
  "font-medium text-sky-500 underline underline-offset-2 hover:text-sky-400";

const meetingMinutesComponents: Partial<Components> = {
  p: ({ className, ...props }) => (
    <p className={cx("mb-3 last:mb-0", baseText, className)} {...props} />
  ),
  h1: ({ className, ...props }) => (
    <h1
      className={cx("mb-2 mt-5 text-base first:mt-0", heading, className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cx("mb-2 mt-4 text-sm first:mt-0", heading, className)}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cx("mb-1.5 mt-3 text-sm first:mt-0", heading, className)}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4 className={cx("mb-1.5 mt-3 text-sm", heading, className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cx(
        "mb-3 list-disc space-y-1 pl-5 last:mb-0",
        baseText,
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cx(
        "mb-3 list-decimal space-y-1 pl-5 last:mb-0",
        baseText,
        className,
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li className={cx("leading-relaxed", className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cx(
        "mb-3 border-l-2 border-zinc-300 pl-3 text-zinc-600 italic dark:border-zinc-600 dark:text-zinc-400",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr
      className={cx("my-4 border-zinc-200 dark:border-zinc-700", className)}
      {...props}
    />
  ),
  a: ({ className, href, ...props }) => (
    <a
      className={cx(link, className)}
      href={href}
      {...(href?.startsWith("http")
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
      {...props}
    />
  ),
  strong: ({ className, ...props }) => (
    <strong
      className={cx(
        "font-semibold text-zinc-900 dark:text-zinc-100",
        className,
      )}
      {...props}
    />
  ),
  code: ({ className, ...props }) => {
    const fenced =
      typeof className === "string" && className.includes("language-");
    if (fenced) {
      return (
        <code
          className={cx(
            "block whitespace-pre-wrap break-words bg-transparent p-0 font-mono text-[0.8125rem] text-zinc-800 dark:text-zinc-200",
            className,
          )}
          {...props}
        />
      );
    }
    return (
      <code
        className={cx(
          "rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.8125rem] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
          className,
        )}
        {...props}
      />
    );
  },
  pre: ({ className, ...props }) => (
    <pre
      className={cx(
        "mb-3 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[0.8125rem] last:mb-0 dark:border-zinc-700 dark:bg-zinc-900",
        className,
      )}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="mb-3 overflow-x-auto last:mb-0">
      <table
        className={cx(
          "w-full min-w-[12rem] border-collapse text-left text-sm",
          baseText,
          className,
        )}
        {...props}
      />
    </div>
  ),
  thead: ({ className, ...props }) => (
    <thead
      className={cx("border-b border-zinc-200 dark:border-zinc-700", className)}
      {...props}
    />
  ),
  tbody: ({ className, ...props }) => (
    <tbody className={cx(className)} {...props} />
  ),
  tr: ({ className, ...props }) => (
    <tr
      className={cx(
        "border-b border-zinc-100 last:border-0 dark:border-zinc-800",
        className,
      )}
      {...props}
    />
  ),
  th: ({ className, ...props }) => (
    <th
      className={cx(
        "px-2 py-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-50",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td className={cx("px-2 py-1.5 align-top", className)} {...props} />
  ),
};

export type MeetingMinutesMarkdownProps = {
  markdown: string;
  className?: string;
};

/**
 * 회의록 API가 반환하는 마크다운 본문을 안전하게 HTML 요소로 렌더한다(raw HTML 삽입 없음).
 */
export function MeetingMinutesMarkdown({
  markdown,
  className,
}: MeetingMinutesMarkdownProps) {
  return (
    <div className={cx("meeting-minutes-markdown min-w-0", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={meetingMinutesComponents}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
