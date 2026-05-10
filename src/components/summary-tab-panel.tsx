import { MeetingMinutesMarkdown } from "@/components/meeting-minutes-markdown";
import { TabPanelBody } from "@/components/tab-panel-body";

export type SummaryTabUiState =
  | "idle"
  | "recording"
  | "summarizing"
  | "complete"
  | "error";

export type SummaryTabPanelProps = {
  state: SummaryTabUiState;
  /** `complete`일 때 표시할 회의록 본문(플레이스홀더 허용) */
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
          <div role="region" aria-label="회의록 안내">
            <p>
              녹음을 시작하면 스크립트가 쌓이고, 종료 후 회의록을 생성할 수
              있습니다.
            </p>
          </div>
        </TabPanelBody>
      );
    case "recording":
      return (
        <TabPanelBody scrollClassName="text-zinc-700 dark:text-zinc-300">
          <div role="status" aria-label="회의록 상태">
            <p>녹음 중입니다. 중지한 뒤 회의록을 준비합니다.</p>
          </div>
        </TabPanelBody>
      );
    case "summarizing":
      return (
        <TabPanelBody scrollClassName="text-zinc-700 dark:text-zinc-300">
          <div role="status" aria-label="회의록 생성 중">
            <p>회의록을 생성하는 중입니다…</p>
          </div>
        </TabPanelBody>
      );
    case "complete":
      return (
        <TabPanelBody>
          <div role="region" aria-label="회의록 결과">
            <div data-testid="summary-body" className="text-sm leading-relaxed">
              {summaryText ? (
                <MeetingMinutesMarkdown markdown={summaryText} />
              ) : (
                <p className="text-zinc-800 dark:text-zinc-200">
                  회의록이 여기에 표시됩니다.
                </p>
              )}
            </div>
          </div>
        </TabPanelBody>
      );
    case "error":
      return (
        <TabPanelBody
          variant="error"
          scrollClassName="text-red-800 dark:text-red-200"
        >
          <div role="alert" aria-label="회의록 오류">
            <p>
              {errorMessage ??
                "회의록을 가져오지 못했습니다. 잠시 후 다시 시도하세요."}
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
