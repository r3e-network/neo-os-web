import { useEffect, useRef, useState } from "react";
import type { FC } from "react";
import type { OnChainActivity } from "./types";
import { cn } from "@/lib/utils";

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

const STATUS_CLASSES: Record<string, string> = {
  pending: "bg-brutal-yellow text-black border-black",
  confirmed: "bg-neo text-black border-black",
  failed: "bg-brutal-red text-white border-black",
};

function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function truncateHash(hash: string | undefined): string {
  if (!hash) return "";
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

export const ActivityTicker: FC<ActivityTickerProps> = ({
  activities,
  title = "Live activity",
  maxItems = 50,
  scrollSpeed = 30,
  height = 200,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<number>(0);

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
    <div className="bg-white border-4 border-black shadow-[6px_6px_0_#000] overflow-hidden">
      <div className="flex justify-between items-center px-4 py-2 bg-black border-b-4 border-black">
        <span className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-white bg-neo animate-pulse shadow-[0_0_10px_#00E599]" />
          {title}
        </span>
        <span className="text-xs font-black font-mono text-white/80 uppercase bg-white/10 px-2 py-0.5 rounded-none border border-white/20">
          {activities.length} EVENTS
        </span>
      </div>
      <div
        ref={containerRef}
        className="overflow-y-hidden scroll-smooth bg-white relative"
        style={{ height }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#000_1px,transparent_0)] bg-[size:12px_12px]" />

        {displayActivities.length === 0 ? (
          <div className="p-8 text-center text-sm font-black uppercase opacity-40 italic">
            Waiting for activity...
          </div>
        ) : (
          displayActivities.map((activity) => <ActivityItem key={activity.id} activity={activity} />)
        )}
      </div>
    </div>
  );
};

const ActivityItem: FC<{ activity: OnChainActivity }> = ({ activity }) => {
  const icon = ACTIVITY_ICONS[activity.type] || "📌";
  const statusClass = activity.status ? STATUS_CLASSES[activity.status] : "";

  return (
    <div className="relative z-10 flex gap-3 px-4 py-3 border-b-2 border-black hover:bg-brutal-yellow transition-colors group">
      <div className="w-10 h-10 flex-shrink-0 bg-white border-2 border-black flex items-center justify-center text-lg shadow-[2px_2px_0_#000] group-hover:rotate-6 transition-transform">
        {activity.app_icon || icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <span className="text-xs font-black uppercase leading-tight truncate group-hover:text-black">{activity.title}</span>
          <span className="text-[10px] font-black font-mono bg-black text-white px-1 leading-4">{formatTimeAgo(activity.timestamp)}</span>
        </div>
        <div className="text-[11px] font-bold text-gray-600 truncate mt-1 group-hover:text-black">{activity.description}</div>
        {activity.tx_hash && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] font-black font-mono bg-gray-100 px-1.5 py-0.5 border border-black hover:bg-white cursor-help">
              #: {truncateHash(activity.tx_hash)}
            </span>
            {statusClass && (
              <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 border-2 shadow-[1px_1px_0_#000]", statusClass)}>
                {activity.status}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityTicker;
