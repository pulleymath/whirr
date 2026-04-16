"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSessionAudio, getSessionById, type Session } from "@/lib/db";
import { downloadRecordingSegments } from "@/lib/download-recording";

type DetailState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; session: Session; audioSegments: Blob[] };

function SessionDetailBody({
  id,
  onRetry,
}: {
  id: string;
  onRetry: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [row, audioRow] = await Promise.all([
          getSessionById(id),
          getSessionAudio(id),
        ]);
        if (cancelled) {
          return;
        }
        if (row) {
          setState({
            status: "ready",
            session: row,
            audioSegments: audioRow?.segments ?? [],
          });
        } else {
          setState({ status: "missing" });
        }
      } catch {
        if (!cancelled) {
          setState({ status: "error" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const { session, audioSegments } =
    state.status === "ready" ? state : { session: null, audioSegments: [] };

  const audioUrl = useMemo(() => {
    if (audioSegments.length > 0) {
      return URL.createObjectURL(
        new Blob(audioSegments, { type: "audio/webm" }),
      );
    }
    return null;
  }, [audioSegments]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  if (state.status === "loading") {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">불러오는 중…</p>
    );
  }

  if (state.status === "missing") {
    return (
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <p className="text-zinc-800 dark:text-zinc-200">
          세션을 찾을 수 없습니다.
        </p>
        <Link
          href="/"
          className="w-fit text-sm font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
        >
          홈으로
        </Link>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <p className="text-zinc-800 dark:text-zinc-200" role="alert">
          세션을 불러오지 못했습니다.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            홈으로
          </Link>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <SessionDetailReadyContent
      session={session}
      audioUrl={audioUrl}
      audioSegments={audioSegments}
      isDownloading={isDownloading}
      setIsDownloading={setIsDownloading}
      onBack={() => router.back()}
    />
  );
}

function SessionDetailReadyContent({
  session,
  audioUrl,
  audioSegments,
  isDownloading,
  setIsDownloading,
  onBack,
}: {
  session: Session;
  audioUrl: string | null;
  audioSegments: Blob[];
  isDownloading: boolean;
  setIsDownloading: (v: boolean) => void;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyText = useCallback(async () => {
    const t = session.text.trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(session.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [session.text]);

  const hasText = session.text.trim().length > 0;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          뒤로
        </button>

        <div className="flex items-center gap-3">
          {audioUrl && (
            <audio
              src={audioUrl}
              controls
              className="h-9 w-48 sm:w-64"
              aria-label="오디오 재생"
            />
          )}

          {audioSegments.length > 0 && (
            <button
              type="button"
              disabled={isDownloading}
              onClick={async () => {
                setIsDownloading(true);
                try {
                  await downloadRecordingSegments(
                    audioSegments,
                    `session-${session.id}`,
                  );
                } finally {
                  setIsDownloading(false);
                }
              }}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {isDownloading ? "다운로드 중..." : "오디오 다운로드"}
            </button>
          )}
        </div>
      </div>
      <article
        className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        aria-label="세션 전사"
      >
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            전사
          </h1>
          {hasText ? (
            <button
              type="button"
              onClick={() => void copyText()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              aria-label="전사 텍스트 복사"
            >
              {copied ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
              )}
            </button>
          ) : null}
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          {session.text || "—"}
        </p>
        {session.summary ? (
          <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              회의록
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              {session.summary}
            </p>
          </div>
        ) : null}
      </article>
    </div>
  );
}

export function SessionDetail() {
  const params = useParams();
  const rawId = params?.id;
  const id =
    typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";

  const [retryToken, setRetryToken] = useState(0);

  if (!id) {
    return (
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <p className="text-zinc-800 dark:text-zinc-200">
          세션을 찾을 수 없습니다.
        </p>
        <Link
          href="/"
          className="w-fit text-sm font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
        >
          홈으로
        </Link>
      </div>
    );
  }

  return (
    <SessionDetailBody
      key={`${id}-${retryToken}`}
      id={id}
      onRetry={() => setRetryToken((t) => t + 1)}
    />
  );
}
