import React from "react";
import { MiniAppNotification } from "./types";
import { colors } from "./styles";

type Props = {
  notification: MiniAppNotification;
};

export function NotificationCard({ notification }: Props) {
  const type = formatType(notification.notification_type);
  const timeAgo = getTimeAgo(notification.created_at);

  return (
    <div className="brutal-card p-4 bg-white dark:bg-black group hover:rotate-1 transition-transform">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-brutal-blue text-white border border-black shadow-brutal-xs">
          {type.icon} {type.label}
        </span>
        <span className="text-[10px] font-black uppercase opacity-40">{timeAgo}</span>
      </div>
      <h4 className="text-sm font-black uppercase mb-1 tracking-tight">{notification.title}</h4>
      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
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

const cardStyle: React.CSSProperties = {
  background: colors.bgCard,
  borderRadius: 12,
  padding: 16,
  border: `1px solid ${colors.border}`,
};

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 8,
};

const typeTag: React.CSSProperties = {
  fontSize: 11,
  padding: "2px 6px",
  borderRadius: 4,
  background: "rgba(52,152,219,0.2)",
  color: colors.accent,
};

const timeStyle: React.CSSProperties = {
  fontSize: 12,
  color: colors.textMuted,
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  margin: "0 0 4px 0",
  color: colors.text,
};

const contentStyle: React.CSSProperties = {
  fontSize: 13,
  color: colors.textMuted,
  margin: 0,
  lineHeight: 1.4,
};
