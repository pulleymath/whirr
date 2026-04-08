import { TabPanelBody } from "@/components/tab-panel-body";

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
        <TabPanelBody
          variant="dashed"
          scrollClassName="text-zinc-600 dark:text-zinc-400"
        >
          <div role="region" aria-label="요약 안내">
            <p>
              녹음을 시작하면 전사가 쌓이고, 종료 후 요약을 생성할 수 있습니다.
            </p>
          </div>
        </TabPanelBody>
      );
    case "recording":
      return (
        <TabPanelBody scrollClassName="text-zinc-700 dark:text-zinc-300">
          <div role="status" aria-label="요약 상태">
            <p>녹음 중입니다. 중지한 뒤 요약을 준비합니다.</p>
          </div>
        </TabPanelBody>
      );
    case "summarizing":
      return (
        <TabPanelBody scrollClassName="text-zinc-700 dark:text-zinc-300">
          <div role="status" aria-label="요약 생성 중">
            <p>요약을 생성하는 중입니다…</p>
          </div>
        </TabPanelBody>
      );
    case "complete":
      return (
        <TabPanelBody>
          <div role="region" aria-label="요약 결과">
            <p className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              요약
            </p>
            <p
              className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200"
              data-testid="summary-body"
            >
              {summaryText ?? "요약이 여기에 표시됩니다."}
            </p>
          </div>
        </TabPanelBody>
      );
    case "error":
      return (
        <TabPanelBody
          variant="error"
          scrollClassName="text-rose-800 dark:text-rose-200"
        >
          <div role="alert" aria-label="요약 오류">
            <p>
              {errorMessage ??
                "요약을 가져오지 못했습니다. 잠시 후 다시 시도하세요."}
            </p>
          </div>
        </TabPanelBody>
      );
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
