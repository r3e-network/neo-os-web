import { MiniAppNotification } from "./types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Gift,
  Info,
  Megaphone,
  Trophy,
} from "lucide-react";

const DORA_TX_BASE = "https://dora.coz.io/transaction/neo3";

type Props = {
  notifications: MiniAppNotification[];
  loading?: boolean;
};

export function AppNewsList({ notifications, loading }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="flex gap-3 p-4 rounded-xl border border-gray-200"
          >
            <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-500 text-center py-8">
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

function NotificationItem({
  notification,
}: {
  notification: MiniAppNotification;
}) {
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

  const Icon = getTypeIcon(notification.notification_type);
  const iconLabel = getTypeIconLabel(notification.notification_type);

  return (
    <div className="flex gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700"
        aria-label={`Notification type: ${iconLabel}`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <h4
            className="text-sm font-semibold text-gray-900 truncate"
            title={notification.title}
          >
            {notification.title}
          </h4>
          <span className="text-xs text-gray-500 shrink-0">
            {getTimeAgo(notification.created_at)}
          </span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed break-words">
          {notification.content}
        </p>
        {notification.tx_hash && (
          <a
            href={`${DORA_TX_BASE}/${notification.tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 cursor-pointer text-xs text-neo no-underline hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 rounded-lg"
          >
            View Transaction →
          </a>
        )}
      </div>
    </div>
  );
}

function getTypeIcon(type: string) {
  const normalized = type.toLowerCase();
  if (normalized === "achievement" || normalized === "milestone") return Trophy;
  if (normalized === "warning" || normalized === "alert") return AlertTriangle;
  if (normalized === "success") return CheckCircle2;
  if (normalized === "promo") return Gift;
  if (normalized === "announcement" || normalized === "event") return Megaphone;
  if (normalized === "info") return Info;
  return Bell;
}

function getTypeIconLabel(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized === "achievement" || normalized === "milestone") return "achievement";
  if (normalized === "warning" || normalized === "alert") return "warning";
  if (normalized === "success") return "success";
  if (normalized === "promo") return "promotion";
  if (normalized === "announcement" || normalized === "event") return "announcement";
  if (normalized === "info") return "information";
  return "update";
}
