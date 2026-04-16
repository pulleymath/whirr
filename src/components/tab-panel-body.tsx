import type { ReactNode } from "react";

export type TabPanelBodyVariant = "solid" | "dashed" | "error";

const variantClass: Record<TabPanelBodyVariant, string> = {
  solid:
    "border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
  dashed:
    "border-dashed border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/40",
  error:
    "border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/40",
};

export type TabPanelBodyProps = {
  children: ReactNode;
  variant?: TabPanelBodyVariant;
  className?: string;
  /** 패널 내부 스크롤 영역에 추가 클래스 */
  scrollClassName?: string;
};

/** 실시간 스크립트 / 요약 탭 본문 공통 스캐폴드 */
export function TabPanelBody({
  children,
  variant = "solid",
  className = "",
  scrollClassName = "",
}: TabPanelBodyProps) {
  return (
    <div
      data-testid="tab-panel-body"
      className={`flex min-h-[14rem] max-h-[min(50vh,22rem)] w-full flex-col overflow-hidden rounded-xl border p-6 ${variantClass[variant]} ${className}`}
    >
      <div
        className={`min-h-0 flex-1 overflow-y-auto text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 ${scrollClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
