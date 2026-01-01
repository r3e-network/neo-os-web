"use client";

import { Check } from "lucide-react";
import type { Notification } from "@/pages/api/notifications";
import { cn } from "@/lib/utils";

interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  onMarkRead: (id: string) => void;
}

export function NotificationList({ notifications, loading, onMarkRead }: NotificationListProps) {
  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading...</div>;
  }

  if (notifications.length === 0) {
    return <div className="p-8 text-center text-gray-500">No notifications</div>;
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      {notifications.map((n) => (
        <NotificationItem key={n.id} notification={n} onMarkRead={onMarkRead} />
      ))}
    </div>
  );
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  const timeAgo = getTimeAgo(notification.created_at);

  return (
    <div
      className={cn(
        "px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50",
        !notification.read && "bg-emerald-50/50 dark:bg-emerald-900/10",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{notification.title}</p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.content}</p>
          <p className="text-xs text-gray-400 mt-1">{timeAgo}</p>
        </div>
        {!notification.read && (
          <button
            onClick={() => onMarkRead(notification.id)}
            className="p-1 text-gray-400 hover:text-emerald-600"
            title="Mark as read"
          >
            <Check size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
