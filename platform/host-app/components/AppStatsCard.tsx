import React from "react";
import { colors, shadows } from "./styles";

type Props = {
  title: string;
  value: string | number;
  icon: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
};

export function AppStatsCard({ title, value, icon, trend, trendValue }: Props) {
  const getTrendColor = () => {
    if (!trend) return colors.textMuted;
    if (trend === "up") return "#00e599";
    if (trend === "down") return "#ff4757";
    return colors.textMuted;
  };

  const getTrendSymbol = () => {
    if (trend === "up") return "↑";
    if (trend === "down") return "↓";
    return "";
  };

  return (
    <div style={cardStyle}>
      <div style={headerRowStyle}>
        <span style={iconStyle}>{icon}</span>
        <span style={titleStyle}>{title}</span>
      </div>
      <div style={valueStyle}>{value}</div>
      {trendValue && (
        <div style={{ ...trendStyle, color: getTrendColor() }}>
          {getTrendSymbol()} {trendValue}
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: colors.bgCard,
  borderRadius: 12,
  padding: "20px",
  border: `1px solid ${colors.border}`,
  boxShadow: shadows.card,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const iconStyle: React.CSSProperties = {
  fontSize: 20,
};

const titleStyle: React.CSSProperties = {
  fontSize: 13,
  color: colors.textMuted,
  textTransform: "uppercase",
  fontWeight: 600,
  letterSpacing: "0.5px",
};

const valueStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: colors.text,
  lineHeight: 1,
};

const trendStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
};
