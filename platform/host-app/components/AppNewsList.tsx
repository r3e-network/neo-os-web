import { MiniAppNotification } from "./types";

type Props = {
  notifications: MiniAppNotification[];
  loading?: boolean;
};

export function AppNewsList({ notifications, loading }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
          Loading notifications...
        </p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
          No notifications yet
        </p>
      </div>
    );
  }

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
      achievement: "🏆",
      update: "🔔",
      warning: "⚠️",
      info: "ℹ️",
      success: "✅",
      event: "📅",
      announcement: "📣",
      alert: "⚠️",
      milestone: "🏁",
      promo: "🎁",
    };
    return icons[type.toLowerCase()] || "📢";
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const created = new Date(timestamp);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="flex gap-3 p-4 bg-gray-50 dark:bg-gray-900/80 rounded-xl border border-gray-200 dark:border-white/[0.08]">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-neo/10 text-2xl shrink-0">
        {getTypeIcon(notification.notification_type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <h4 className="text-[15px] font-semibold text-gray-900 dark:text-white">
            {notification.title}
          </h4>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {getTimeAgo(notification.created_at)}
          </span>
        </div>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
          {notification.content}
        </p>
        {notification.tx_hash && (
          <a
            href={`https://dora.coz.io/transaction/neo3/${notification.tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-xs text-neo no-underline hover:underline"
          >
            View Transaction →
          </a>
        )}
      </div>
    </div>
  );
}
