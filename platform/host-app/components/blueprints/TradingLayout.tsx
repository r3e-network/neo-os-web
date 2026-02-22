import React, { useMemo, memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { OperationPanel } from "@/components/OperationPanel";
import type { OperationEntry } from "@/components/types";
import { usePerformanceMonitor } from "./usePerformanceMonitor";

/**
 * Trading Layout - Polymarket Style - Optimized
 * Left: Market info, tabs, stats
 * Right: Operation panel (sticky)
 */

export type TradingLayoutProps = {
  children?: React.ReactNode;
  hero?: React.ReactNode;
  leftPanel?: React.ReactNode;
  rightPanel?: React.ReactNode;
  tabs?: React.ReactNode;
  stats?: React.ReactNode;
  operations?: OperationEntry[];
  onInvoke?: (operation: OperationEntry, values: Record<string, string>) => Promise<void>;
  operationPanelConfig?: {
    title?: string;
    subtitle?: string;
    ctaLabel?: string;
    showCta?: boolean;
    onCtaClick?: () => void;
  };
  className?: string;
};

/**
 * ContractInfoCard 组件 - 使用 memo 优化
 */
const ContractInfoCard = memo(function ContractInfoCard() {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Contract Details
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Contract information will be displayed here.
      </p>
    </div>
  );
});

ContractInfoCard.displayName = "ContractInfoCard";

/**
 * Hero Section 组件 - 使用 memo 优化
 */
const HeroSection = memo<{ children: React.ReactNode }>(({ children }) => (
  <section className="border-b border-gray-200 dark:border-gray-800">
    {children}
  </section>
));

HeroSection.displayName = "HeroSection";

/**
 * Stats Bar 组件 - 使用 memo 优化
 */
const StatsBar = memo<{ children: React.ReactNode }>(({ children }) => (
  <section className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
    {children}
  </section>
));

StatsBar.displayName = "StatsBar";

/**
 * TradingLayout 主组件 - 优化版本
 */
export const TradingLayout = memo(function TradingLayout({
  children,
  hero,
  leftPanel,
  rightPanel,
  tabs,
  stats,
  operations,
  onInvoke,
  operationPanelConfig,
  className,
}: TradingLayoutProps) {
  // 性能监控
  usePerformanceMonitor("TradingLayout");

  // 使用 useMemo 缓存右侧面板标题
  const panelTitle = useMemo(
    () => operationPanelConfig?.title || "Trade",
    [operationPanelConfig?.title]
  );

  // 使用 useMemo 缓存 CTA 标签
  const ctaLabel = useMemo(
    () => operationPanelConfig?.ctaLabel || "Launch",
    [operationPanelConfig?.ctaLabel]
  );

  // 使用 useCallback 缓存 CTA 点击处理函数
  const handleCtaClick = useCallback(
    () => operationPanelConfig?.onCtaClick?.(),
    [operationPanelConfig?.onCtaClick]
  );

  // 使用 useMemo 缓存是否显示操作面板
  const showOperationPanel = useMemo(
    () => rightPanel || (operations && onInvoke),
    [rightPanel, operations, onInvoke]
  );

  // 使用 useMemo 缓存是否显示 CTA
  const showCta = useMemo(
    () => operationPanelConfig?.showCta !== false,
    [operationPanelConfig?.showCta]
  );

  return (
    <div className={cn("min-h-screen bg-white dark:bg-gray-950", className)}>
      {/* Hero Section */}
      {hero && <HeroSection>{hero}</HeroSection>}

      {/* Stats Bar */}
      {stats && <StatsBar>{stats}</StatsBar>}

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
          {/* Left Panel - Main Content */}
          <div className="space-y-6">
            {/* Tabs */}
            {tabs && <section>{tabs}</section>}
            
            {/* Default Left Panel Content */}
            {leftPanel && <section>{leftPanel}</section>}
            
            {/* Children */}
            {children}
          </div>

          {/* Right Panel - Operation Panel */}
          {showOperationPanel && (
            <aside className="xl:sticky xl:top-6 self-start space-y-4">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 p-5">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {panelTitle}
                </h2>
                {operationPanelConfig?.subtitle && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {operationPanelConfig.subtitle}
                  </p>
                )}

                {operations && onInvoke && (
                  <div className="mt-4">
                    <OperationPanel
                      operations={operations}
                      onInvoke={onInvoke}
                      showTitle={false}
                    />
                  </div>
                )}

                {rightPanel}

                {showCta && (
                  <button
                    type="button"
                    className="mt-4 w-full px-6 py-3 rounded-xl border-none bg-neo text-black text-sm font-bold cursor-pointer transition-all hover:bg-neo/90"
                    onClick={handleCtaClick}
                  >
                    {ctaLabel} →
                  </button>
                )}
              </div>

              {/* Contract Info Card */}
              <ContractInfoCard />
            </aside>
          )}
        </div>
      </main>
    </div>
  );
});

export default TradingLayout;
