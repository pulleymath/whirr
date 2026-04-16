"use client";

import { usePostRecordingPipeline } from "@/lib/post-recording-pipeline/context";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function PipelineToastNotifier() {
  const { phase, completedSessionId } = usePostRecordingPipeline();
  const prevPhaseRef = useRef(phase);

  useEffect(() => {
    if (
      prevPhaseRef.current !== "done" &&
      phase === "done" &&
      completedSessionId
    ) {
      const id = completedSessionId;
      toast.success("회의록이 완성되었습니다", {
        action: {
          label: "바로 보기",
          onClick: () => {
            window.location.assign(`/sessions/${id}`);
          },
        },
        duration: 8000,
      });
    }
    prevPhaseRef.current = phase;
  }, [phase, completedSessionId]);

  return null;
}
