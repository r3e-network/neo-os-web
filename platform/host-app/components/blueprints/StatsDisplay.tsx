/**
 * Stats Display Component - Refactored with Design System
 * Uses unified UI components, animations, and theming
 */

import React, { useMemo, memo, useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { usePerformanceMonitor } from "./usePerformanceMonitor";
import { useTheme } from "@/lib/design-system/theme";
import { Card } from "@/components/ui";
import { easeOutCubic } from "@/lib/design-system/animations";

/**
 * Stats Display Component - Optimized
 * Configurable stat cards for displaying metrics
 */

export type StatItem = {
  key: string;
  label: string;
  value: string | number;
  icon?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  format?: "number" | "currency" | "percent" | "date" | "duration";
};

type StatsDisplayProps = {
  stats: StatItem[];
  columns?: 2 | 3 | 4;
  className?: string;
};

// 预定义网格列样式
const GRID_COLS: Record<2 | 3 | 4, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
};

// 预定义趋势颜色 - 使用设计系统
const TREND_COLORS: Record<string, { text: string; bg: string }> = {
  up: { text: "text-emerald-400", bg: "bg-emerald-500/10" },
  down: { text: "text-red-400", bg: "bg-red-500/10" },
  neutral: { text: "text-gray-400", bg: "bg-gray-500/10" },
};

/**
 * 格式化数值 - 使用 useMemo 在父组件中缓存
 */
const formatValue = (value: string | number, format?: string): string => {
  if (typeof value === "string") return value;
  
  switch (format) {
    case "number":
      return value.toLocaleString();
    case "currency":
      return typeof value === "number" ? `$${value.toFixed(2)}` : String(value);
    case "percent":
      return `${value}%`;
    case "date":
      return new Date(value).toLocaleDateString();
    case "duration":
      if (typeof value !== "number") return String(value);
      if (value < 60) return `${value}s`;
      if (value < 3600) return `${Math.floor(value / 60)}m`;
      if (value < 86400) return `${Math.floor(value / 3600)}h`;
      return `${Math.floor(value / 86400)}d`;
    default:
      return typeof value === "number" ? value.toLocaleString() : String(value);
  }
};

/**
 * StatCard 组件 - 使用 memo 优化
 */
interface StatCardProps {
  stat: StatItem;
}

const StatCard = memo<StatCardProps>(({ stat }) => {
  const { isDark } = useTheme();
  
  const formattedValue = useMemo(
    () => formatValue(stat.value, stat.format),
    [stat.value, stat.format]
  );

  const trendStyle = stat.trend ? TREND_COLORS[stat.trend] : null;

  return (
    <Card
      variant={isDark ? "elevated" : "outlined"}
      padding="md"
      className="transition-all duration-200 hover:scale-[1.02]"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {stat.label}
          </p>
          <p className="text-xl font-bold text-white dark:text-white mt-1">
            {formattedValue}
          </p>
        </div>
        {stat.icon && (
          <span className="text-2xl" role="img" aria-label={stat.label}>
            {stat.icon}
          </span>
        )}
      </div>
      {stat.trend && (
        <div className={cn("text-xs mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full", trendStyle?.bg)}>
          <span className={trendStyle?.text}>
            {stat.trend === "up" && "↑ "}
            {stat.trend === "down" && "↓ "}
          </span>
          <span className={trendStyle?.text}>
            {stat.trendValue}
          </span>
        </div>
      )}
    </Card>
  );
});

StatCard.displayName = "StatCard";

/**
 * StatsDisplay 主组件 - 优化版本
 */
export const StatsDisplay = memo(function StatsDisplay({
  stats,
  columns = 4,
  className,
}: StatsDisplayProps) {
  // 性能监控
  usePerformanceMonitor("StatsDisplay");

  // 使用 useMemo 缓存网格列类名
  const gridColsClass = useMemo(
    () => GRID_COLS[columns],
    [columns]
  );

  return (
    <div className={cn("grid", gridColsClass, "gap-4", className)}>
      {stats.map((stat) => (
        <StatCard key={stat.key} stat={stat} />
      ))}
    </div>
  );
});

/**
 * Compact Stats Row - Optimized
 */
type StatsRowProps = {
  stats: StatItem[];
  className?: string;
};

export const StatsRow = memo(function StatsRow({ stats, className }: StatsRowProps) {
  const { isDark } = useTheme();
  
  // 使用 useMemo 缓存格式化后的值
  const formattedStats = useMemo(
    () => stats.map(stat => ({
      ...stat,
      formattedValue: formatValue(stat.value, stat.format),
    })),
    [stats]
  );

  return (
    <div className={cn("flex flex-wrap gap-6", className)}>
      {formattedStats.map((stat) => (
        <div key={stat.key} className="flex items-center gap-2">
          {stat.icon && <span>{stat.icon}</span>}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {stat.label}:
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {stat.formattedValue}
          </span>
        </div>
      ))}
    </div>
  );
});

/**
 * Animated Counter - 带动画效果的数字
 */
interface AnimatedCounterProps {
  value: number;
  format?: "number" | "currency" | "percent";
  duration?: number;
  className?: string;
}

export const AnimatedCounter = memo(function AnimatedCounter({
  value,
  format = "number",
  duration = 1000,
  className,
}: AnimatedCounterProps) {
  const displayValue = useRef(0);
  const [display, setDisplay] = useState(0);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    startTime.current = Date.now();
    displayValue.current = 0;

    const animate = () => {
      if (!startTime.current) return;
      
      const elapsed = Date.now() - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用缓动函数
      const easedProgress = easeOutCubic(progress);
      displayValue.current = value * easedProgress;
      
      setDisplay(displayValue.current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  const formatted = useMemo(() => {
    if (format === "currency") return `$${displayValue.current.toFixed(2)}`;
    if (format === "percent") return `${displayValue.current.toFixed(1)}%`;
    return Math.round(displayValue.current).toLocaleString();
  }, [display, format]);

  return <span className={className}>{formatted}</span>;
});
