import React from "react";
import { MiniAppNotification } from "./types";

type Props = {
  notification: MiniAppNotification;
};

export function NotificationCard({ notification }: Props) {
  const type = formatType(notification.notification_type);
  const timeAgo = getTimeAgo(notification.created_at);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/[0.08] dark:bg-gray-900/80">
      <div className="mb-2 flex justify-between">
        <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[11px] text-blue-500">
          {type.icon} {type.label}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{timeAgo}</span>
      </div>
      <h4 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
        {notification.title}
      </h4>
      <p className="text-[13px] leading-snug text-gray-500 dark:text-gray-400">
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
