import { useEffect, useRef, useState } from "react";
import type { FC } from "react";
import { useRouter } from "next/router";
import type { OnChainActivity } from "./types";
import { cn, formatTimeAgoShort } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/react";

interface ActivityTickerProps {
  activities: OnChainActivity[];
  title?: string;
  maxItems?: number;
  scrollSpeed?: number;
  height?: number;
  onItemClick?: (activity: OnChainActivity) => void;
}

const ACTIVITY_ICONS: Record<string, string> = {
  transaction: "⚡",
  event: "📡",
  notification: "🔔",
};

function truncateHash(hash: string | undefined): string {
  if (!hash) return "";
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

export const ActivityTicker: FC<ActivityTickerProps> = ({
  activities,
  title,
  maxItems = 50,
  scrollSpeed = 30,
  height = 200,
  onItemClick,
}) => {
  const { t } = useTranslation("host");
  const { t: tCommon, locale } = useTranslation("common");
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<number>(0);
  const displayTitle = title || t("activity.live");

  useEffect(() => {
    if (!containerRef.current || activities.length === 0) return;

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
    <div className="bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl backdrop-blur-md shadow-sm overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3 bg-gray-50/50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
        <span className="text-sm font-bold uppercase tracking-widest text-gray-900 dark:text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-neo animate-pulse shadow-[0_0_10px_#00E599]" />
          {displayTitle}
        </span>
        <span className="text-xs font-semibold font-mono text-gray-500 dark:text-white/60 bg-white dark:bg-white/5 px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10">
          {activities.length} {t("activity.events")}
        </span>
      </div>
      <div
        ref={containerRef}
        className="overflow-y-hidden scroll-smooth relative"
        style={{ height }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {displayActivities.length === 0 ? (
          <div className="p-8 text-center text-sm font-medium uppercase opacity-60 italic text-gray-500 dark:text-white/50">
            {t("activity.waiting")}
          </div>
        ) : (
          <div className="flex flex-col">
            {displayActivities.map((activity) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                tCommon={tCommon}
                locale={locale}
                onClick={() => {
                  if (onItemClick) {
                    onItemClick(activity);
                  } else if (activity.app_id) {
                    router.push(`/miniapps/${activity.app_id}`);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ActivityItem: FC<{
  activity: OnChainActivity;
  onClick?: () => void;
  tCommon: (key: string, options?: Record<string, string | number>) => string;
  locale: string;
}> = ({ activity, onClick, tCommon, locale }) => {
  const icon = ACTIVITY_ICONS[activity.type] || "📌";
  const statusLabel =
    activity.status === "pending"
      ? tCommon("status.pending")
      : activity.status === "confirmed"
        ? tCommon("status.confirmed")
        : activity.status === "failed"
          ? tCommon("status.failed")
          : activity.status ?? "";

  // Adjusted status classes for glass theme
  const GLASS_STATUS_CLASSES: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    confirmed: "bg-neo/20 text-neo border-neo/30",
    failed: "bg-red-500/20 text-red-500 border-red-500/30",
  };

  const statusClass = activity.status ? GLASS_STATUS_CLASSES[activity.status] : "";
  const isClickable = Boolean(onClick && activity.app_id);

  return (
    <div
      className={cn(
        "relative z-10 flex gap-3 px-4 py-3 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group",
        isClickable && "cursor-pointer",
      )}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === "Enter" && onClick?.() : undefined}
    >
      <div className="w-10 h-10 flex-shrink-0 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full flex items-center justify-center text-lg text-gray-600 dark:text-white/80 shadow-none group-hover:scale-105 transition-transform">
        {activity.app_icon || icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <span className="text-xs font-bold uppercase leading-tight truncate text-gray-900 dark:text-white">
            {activity.title}
          </span>
          <span className="text-[10px] font-bold font-mono text-gray-400 dark:text-white/50 px-1 leading-4">
            {formatTimeAgoShort(activity.timestamp, { t: tCommon, locale })}
          </span>
        </div>
        <div className="text-[11px] font-medium text-gray-500 dark:text-white/60 truncate mt-1 group-hover:text-gray-700 dark:group-hover:text-white/80">
          {activity.description}
        </div>
        {activity.tx_hash && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] font-bold font-mono bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 border border-gray-200 dark:border-white/10 rounded-sm hover:bg-gray-200 dark:hover:bg-white/10 cursor-help text-gray-500 dark:text-white/60">
              #: {truncateHash(activity.tx_hash)}
            </span>
            {statusClass && (
              <span
                className={cn(
                  "text-[9px] font-bold uppercase px-2 py-0.5 border rounded-full shadow-none",
                  statusClass,
                )}
              >
                {statusLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityTicker;
