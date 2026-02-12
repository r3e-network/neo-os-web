"use client";

import { Check } from "lucide-react";
import type { Notification } from "@/pages/api/notifications";
import { cn, formatTimeAgoShort } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/react";

interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  onMarkRead: (id: string) => void;
}

export function NotificationList({ notifications, loading, onMarkRead }: NotificationListProps) {
  const { t } = useTranslation("host");
  const { t: tCommon, locale } = useTranslation("common");
  if (loading) {
    return <div className="p-4 text-center text-erobo-ink-soft">{tCommon("actions.loading")}</div>;
  }

  if (notifications.length === 0) {
    return <div className="p-8 text-center text-erobo-ink-soft">{t("notifications.empty")}</div>;
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      {notifications.map((n) => (
        <NotificationItem
          key={n.id}
          notification={n}
          onMarkRead={onMarkRead}
          tCommon={tCommon}
          locale={locale}
          markReadLabel={t("notifications.markRead")}
        />
      ))}
    </div>
  );
}

function NotificationItem({
  notification,
  onMarkRead,
  tCommon,
  locale,
  markReadLabel,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  tCommon: (key: string, options?: Record<string, string | number>) => string;
  locale: string;
  markReadLabel: string;
}) {
  const timeAgo = formatTimeAgoShort(notification.created_at, { t: tCommon, locale, maxRelativeDays: 14 });

  return (
    <div
      className={cn(
        "px-4 py-3 border-b border-erobo-purple/5 dark:border-white/10 hover:bg-erobo-purple/5 dark:hover:bg-erobo-bg-card/50",
        !notification.read && "bg-emerald-50/50 dark:bg-emerald-900/10",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-erobo-ink dark:text-white truncate">{notification.title}</p>
          <p className="text-xs text-erobo-ink-soft mt-0.5 line-clamp-2">{notification.content}</p>
          <p className="text-xs text-erobo-ink-soft/60 mt-1">{timeAgo}</p>
        </div>
        {!notification.read && (
          <button
            onClick={() => onMarkRead(notification.id)}
            className="p-1 text-erobo-ink-soft/60 hover:text-emerald-600"
            title={markReadLabel}
          >
            <Check size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
