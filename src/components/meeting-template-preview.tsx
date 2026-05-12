"use client";

import {
  previewMeetingMinutesTemplate,
  type MeetingMinutesTemplate,
} from "@/lib/meeting-minutes/templates";
import { useId } from "react";

export type MeetingTemplatePreviewProps = {
  value: MeetingMinutesTemplate;
  onChange?: (next: MeetingMinutesTemplate) => void;
  disabled?: boolean;
};

/**
 * 홈 AI 요약 탭과 동일: 선택한 요약 형식의 목차·구성 예시(또는 커스텀 지침 편집).
 */
export function MeetingTemplatePreview({
  value,
  onChange,
  disabled = false,
}: MeetingTemplatePreviewProps) {
  const baseId = useId();
  const isCustom = value.id === "custom";
  const customPrompt = isCustom ? value.prompt : "";
  const builtInPreview = !isCustom
    ? previewMeetingMinutesTemplate(value)
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="space-y-1">
        <p className="text-xs font-normal leading-relaxed text-zinc-400 dark:text-zinc-500">
          선택한 요약 형식의{" "}
          <span className="text-zinc-400/70 dark:text-zinc-500/80">
            목차·구성 예시
          </span>
          를 보여줍니다.
        </p>

        <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-400/80 dark:text-zinc-500/90">
          {isCustom
            ? "Markdown 권장하며 비워 두면 기본 회의 형식으로 생성됩니다.\n입력한 내용은 섹션 구성·톤 가이드로만 쓰이며, 최종 요약 본문이 아닙니다."
            : "실제 요약 문장은 녹음이 끝난 뒤 스크립트를 바탕으로 생성됩니다."}
        </p>
      </div>

      {isCustom ? (
        <textarea
          id={`${baseId}-custom-prompt-preview`}
          data-testid="meeting-minutes-custom-prompt-editor"
          disabled={disabled || onChange == null}
          value={customPrompt}
          onChange={(e) =>
            onChange?.({
              id: "custom",
              prompt: e.target.value,
            })
          }
          placeholder={"## 요약\n## 논점\n- 항목은 스크립트 근거만\n## 결정"}
          className="min-h-[min(48vh,18rem)] w-full flex-1 resize-none border-0 bg-transparent p-0 font-mono text-[13px] leading-relaxed text-zinc-800 placeholder:text-zinc-400/90 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-200 dark:placeholder:text-zinc-500"
        />
      ) : (
        <pre
          data-testid="meeting-minutes-template-preview"
          className="m-0 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-zinc-400 selection:bg-zinc-200/50 dark:text-zinc-500 dark:selection:bg-zinc-700/40"
        >
          {builtInPreview}
        </pre>
      )}
    </div>
  );
}
