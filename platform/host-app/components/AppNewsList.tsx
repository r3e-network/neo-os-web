import React from "react";
import { MiniAppNotification } from "./types";
import { colors } from "./styles";

type Props = {
  notifications: MiniAppNotification[];
  loading?: boolean;
};

export function AppNewsList({ notifications, loading }: Props) {
  if (loading) {
    return (
      <div style={containerStyle}>
        <p style={loadingTextStyle}>Loading notifications...</p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div style={containerStyle}>
        <p style={emptyTextStyle}>No notifications yet</p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
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
    <div style={itemStyle}>
      <div style={iconContainerStyle}>{getTypeIcon(notification.notification_type)}</div>
      <div style={contentStyle}>
        <div style={headerStyle}>
          <h4 style={titleStyle}>{notification.title}</h4>
          <span style={timeStyle}>{getTimeAgo(notification.created_at)}</span>
        </div>
        <p style={descriptionStyle}>{notification.content}</p>
        {notification.tx_hash && (
          <a
            href={`https://dora.coz.io/transaction/neo3/${notification.tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={txLinkStyle}
          >
            View Transaction →
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
