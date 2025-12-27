import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FC } from "react";
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
  pending: "#f59e0b",
  confirmed: "#10b981",
  failed: "#ef4444",
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

export const ActivityTicker: FC<ActivityTickerProps> = ({
  activities,
  title = "Live Activity",
  maxItems = 50,
  scrollSpeed = 30,
  height = 200,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<number>(0);

  // Auto-scroll effect
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

          // Reset scroll when reaching bottom
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
    <div style={tickerContainerStyle}>
      <div style={tickerHeaderStyle}>
        <span style={tickerTitleStyle}>
          <span style={liveDotStyle}>●</span> {title}
        </span>
        <span style={tickerCountStyle}>{activities.length} events</span>
      </div>
      <div
        ref={containerRef}
        style={{ ...tickerContentStyle, height }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {displayActivities.length === 0 ? (
          <div style={emptyStateStyle}>No activity yet</div>
        ) : (
          displayActivities.map((activity) => <ActivityItem key={activity.id} activity={activity} />)
        )}
      </div>
    </div>
  );
};

const ActivityItem: FC<{ activity: OnChainActivity }> = ({ activity }) => {
  const icon = ACTIVITY_ICONS[activity.type] || "📌";
  const statusColor = activity.status ? STATUS_COLORS[activity.status] : undefined;

  return (
    <div style={activityItemStyle}>
      <div style={activityIconStyle}>{activity.app_icon || icon}</div>
      <div style={activityContentStyle}>
        <div style={activityTitleRowStyle}>
          <span style={activityTitleStyle}>{activity.title}</span>
          <span style={activityTimeStyle}>{formatTimeAgo(activity.timestamp)}</span>
        </div>
        <div style={activityDescStyle}>{activity.description}</div>
        {activity.tx_hash && (
          <div style={activityMetaStyle}>
            <span style={txHashStyle}>TX: {truncateHash(activity.tx_hash)}</span>
            {statusColor && (
              <span style={{ ...statusBadgeStyle, backgroundColor: statusColor }}>{activity.status}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Styles
const tickerContainerStyle: CSSProperties = {
  background: "rgba(0, 0, 0, 0.4)",
  borderRadius: 12,
  border: "1px solid rgba(255, 255, 255, 0.1)",
  overflow: "hidden",
};

const tickerHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
  background: "rgba(0, 0, 0, 0.2)",
};

const tickerTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#fff",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const liveDotStyle: CSSProperties = {
  color: "#10b981",
  fontSize: 10,
  animation: "pulse 2s ease-in-out infinite",
};

const tickerCountStyle: CSSProperties = {
  fontSize: 12,
  color: "rgba(255, 255, 255, 0.5)",
};

const tickerContentStyle: CSSProperties = {
  overflowY: "hidden",
  scrollBehavior: "smooth",
};

const emptyStateStyle: CSSProperties = {
  padding: 24,
  textAlign: "center",
  color: "rgba(255, 255, 255, 0.4)",
  fontSize: 14,
};

const activityItemStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  padding: "10px 16px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
};

const activityIconStyle: CSSProperties = {
  fontSize: 16,
  width: 24,
  textAlign: "center",
  flexShrink: 0,
};

const activityContentStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const activityTitleRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const activityTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#fff",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const activityTimeStyle: CSSProperties = {
  fontSize: 11,
  color: "rgba(255, 255, 255, 0.4)",
  flexShrink: 0,
};

const activityDescStyle: CSSProperties = {
  fontSize: 12,
  color: "rgba(255, 255, 255, 0.6)",
  marginTop: 2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const activityMetaStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: 4,
};

const txHashStyle: CSSProperties = {
  fontSize: 10,
  color: "rgba(255, 255, 255, 0.3)",
  fontFamily: "monospace",
};

const statusBadgeStyle: CSSProperties = {
  fontSize: 9,
  padding: "2px 6px",
  borderRadius: 4,
  color: "#fff",
  fontWeight: 600,
  textTransform: "uppercase",
};

export default ActivityTicker;
