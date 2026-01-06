import React from "react";
import { MiniAppNotification } from "./types";
import { colors } from "./styles";

type Props = {
  notifications: MiniAppNotification[];
  loading?: boolean;
};

export function AppNewsList({ notifications, loading }: Props) {
  if (loading) return <div className="p-8 text-center text-xs font-black uppercase opacity-50 bg-gray-50 border-2 border-black animate-pulse">Loading updates...</div>;
  if (notifications.length === 0) return <div className="p-8 text-center text-xs font-black uppercase opacity-50 border-2 border-black border-dashed">No recent updates</div>;

  return (
    <div className="flex flex-col gap-4">
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>
  );
}

function NotificationItem({ notification }: { notification: MiniAppNotification }) {
  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      achievement: "🏆", update: "🔔", warning: "⚠️", info: "ℹ️",
      success: "✅", event: "📅", announcement: "📣", alert: "⚠️"
    };
    return icons[type.toLowerCase()] || "📢";
  };

  const getTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <div className="flex gap-4 p-4 bg-white dark:bg-black border-4 border-black dark:border-white shadow-brutal-sm group hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
      <div className="w-12 h-12 flex items-center justify-center bg-neo border-2 border-black shadow-brutal-xs flex-shrink-0 text-xl rotate-3">
        {getTypeIcon(notification.notification_type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1">
          <h4 className="font-black uppercase text-sm tracking-tight truncate pr-4">{notification.title}</h4>
          <span className="text-[10px] font-black uppercase opacity-50">{getTimeAgo(notification.created_at)}</span>
        </div>
        <p className="text-xs font-bold text-gray-600 dark:text-gray-400 leading-normal mb-2">{notification.content}</p>
        {notification.tx_hash && (
          <a
            href={`https://dora.coz.io/transaction/neo3/${notification.tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-[10px] font-black uppercase bg-black text-neo px-2 py-1 border border-black hover:bg-neo hover:text-black transition-colors"
          >
            Proof of Work →
          </a>
        )}
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const loadingTextStyle: React.CSSProperties = {
  color: colors.textMuted,
  fontSize: 14,
  textAlign: "center",
  padding: 32,
};

const emptyTextStyle: React.CSSProperties = {
  color: colors.textMuted,
  fontSize: 14,
  textAlign: "center",
  padding: 32,
};

const itemStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  padding: 16,
  background: colors.bgCard,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
};

const iconContainerStyle: React.CSSProperties = {
  fontSize: 24,
  width: 40,
  height: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,212,170,0.1)",
  borderRadius: 8,
  flexShrink: 0,
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 4,
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: colors.text,
  margin: 0,
};

const timeStyle: React.CSSProperties = {
  fontSize: 12,
  color: colors.textMuted,
};

const descriptionStyle: React.CSSProperties = {
  fontSize: 13,
  color: colors.textMuted,
  margin: 0,
  lineHeight: 1.5,
};

const txLinkStyle: React.CSSProperties = {
  fontSize: 12,
  color: colors.primary,
  textDecoration: "none",
  display: "inline-block",
  marginTop: 8,
};
