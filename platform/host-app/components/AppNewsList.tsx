import React from "react";
import { MiniAppNotification } from "./types";

type Props = {
  notifications: MiniAppNotification[];
  loading?: boolean;
};

export function AppNewsList({ notifications, loading }: Props) {
  if (loading) return <div className="p-8 text-center text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse bg-gray-50/50 dark:bg-white/5 rounded-2xl">Loading updates...</div>;
  if (notifications.length === 0) return <div className="p-8 text-center text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">No recent updates</div>;

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
    <div className="flex gap-4 p-5 bg-white dark:bg-white/5 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-2xl hover:bg-gray-50 dark:hover:bg-white/10 transition-colors group">
      <div className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-white/10 rounded-full text-xl flex-shrink-0 group-hover:scale-110 transition-transform">
        {getTypeIcon(notification.notification_type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1">
          <h4 className="font-bold text-gray-900 dark:text-white text-sm tracking-tight truncate pr-4">{notification.title}</h4>
          <span className="text-[10px] font-semibold text-gray-400 uppercase">{getTimeAgo(notification.created_at)}</span>
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed mb-3">{notification.content}</p>
        {notification.tx_hash && (
          <a
            href={`https://dora.coz.io/transaction/neo3/${notification.tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full hover:bg-neo hover:text-black transition-colors"
          >
            Proof &rarr;
          </a>
        )}
      </div>
    </div>
  );
}
