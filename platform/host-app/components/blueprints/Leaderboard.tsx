import React, { useMemo, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import { usePerformanceMonitor } from "./usePerformanceMonitor";

/**
 * Leaderboard Component - Optimized
 * Displays rankings with scores
 */

export type LeaderboardEntry = {
  rank: number;
  address?: string;
  name?: string;
  avatar?: string;
  score: number | string;
  change?: number;
  metadata?: Record<string, string | number>;
};

type LeaderboardProps = {
  entries: LeaderboardEntry[];
  title?: string;
  columns?: Array<{
    key: string;
    label: string;
    align?: "left" | "center" | "right";
    format?: "number" | "currency" | "percent" | "text";
  }>;
  maxRows?: number;
  showAvatar?: boolean;
  highlightUser?: string;
  onRowClick?: (entry: LeaderboardEntry) => void;
  className?: string;
};

// 预定义的排名徽章 - 避免每次渲染重新创建
const RANK_BADGES: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

// 默认列配置 - 使用 useMemo 缓存
const DEFAULT_COLUMNS = [
  { key: "rank", label: "#", align: "center" as const },
  { key: "name", label: "Player", align: "left" as const },
  { key: "score", label: "Score", align: "right" as const },
];

/**
 * 获取排名徽章 - 使用查找表优化
 */
const getRankBadge = (rank: number): React.ReactNode => {
  return RANK_BADGES[rank] ?? rank;
};

/**
 * 格式化数值
 */
const formatValue = (value: string | number, format?: string): string => {
  if (format === "currency") return `$${Number(value).toLocaleString()}`;
  if (format === "percent") return `${Number(value).toFixed(1)}%`;
  if (format === "number") return Number(value).toLocaleString();
  return String(value);
};

/**
 * Leaderboard 行组件 - 使用 memo 优化
 */
interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  columns: typeof DEFAULT_COLUMNS;
  showAvatar: boolean;
  highlightUser?: string;
  onRowClick?: (entry: LeaderboardEntry) => void;
}

const LeaderboardRow = memo<LeaderboardRowProps>(({ 
  entry, 
  columns, 
  showAvatar, 
  highlightUser, 
  onRowClick 
}) => {
  const handleClick = useCallback(() => {
    onRowClick?.(entry);
  }, [onRowClick, entry]);

  const getCellValue = (col: typeof columns[0]) => {
    if (col.key === "rank") {
      return getRankBadge(entry.rank);
    }
    if (col.key === "name") {
      return (
        <div className="flex items-center gap-3">
          {showAvatar && (
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium">
              {entry.avatar || (entry.name?.charAt(0) || entry.address?.slice(0, 2) || "?")}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-medium truncate">
              {entry.name || entry.address?.slice(0, 6) + "..." + entry.address?.slice(-4) || "Anonymous"}
            </div>
            {entry.change !== undefined && entry.change !== 0 && (
              <div className={cn("text-xs", entry.change > 0 ? "text-emerald-500" : "text-red-500")}>
                {entry.change > 0 ? "↑" : "↓"} {Math.abs(entry.change)}
              </div>
            )}
          </div>
        </div>
      );
    }
    return formatValue(entry[col.key as keyof LeaderboardEntry] as string | number, (col as any).format);
  };

  return (
    <tr
      className={cn(
        "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
        highlightUser && entry.address === highlightUser && "bg-neo/5",
        onRowClick && "cursor-pointer"
      )}
      onClick={handleClick}
    >
      {columns.map((col) => (
        <td
          key={col.key}
          className={cn(
            "px-4 py-3",
            col.align === "center" && "text-center",
            col.align === "right" && "text-right"
          )}
        >
          {getCellValue(col)}
        </td>
      ))}
    </tr>
  );
});

LeaderboardRow.displayName = "LeaderboardRow";

/**
 * 表头组件 - 使用 memo 优化
 */
interface LeaderboardHeaderProps {
  columns: typeof DEFAULT_COLUMNS;
}

const LeaderboardHeader = memo<LeaderboardHeaderProps>(({ columns }) => (
  <thead className="bg-gray-50 dark:bg-gray-800/50">
    <tr>
      {columns.map((col) => (
        <th
          key={col.key}
          className={cn(
            "px-4 py-2 text-xs font-semibold uppercase text-gray-500",
            col.align === "center" && "text-center",
            col.align === "right" && "text-right"
          )}
        >
          {col.label}
        </th>
      ))}
    </tr>
  </thead>
));

LeaderboardHeader.displayName = "LeaderboardHeader";

/**
 * Leaderboard 主组件 - 优化版本
 */
export const Leaderboard = memo(function Leaderboard({
  entries,
  title = "Leaderboard",
  columns,
  maxRows,
  showAvatar = true,
  highlightUser,
  onRowClick,
  className,
}: LeaderboardProps) {
  // 性能监控
  usePerformanceMonitor("Leaderboard");

  // 使用 useMemo 缓存列配置
  const cols = useMemo(() => columns || DEFAULT_COLUMNS, [columns]);
  
  // 使用 useMemo 缓存显示的数据
  const displayEntries = useMemo(
    () => (maxRows ? entries.slice(0, maxRows) : entries),
    [entries, maxRows]
  );

  // 使用 useCallback 缓存行点击回调
  const handleRowClick = useCallback(
    (entry: LeaderboardEntry) => {
      onRowClick?.(entry);
    },
    [onRowClick]
  );

  return (
    <div className={cn("rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden", className)}>
      {title && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold">{title}</h3>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <LeaderboardHeader columns={cols as any} />
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {displayEntries.map((entry) => (
              <LeaderboardRow
                key={entry.rank}
                entry={entry}
                columns={cols as any}
                showAvatar={showAvatar}
                highlightUser={highlightUser}
                onRowClick={handleRowClick}
              />
            ))}
          </tbody>
        </table>
      </div>

      {entries.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No rankings yet
        </div>
      )}
    </div>
  );
});

/**
 * Mini Leaderboard - Compact version for sidebars - Optimized
 */
interface MiniLeaderboardProps {
  entries: LeaderboardEntry[];
  maxItems?: number;
  className?: string;
}

export const MiniLeaderboard = memo(function MiniLeaderboard({
  entries,
  maxItems = 5,
  className,
}: MiniLeaderboardProps) {
  // 使用 useMemo 缓存截断后的数据
  const displayEntries = useMemo(
    () => entries.slice(0, maxItems),
    [entries, maxItems]
  );

  return (
    <div className={cn("space-y-2", className)}>
      {displayEntries.map((entry) => (
        <div
          key={entry.rank}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <span className="w-6 text-center text-sm font-medium">
            {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : entry.rank}
          </span>
          <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs">
            {entry.name?.charAt(0) || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {entry.name || entry.address?.slice(0, 4) + "..." || "Anonymous"}
            </div>
          </div>
          <div className="text-sm font-semibold text-neo">
            {typeof entry.score === "number" ? entry.score.toLocaleString() : entry.score}
          </div>
        </div>
      ))}
    </div>
  );
});
