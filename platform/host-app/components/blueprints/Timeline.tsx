import React, { useMemo, memo } from "react";
import { cn } from "@/lib/utils";
import { usePerformanceMonitor } from "./usePerformanceMonitor";

/**
 * Timeline Component - Optimized
 * Displays chronological events/activities
 */

export type TimelineEvent = {
  id: string;
  title: string;
  description?: string;
  timestamp: string | Date;
  icon?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  metadata?: Record<string, string>;
};

type TimelineProps = {
  events: TimelineEvent[];
  maxItems?: number;
  showDate?: boolean;
  dateFormat?: "relative" | "short" | "long";
  className?: string;
};

// 预定义样式常量 - 避免每次渲染重新创建
const VARIANT_STYLES: Record<string, string> = {
  default: "border-gray-300 dark:border-gray-600",
  success: "border-emerald-500",
  warning: "border-amber-500",
  danger: "border-red-500",
  info: "border-blue-500",
};

const ICON_BG_STYLES: Record<string, string> = {
  default: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
  success: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  danger: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  info: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
};

// 时间缓存 - 避免重复计算
const timeCache = new Map<string, { value: string; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

/**
 * 格式化日期 - 使用缓存优化
 */
const formatDate = (date: string | Date, dateFormat: string): string => {
  const d = new Date(date);
  const cacheKey = `${date.toString()}-${dateFormat}`;
  
  // 检查缓存
  const cached = timeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }
  
  let result: string;
  
  if (dateFormat === "relative") {
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) result = "Just now";
    else if (minutes < 60) result = `${minutes}m ago`;
    else if (hours < 24) result = `${hours}h ago`;
    else if (days < 7) result = `${days}d ago`;
    else result = d.toLocaleDateString();
  } else if (dateFormat === "short") {
    result = d.toLocaleDateString();
  } else {
    result = d.toLocaleString();
  }
  
  // 更新缓存
  timeCache.set(cacheKey, { value: result, timestamp: Date.now() });
  
  return result;
};

/**
 * Timeline 事件项组件 - 使用 memo 优化
 */
interface TimelineItemProps {
  event: TimelineEvent;
  index: number;
  totalItems: number;
  showDate: boolean;
  dateFormat: string;
}

const TimelineItem = memo<TimelineItemProps>(({ 
  event, 
  index, 
  totalItems, 
  showDate, 
  dateFormat 
}) => {
  const variant = event.variant || "default";
  const isLast = index === totalItems - 1;
  
  // 使用预定义样式
  const lineClass = VARIANT_STYLES[variant];
  const iconClass = ICON_BG_STYLES[variant];
  
  return (
    <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
      {/* Timeline line */}
      {!isLast && (
        <div 
          className={cn(
            "absolute left-4 top-10 bottom-0 w-0.5",
            lineClass
          )}
        />
      )}
      
      {/* Icon */}
      <div 
        className={cn(
          "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm",
          iconClass
        )}
      >
        {event.icon || "●"}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            {event.title}
          </h4>
          {showDate && (
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {formatDate(event.timestamp, dateFormat)}
            </span>
          )}
        </div>
        
        {event.description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {event.description}
          </p>
        )}
        
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(event.metadata).map(([key, value]) => (
              <span 
                key={key}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              >
                {key}: {value}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

TimelineItem.displayName = "TimelineItem";

/**
 * Timeline 主组件 - 优化版本
 */
export const Timeline = memo(function Timeline({
  events,
  maxItems,
  showDate = true,
  dateFormat = "relative",
  className,
}: TimelineProps) {
  // 性能监控
  usePerformanceMonitor("Timeline");

  // 使用 useMemo 缓存显示的事件
  const displayEvents = useMemo(
    () => (maxItems ? events.slice(0, maxItems) : events),
    [events, maxItems]
  );

  return (
    <div className={cn("space-y-0", className)}>
      {displayEvents.map((event, index) => (
        <TimelineItem
          key={event.id}
          event={event}
          index={index}
          totalItems={displayEvents.length}
          showDate={showDate}
          dateFormat={dateFormat}
        />
      ))}
      
      {events.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No events yet
        </div>
      )}
    </div>
  );
});

/**
 * Compact Timeline - for activity feeds - Optimized
 */
interface CompactTimelineProps {
  events: TimelineEvent[];
  maxItems?: number;
  className?: string;
}

export const CompactTimeline = memo(function CompactTimeline({
  events,
  maxItems = 5,
  className,
}: CompactTimelineProps) {
  // 使用 useMemo 缓存显示的事件
  const displayEvents = useMemo(
    () => events.slice(0, maxItems),
    [events, maxItems]
  );

  // 使用 useMemo 缓存格式化的时间
  const formattedTimes = useMemo(
    () => displayEvents.map(e => new Date(e.timestamp).toLocaleTimeString()),
    [displayEvents]
  );

  return (
    <div className={cn("space-y-3", className)}>
      {displayEvents.map((event, index) => (
        <div 
          key={event.id} 
          className="flex items-center gap-3 text-sm"
        >
          <span className="text-lg">{event.icon || "●"}</span>
          <div className="flex-1 min-w-0">
            <span className="text-gray-900 dark:text-white">{event.title}</span>
            {event.description && (
              <span className="text-gray-500"> - {event.description}</span>
            )}
          </div>
          <span className="text-xs text-gray-400 shrink-0">
            {formattedTimes[index]}
          </span>
        </div>
      ))}
    </div>
  );
});
