import React from "react";
import { MiniAppInfo, MiniAppStats } from "./types";
import { colors } from "./styles";

type Props = {
  app: MiniAppInfo;
  stats?: MiniAppStats;
  onBack: () => void;
};

export function AppDetailHeader({ app, stats, onBack }: Props) {
  let statusBadge = stats?.last_activity_at ? "Active" : "Inactive";
  let statusColor = stats?.last_activity_at ? colors.primary : colors.textMuted;
  if (app.status === "active") {
    statusBadge = "Online";
    statusColor = colors.primary;
  } else if (app.status === "disabled") {
    statusBadge = "Maintenance";
    statusColor = "#10b981"; // emerald-500 (Neo Green style)
  } else if (app.status === "pending") {
    statusBadge = "Pending";
    statusColor = colors.textMuted;
  }

  return (
    <header style={headerStyle}>
      <button onClick={onBack} style={backButtonStyle} aria-label="Go back">
        ← Back
      </button>
      <div style={headerContentStyle}>
        <div style={iconContainerStyle}>{app.icon}</div>
        <div style={infoStyle}>
          <h1 style={titleStyle}>{app.name}</h1>
          <div style={metaRowStyle}>
            <span style={categoryBadgeStyle}>{app.category}</span>
            <span style={{ ...statusBadgeStyle, color: statusColor }}>● {statusBadge}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

const headerStyle: React.CSSProperties = {
  padding: "24px 32px",
  borderBottom: `1px solid ${colors.border}`,
  background: colors.bgCard,
};

const backButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${colors.border}`,
  color: colors.text,
  padding: "8px 16px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
  marginBottom: 16,
  transition: "all 0.2s",
};

const headerContentStyle: React.CSSProperties = {
  display: "flex",
  gap: 20,
  alignItems: "center",
};

const iconContainerStyle: React.CSSProperties = {
  fontSize: 64,
  width: 80,
  height: 80,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,212,170,0.1)",
  borderRadius: 16,
};

const infoStyle: React.CSSProperties = {
  flex: 1,
};

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  margin: "0 0 8px 0",
  color: colors.text,
};

const metaRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
};

const categoryBadgeStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "4px 12px",
  borderRadius: 6,
  background: "rgba(0,212,170,0.15)",
  color: colors.primary,
  textTransform: "uppercase",
  fontWeight: 600,
};

const statusBadgeStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
};
