import React from "react";
import { MiniAppNotification } from "./types";

type Props = {
  notification: MiniAppNotification;
};

export function NotificationCard({ notification }: Props) {
  const type = formatType(notification.notification_type);
  const timeAgo = getTimeAgo(notification.created_at);

  return (
    <div className="p-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] font-bold uppercase px-2.5 py-1 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 rounded-full border border-gray-200 dark:border-white/5 flex items-center gap-1.5">
          {type.icon} {type.label}
        </span>
        <span suppressHydrationWarning className="text-[10px] font-semibold uppercase text-gray-400 dark:text-gray-500 tracking-wide">{timeAgo}</span>
      </div>
      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5 tracking-tight">{notification.title}</h4>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
        {notification.content}
      </p>
    </div>
  );
}

function formatType(raw: string): { label: string; icon: string } {
  const label = String(raw ?? "").trim() || "News";
  const normalized = label.toLowerCase();
  const icons: Record<string, string> = {
    announcement: "📣",
    alert: "⚠️",
    milestone: "🏁",
    promo: "🎁",
    achievement: "🏆",
    update: "🔔",
    warning: "⚠️",
    info: "ℹ️",
    success: "✅",
    event: "📅",
    news: "📢",
  };
  return { label, icon: icons[normalized] ?? "📢" };
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
