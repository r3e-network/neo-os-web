import React from "react";
import { MiniAppInfo, MiniAppStats } from "./types";
import { colors } from "./styles";

type Props = {
  app: MiniAppInfo;
  stats?: MiniAppStats;
};

export function MiniAppDetail({ app, stats }: Props) {
  return (
    <div style={container}>
      {app.banner_url && (
        <img src={app.banner_url} alt="" style={bannerStyle} />
      )}
      <div style={header}>
        {app.logo_url ? (
          <img src={app.logo_url} alt={app.name} style={logoStyle} />
        ) : (
          <span style={icon}>{app.icon}</span>
        )}
        <div>
          <h1 style={title}>{app.name}</h1>
          <span style={category}>{app.category}</span>
        </div>
      </div>

      <p style={desc}>{app.description}</p>

      {app.docs_url && (
        <a href={app.docs_url} target="_blank" rel="noopener noreferrer" style={docsLink}>
          📄 Documentation
        </a>
      )}

      {stats && (
        <div style={statsGrid}>
          <StatBox label="Transactions" value={stats.total_transactions} />
          <StatBox label="Users" value={stats.total_users} />
          <StatBox label="Daily Active" value={stats.daily_active_users} />
        </div>
      )}

      <button type="button" style={launchBtn}>Launch App</button>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div style={statBox}>
      <div style={statValue}>{value.toLocaleString()}</div>
      <div style={statLabel}>{label}</div>
    </div>
  );
}

const container: React.CSSProperties = { padding: 24 };
const bannerStyle: React.CSSProperties = { width: "100%", height: 160, objectFit: "cover", borderRadius: 12, marginBottom: 16 };
const header: React.CSSProperties = { display: "flex", gap: 16, alignItems: "center", marginBottom: 20 };
const icon: React.CSSProperties = { fontSize: 56 };
const logoStyle: React.CSSProperties = { width: 56, height: 56, borderRadius: 14, objectFit: "cover" };
const docsLink: React.CSSProperties = { display: "inline-block", fontSize: 14, color: colors.primary, marginBottom: 16, textDecoration: "none" };
const title: React.CSSProperties = { fontSize: 28, fontWeight: 700, margin: 0 };
const category: React.CSSProperties = { fontSize: 12, color: colors.primary, textTransform: "uppercase" };
const desc: React.CSSProperties = { fontSize: 16, color: colors.textMuted, lineHeight: 1.6 };
const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 16,
  margin: "24px 0",
};
const statBox: React.CSSProperties = { background: colors.bgCard, borderRadius: 12, padding: 16, textAlign: "center" };
const statValue: React.CSSProperties = { fontSize: 24, fontWeight: 700, color: colors.primary };
const statLabel: React.CSSProperties = { fontSize: 12, color: colors.textMuted, marginTop: 4 };
const launchBtn: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 10,
  border: "none",
  background: colors.primary,
  color: "#000",
  fontWeight: 600,
  fontSize: 16,
  cursor: "pointer",
};
