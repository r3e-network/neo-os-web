import React, { useEffect, useRef, useState } from "react";
import type { OnChainActivity } from "./types";

interface ActivityTickerProps {
  activities: OnChainActivity[];
  title?: string;
  maxItems?: number;
  scrollSpeed?: number;
  height?: number;
}

const ACTIVITY_ICONS: Record<string, string> = {
  transaction: "⚡",
  event: "📡",
  notification: "🔔",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500",
  confirmed: "bg-emerald-500",
  failed: "bg-red-500",
};

function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function truncateHash(hash: string | undefined): string {
  if (!hash) return "";
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

export const ActivityTicker = ({
  activities,
  title = "Live Activity",
  maxItems = 50,
  scrollSpeed = 30,
  height = 200,
}: ActivityTickerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<number>(0);

  // Auto-scroll effect (respects prefers-reduced-motion)
  useEffect(() => {
    if (!containerRef.current || activities.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const container = containerRef.current;
    let animationId: number;
    let lastTime = 0;

    const scroll = (time: number) => {
      if (!isPaused && container) {
        const delta = time - lastTime;
        if (delta > 16) {
          scrollRef.current += scrollSpeed / 1000;
          container.scrollTop = scrollRef.current;

          if (container.scrollTop >= container.scrollHeight - container.clientHeight) {
            scrollRef.current = 0;
            container.scrollTop = 0;
          }
          lastTime = time;
        }
      }
      animationId = requestAnimationFrame(scroll);
    };

    animationId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationId);
  }, [activities.length, isPaused, scrollSpeed]);

  const displayActivities = activities.slice(0, maxItems);

  return (
    <div
      className="bg-gray-100 dark:bg-black/40 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      role="region"
      aria-label={`${title} ticker`}
    >
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/20">
        <span className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="text-emerald-500 text-xs animate-pulse" aria-hidden="true">●</span><span className="sr-only">Live:</span> {title}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{activities.length} events</span>
      </div>
      <div
        ref={containerRef}
        className="overflow-y-hidden"
        style={{ height }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {displayActivities.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">No activity yet</div>
        ) : (
          <ul>
            {displayActivities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const ActivityItem = React.memo(({ activity }: { activity: OnChainActivity }) => {
  const icon = ACTIVITY_ICONS[activity.type] || "📌";
  const statusColor = activity.status ? STATUS_COLORS[activity.status] : undefined;

  return (
    <li className="flex gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
      <div className="text-base w-6 text-center shrink-0">{activity.app_icon || icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate" title={activity.title}>{activity.title}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
            {formatTimeAgo(activity.timestamp)}
          </span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate" title={activity.description}>{activity.description}</div>
        {activity.tx_hash && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              TX: {truncateHash(activity.tx_hash)}
            </span>
            {statusColor && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded text-white font-semibold uppercase ${statusColor}`}
              >
                {activity.status}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
});
