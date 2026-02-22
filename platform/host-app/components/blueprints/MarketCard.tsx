/**
 * Generic Market Card Component - Refactored with Design System
 * Uses unified design tokens, animations, and accessibility features
 */

import React, { useMemo, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import { usePerformanceMonitor } from "./usePerformanceMonitor";
import { useTheme } from "@/lib/design-system/theme";
import { transitions, keyframes, easings } from "@/lib/design-system/animations";
import { Card, CardBadge } from "@/components/ui";
import { generateAriaId } from "@/lib/design-system/a11y";

/**
 * Generic Market Card Component - Optimized
 * Used for displaying items in trading layout
 */

export type MarketCardData = {
  id: string;
  title: string;
  description?: string;
  status?: "active" | "resolved" | "pending";
  outcomes?: MarketOutcome[];
  stats?: Record<string, string | number>;
  imageUrl?: string;
  endDate?: string;
  winningOutcome?: string;
};

export type MarketOutcome = {
  id: string;
  label: string;
  probability: number;
  volume?: string;
  price?: string;
};

type MarketCardProps = {
  data: MarketCardData;
  onSelect?: (id: string) => void;
  selected?: boolean;
  className?: string;
};

// 预定义状态样式 - 使用设计系统颜色
const STATUS_VARIANTS: Record<string, "success" | "default" | "warning"> = {
  active: "success",
  resolved: "default",
  pending: "warning",
};

// 使用 useTheme 获取主题
const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  resolved: "Resolved",
  pending: "Pending",
};

/**
 * StatusBadge 组件 - 使用 memo 优化
 */
const StatusBadge = memo<{ status?: string }>(({ status }) => {
  if (!status) return null;

  const variant = STATUS_VARIANTS[status] || "default";
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <CardBadge variant={variant}>
      {label}
    </CardBadge>
  );
});

StatusBadge.displayName = "StatusBadge";

/**
 * OutcomeBar 组件 - 使用 memo 优化
 */
interface OutcomeBarProps {
  outcome: MarketOutcome;
  isWinner?: boolean;
}

const OutcomeBar = memo<OutcomeBarProps>(({ outcome, isWinner }) => {
  const { isDark } = useTheme();
  
  const percent = useMemo(
    () => outcome.probability * 100,
    [outcome.probability]
  );

  const formattedPercent = useMemo(
    () => percent.toFixed(1),
    [percent]
  );

  const barColor = isWinner 
    ? (isDark ? "#10B981" : "#059669") 
    : (isDark ? "#00E599" : "#00B377");

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className={cn(
          "text-sm font-medium",
          isWinner 
            ? "text-emerald-500 dark:text-emerald-400" 
            : "text-gray-700 dark:text-gray-300"
        )}>
          {outcome.label}
          {isWinner && (
            <span className="ml-1 text-emerald-500" aria-label="Winner">
              ✓
            </span>
          )}
        </span>
        <span className="text-sm font-bold text-neo">
          {formattedPercent}%
        </span>
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{ 
            width: `${percent}%`,
            backgroundColor: barColor,
          }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${outcome.label}: ${formattedPercent}%`}
        />
      </div>
      {(outcome.volume || outcome.price) && (
        <div className="flex justify-between mt-1 text-xs text-gray-400">
          {outcome.price && <span>Price: {outcome.price}</span>}
          {outcome.volume && <span>Vol: {outcome.volume}</span>}
        </div>
      )}
    </div>
  );
});

OutcomeBar.displayName = "OutcomeBar";

/**
 * MarketCard 主组件 - 优化版本
 */
export const MarketCard = memo(function MarketCard({
  data,
  onSelect,
  selected,
  className,
}: MarketCardProps) {
  const { isDark } = useTheme();
  
  // 性能监控
  usePerformanceMonitor("MarketCard");

  const isResolved = data.status === "resolved";
  const cardId = useMemo(() => generateAriaId("market-card"), []);

  // 使用 useCallback 缓存点击处理函数
  const handleClick = useCallback(() => {
    onSelect?.(data.id);
  }, [onSelect, data.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect?.(data.id);
      }
    },
    [onSelect, data.id]
  );

  // 使用 useMemo 缓存格式化后的统计数据
  const formattedStats = useMemo(
    () => data.stats
      ? Object.entries(data.stats).map(([key, value]) => ({
          key,
          label: key.replace(/_/g, " "),
          value: typeof value === "number" ? value.toLocaleString() : value,
        }))
      : [],
    [data.stats]
  );

  // 使用 useMemo 缓存格式化后的结束日期
  const formattedEndDate = useMemo(
    () => data.endDate
      ? new Date(data.endDate).toLocaleString()
      : null,
    [data.endDate]
  );

  return (
    <Card
      interactive
      hoverable
      padding="md"
      className={cn(
        "w-full text-left transition-all duration-200",
        selected
          ? "border-neo bg-neo/5"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600",
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${data.title}${data.status ? `, status: ${data.status}` : ""}`}
      id={cardId}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          {data.imageUrl && (
            <img 
              src={data.imageUrl} 
              alt="" 
              className="w-10 h-10 rounded-lg object-cover mb-2"
            />
          )}
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
            {data.title}
          </h3>
          {data.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
              {data.description}
            </p>
          )}
        </div>
        <StatusBadge status={data.status} />
      </div>

      {/* Outcomes */}
      {data.outcomes && data.outcomes.length > 0 && (
        <div className="space-y-2 mb-3">
          {data.outcomes.map((outcome) => (
            <OutcomeBar 
              key={outcome.id} 
              outcome={outcome}
              isWinner={isResolved && data.winningOutcome === outcome.id}
            />
          ))}
        </div>
      )}

      {/* Stats */}
      {formattedStats.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
          {formattedStats.map(({ key, label, value }) => (
            <span key={key}>
              <span className="capitalize">{label}: </span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {value}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* End Date */}
      {formattedEndDate && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          {isResolved ? "Ended" : "Ends"}: {formattedEndDate}
        </p>
      )}
    </Card>
  );
});

/**
 * Market List Component - Optimized
 */
type MarketListProps = {
  markets: MarketCardData[];
  onSelect?: (id: string) => void;
  selectedId?: string;
  className?: string;
};

export const MarketList = memo(function MarketList({
  markets,
  onSelect,
  selectedId,
  className,
}: MarketListProps) {
  // 使用 useMemo 缓存选择状态检查
  const isSelected = useCallback(
    (id: string) => selectedId === id,
    [selectedId]
  );

  return (
    <div 
      className={cn("space-y-4", className)}
      role="listbox"
      aria-label="Markets"
    >
      {markets.map((market) => (
        <MarketCard
          key={market.id}
          data={market}
          onSelect={onSelect}
          selected={isSelected(market.id)}
        />
      ))}
    </div>
  );
});
