"use client";

import type { ReactNode } from "react";

/**
 * 노트 문서 외곽: max-width와 세로 간격(`gap-4`)을 단일 출처로 맞춘다.
 * 자식은 추가 `mt-*` 없이 배치한다.
 */
export function NoteDocumentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">{children}</div>
  );
}

/**
 * 노트 제목 행과 우측 액션. 세션 상세와 동일한 `min-h`로 정렬을 맞춘다.
 */
export function NoteDocumentHeader({
  title,
  actions,
}: {
  title: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-11 min-w-0 flex-nowrap items-center gap-3">
      <div className="min-w-0 flex-1">{title}</div>
      {actions ? (
        <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
