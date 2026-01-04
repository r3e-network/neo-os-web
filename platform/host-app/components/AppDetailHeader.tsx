import React from "react";
import { MiniAppInfo, MiniAppStats } from "./types";
import { colors, getThemeColors } from "./styles";
import { useI18n } from "@/lib/i18n/react";
import { useTheme } from "./providers/ThemeProvider";
import { MiniAppLogo } from "./features/miniapp/MiniAppLogo";

// Check if icon is a URL/path (not an emoji)
function isIconUrl(icon: string): boolean {
  if (!icon) return false;
  return icon.startsWith("/") || icon.startsWith("http") || icon.endsWith(".svg") || icon.endsWith(".png");
}

type Props = {
  app: MiniAppInfo;
  stats?: MiniAppStats;
};

export function AppDetailHeader({ app, stats }: Props) {
  const { locale } = useI18n();
  const { theme } = useTheme();
  const themeColors = getThemeColors(theme);

  // Self-contained i18n: use MiniApp's own translations based on locale
  const appName = locale === "zh" && app.name_zh ? app.name_zh : app.name;

  let statusBadge = stats?.last_activity_at ? "Active" : "Inactive";
  let statusColor = stats?.last_activity_at ? themeColors.primary : themeColors.textMuted;
  if (app.status === "active") {
    statusBadge = "Online";
    statusColor = themeColors.primary;
  } else if (app.status === "disabled") {
    statusBadge = "Maintenance";
    statusColor = "#10b981"; // emerald-500 (Neo Green style)
  } else if (app.status === "pending") {
    statusBadge = "Pending";
    statusColor = themeColors.textMuted;
  }

  return (
    <header style={{ ...headerStyle, background: themeColors.bgCard, borderColor: themeColors.border }}>
      <div style={headerContentStyle}>
        <div style={iconContainerStyle}>
          {isIconUrl(app.icon) ? (
            <MiniAppLogo appId={app.app_id} category={app.category} size="lg" iconUrl={app.icon} />
          ) : (
            <span style={emojiStyle}>{app.icon}</span>
          )}
        </div>
        <div style={infoStyle}>
          <h1 style={{ ...titleStyle, color: themeColors.text }}>{appName}</h1>
          <div style={metaRowStyle}>
            <span style={{ ...categoryBadgeStyle, color: themeColors.primary }}>{app.category}</span>
            <span style={{ ...statusBadgeStyle, color: statusColor }}>● {statusBadge}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

const headerStyle: React.CSSProperties = {
  padding: "80px 32px 24px 32px",
  borderBottom: `1px solid ${colors.border}`,
  background: colors.bgCard,
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

const emojiStyle: React.CSSProperties = {
  fontSize: 48,
  lineHeight: 1,
};
