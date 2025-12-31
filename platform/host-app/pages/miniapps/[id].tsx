import React, { useState } from "react";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import {
  MiniAppInfo,
  MiniAppStats,
  MiniAppNotification,
  colors,
  AppDetailHeader,
  AppStatsCard,
  AppNewsList,
} from "../../components";
import { ActivityTicker } from "../../components/ActivityTicker";
import { AppSecretsTab } from "../../components/features/secrets/AppSecretsTab";
import { ReviewsTab } from "../../components/features/reviews";
import { ForumTab } from "../../components/features/forum";
import { useActivityFeed } from "../../hooks/useActivityFeed";
import { coerceMiniAppInfo } from "../../lib/miniapp";
import { fetchWithTimeout, resolveInternalBaseUrl } from "../../lib/edge";
import { getBuiltinApp } from "../../lib/builtin-apps";
import { logger } from "../../lib/logger";
import { useTranslation } from "../../lib/i18n/react";

// Sanitize object for JSON serialization (convert undefined to null)
function sanitizeForJson<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as T;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForJson) as T;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = value === undefined ? null : sanitizeForJson(value);
  }
  return result as T;
}

type StatCardConfig = {
  title: string;
  value: string | number;
  icon: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
};

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

const DEFAULT_STATS_DISPLAY = ["total_transactions", "daily_active_users", "total_gas_used", "weekly_active_users"];

const STAT_KEY_ALIASES: Record<string, string> = {
  tx_count: "total_transactions",
  gas_burned: "total_gas_used",
  gas_consumed: "total_gas_used",
};

// Factory function to create stat card builders with i18n support
function createStatCardBuilders(
  t: (key: string) => string,
): Record<string, (stats: MiniAppStats) => StatCardConfig | null> {
  return {
    total_transactions: (stats) =>
      stats.total_transactions != null
        ? {
            title: t("detail.totalTxs"),
            value: stats.total_transactions.toLocaleString(),
            icon: "📊",
            trend: "neutral",
          }
        : null,
    total_users: (stats) =>
      stats.total_users != null
        ? { title: t("detail.totalUsers"), value: stats.total_users.toLocaleString(), icon: "👥", trend: "neutral" }
        : null,
    total_gas_used: (stats) => ({
      title: t("detail.gasBurned"),
      value: formatGas(stats.total_gas_used),
      icon: "🔥",
      trend: "neutral",
    }),
    total_gas_earned: (stats) => ({
      title: t("detail.gasEarned"),
      value: formatGas(stats.total_gas_earned),
      icon: "💰",
      trend: "neutral",
    }),
    daily_active_users: (stats) =>
      stats.daily_active_users != null
        ? {
            title: t("detail.dailyActiveUsers"),
            value: stats.daily_active_users.toLocaleString(),
            icon: "👥",
            trend: "up",
          }
        : null,
    weekly_active_users: (stats) =>
      stats.weekly_active_users != null
        ? {
            title: t("detail.weeklyActive"),
            value: stats.weekly_active_users.toLocaleString(),
            icon: "📈",
            trend: "up",
          }
        : null,
    last_activity_at: (stats) => ({
      title: t("detail.lastActive"),
      value: formatLastActive(stats.last_activity_at),
      icon: "⏱",
      trend: "neutral",
    }),
  };
}

export type AppDetailPageProps = {
  app: MiniAppInfo | null;
  stats: MiniAppStats | null;
  notifications: MiniAppNotification[];
  error?: string;
};

export default function MiniAppDetailPage({ app, stats, notifications, error }: AppDetailPageProps) {
  const router = useRouter();
  const { t } = useTranslation("host");
  const [activeTab, setActiveTab] = useState<"overview" | "reviews" | "forum" | "news" | "secrets">("overview");
  const showNews = app?.news_integration !== false;
  const showSecrets = app?.permissions?.confidential === true;

  // App-specific activity feed
  const { activities: appActivities } = useActivityFeed({
    appId: app?.app_id,
    pollInterval: 5000,
    enabled: Boolean(app?.app_id),
  });

  if (error || !app) {
    return (
      <div style={containerStyle}>
        <div style={errorContainerStyle}>
          <h1 style={errorTitleStyle}>{t("detail.appNotFound")}</h1>
          <p style={errorMessageStyle}>{error || t("detail.appNotFoundDesc")}</p>
          <button style={backButtonStyle} onClick={() => router.push("/miniapps")}>
            ← {t("detail.backToMiniApps")}
          </button>
        </div>
      </div>
    );
  }

  const handleBack = () => {
    router.push("/miniapps");
  };

  const handleLaunch = () => {
    router.push(`/launch/${app.app_id}`);
  };

  const statCards = stats ? buildStatCards(stats, app.stats_display ?? undefined, t) : [];

  return (
    <div style={containerStyle}>
      <AppDetailHeader app={app} stats={stats || undefined} onBack={handleBack} />

      <main style={mainStyle}>
        {/* Hero Section */}
        <section style={heroStyle}>
          <p style={descriptionStyle}>{app.description}</p>
        </section>

        {/* Stats Grid */}
        {stats && statCards.length > 0 && (
          <section style={statsGridStyle}>
            {statCards.map((card) => (
              <AppStatsCard
                key={card.title}
                title={card.title}
                value={card.value}
                icon={card.icon}
                trend={card.trend}
                trendValue={card.trendValue}
              />
            ))}
          </section>
        )}

        {/* App Activity Ticker */}
        <section style={activitySectionStyle}>
          <ActivityTicker
            activities={appActivities}
            title={`${app.name} ${t("detail.activity")}`}
            height={150}
            scrollSpeed={20}
          />
        </section>

        {/* Tabs */}
        <section style={tabsContainerStyle}>
          <div style={tabsHeaderStyle}>
            <button
              style={activeTab === "overview" ? tabButtonActiveStyle : tabButtonStyle}
              onClick={() => setActiveTab("overview")}
            >
              {t("detail.overview")}
            </button>
            <button
              style={activeTab === "reviews" ? tabButtonActiveStyle : tabButtonStyle}
              onClick={() => setActiveTab("reviews")}
            >
              ⭐ {t("detail.reviews")}
            </button>
            <button
              style={activeTab === "forum" ? tabButtonActiveStyle : tabButtonStyle}
              onClick={() => setActiveTab("forum")}
            >
              💬 {t("detail.forum")}
            </button>
            {showNews && (
              <button
                style={activeTab === "news" ? tabButtonActiveStyle : tabButtonStyle}
                onClick={() => setActiveTab("news")}
              >
                {t("detail.news")} ({notifications.length})
              </button>
            )}
            {showSecrets && (
              <button
                style={activeTab === "secrets" ? tabButtonActiveStyle : tabButtonStyle}
                onClick={() => setActiveTab("secrets")}
              >
                🔐 {t("detail.secrets")}
              </button>
            )}
          </div>

          <div style={tabContentStyle}>
            {activeTab === "overview" && <OverviewTab app={app} t={t} />}
            {activeTab === "reviews" && <ReviewsTab appId={app.app_id} />}
            {activeTab === "forum" && <ForumTab appId={app.app_id} />}
            {activeTab === "news" && showNews && <AppNewsList notifications={notifications} />}
            {activeTab === "secrets" && showSecrets && <AppSecretsTab appId={app.app_id} appName={app.name} />}
            {!showNews && activeTab === "news" && <p style={newsDisabledStyle}>{t("detail.newsDisabled")}</p>}
          </div>
        </section>
      </main>

      {/* Fixed Launch Button */}
      <div style={launchBarStyle}>
        <button style={launchButtonStyle} onClick={handleLaunch}>
          {t("detail.launchApp")} →
        </button>
      </div>
    </div>
  );
}

function OverviewTab({ app, t }: { app: MiniAppInfo; t: (key: string) => string }) {
  return (
    <div style={overviewContainerStyle}>
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>{t("detail.permissions")}</h3>
        <div style={permissionsGridStyle}>
          {Object.entries(app.permissions).map(([key, value]) =>
            value ? (
              <div key={key} style={permissionItemStyle}>
                <span style={permissionIconStyle}>✓</span>
                <span style={permissionTextStyle}>{formatPermission(key)}</span>
              </div>
            ) : null,
          )}
        </div>
      </div>

      {app.limits && (
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>{t("detail.limits")}</h3>
          <ul style={limitListStyle}>
            {app.limits.max_gas_per_tx && (
              <li style={limitItemStyle}>
                {t("detail.maxGasPerTx")}: {app.limits.max_gas_per_tx}
              </li>
            )}
            {app.limits.daily_gas_cap_per_user && (
              <li style={limitItemStyle}>
                {t("detail.dailyGasCap")}: {app.limits.daily_gas_cap_per_user}
              </li>
            )}
            {app.limits.governance_cap && (
              <li style={limitItemStyle}>
                {t("detail.governanceCap")}: {app.limits.governance_cap}
              </li>
            )}
          </ul>
        </div>
      )}

      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>{t("detail.contractDetails")}</h3>
        <p style={infoTextStyle}>
          {t("detail.appId")}: <code style={codeStyle}>{app.app_id}</code>
        </p>
        {app.contract_hash && (
          <p style={infoTextStyle}>
            {t("detail.contractHash")}: <code style={codeStyle}>{app.contract_hash}</code>
          </p>
        )}
        <p style={infoTextStyle}>
          {t("detail.entryUrl")}: <code style={codeStyle}>{app.entry_url}</code>
        </p>
      </div>
    </div>
  );
}

function formatPermission(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildStatCards(stats: MiniAppStats, display?: string[], t?: (key: string) => string): StatCardConfig[] {
  const keys = display ? display : DEFAULT_STATS_DISPLAY;
  const cards: StatCardConfig[] = [];
  const builders = createStatCardBuilders(t || ((key) => key));
  for (const rawKey of keys) {
    const key = String(rawKey || "")
      .trim()
      .toLowerCase();
    if (!key) continue;
    const canonicalKey = STAT_KEY_ALIASES[key] ?? key;
    const builder = builders[canonicalKey];
    if (!builder) continue;
    const card = builder(stats);
    if (card) cards.push(card);
  }
  return cards;
}

function formatGas(value?: string): string {
  if (!value) return "0.00";
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return "0.00";
  return parsed.toFixed(2);
}

function formatLastActive(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const diffMs = Date.now() - date.getTime();
  if (diffMs <= 0) return "Just now";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Server-Side Props
export const getServerSideProps: GetServerSideProps<AppDetailPageProps> = async (context) => {
  const { id } = context.params as { id: string };
  const baseUrl = resolveInternalBaseUrl(context.req as RequestLike | undefined);
  const encodedId = encodeURIComponent(id);

  // First check if it's a builtin app - return immediately if found
  const fallback = getBuiltinApp(id);

  try {
    // Parallel fetch with shorter timeout (2s) for faster page load
    const [statsRes, notifRes] = await Promise.all([
      fetchWithTimeout(`${baseUrl}/api/miniapp-stats?app_id=${encodedId}`, {}, 2000).catch(() => null),
      fetchWithTimeout(`${baseUrl}/api/app/${encodedId}/news?limit=20`, {}, 2000).catch(() => null),
    ]);

    const statsData = statsRes?.ok ? await statsRes.json().catch(() => ({})) : {};
    const notifData = notifRes?.ok ? await notifRes.json().catch(() => ({ notifications: [] })) : { notifications: [] };

    const statsList = Array.isArray(statsData?.stats)
      ? statsData.stats
      : Array.isArray(statsData)
        ? statsData
        : statsData
          ? [statsData]
          : [];

    const rawStats = statsList.find((s: Record<string, unknown>) => s?.app_id === id) ?? statsList[0] ?? null;
    const app = rawStats ? coerceMiniAppInfo(rawStats, fallback) : (fallback ?? null);

    if (!app) {
      return {
        props: {
          app: null,
          stats: null,
          notifications: [],
          error: "App not found",
        },
      };
    }

    return {
      props: {
        app: sanitizeForJson(app),
        stats: sanitizeForJson(rawStats) || null,
        notifications: notifData.notifications || [],
      },
    };
  } catch (error) {
    logger.error("Failed to fetch app details:", error);
    return {
      props: {
        app: null,
        stats: null,
        notifications: [],
        error: "Failed to load app details",
      },
    };
  }
};

// Styles
const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: colors.bg,
  color: colors.text,
  paddingBottom: 100,
};

const errorContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  padding: 32,
};

const errorTitleStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: colors.text,
  marginBottom: 16,
};

const errorMessageStyle: React.CSSProperties = {
  fontSize: 16,
  color: colors.textMuted,
  marginBottom: 24,
};

const backButtonStyle: React.CSSProperties = {
  padding: "12px 24px",
  borderRadius: 8,
  border: `1px solid ${colors.border}`,
  background: "transparent",
  color: colors.text,
  fontSize: 14,
  cursor: "pointer",
};

const mainStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "32px 24px",
};

const heroStyle: React.CSSProperties = {
  marginBottom: 32,
};

const descriptionStyle: React.CSSProperties = {
  fontSize: 16,
  color: colors.textMuted,
  lineHeight: 1.6,
  margin: 0,
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
  marginBottom: 32,
};

const activitySectionStyle: React.CSSProperties = {
  marginBottom: 24,
};

const tabsContainerStyle: React.CSSProperties = {
  marginBottom: 32,
};

const tabsHeaderStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  borderBottom: `1px solid ${colors.border}`,
  marginBottom: 24,
};

const tabButtonStyle: React.CSSProperties = {
  padding: "12px 24px",
  background: "transparent",
  border: "none",
  borderBottom: "2px solid transparent",
  color: colors.textMuted,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s",
};

const tabButtonActiveStyle: React.CSSProperties = {
  padding: "12px 24px",
  background: "transparent",
  border: "none",
  borderBottom: `2px solid ${colors.primary}`,
  color: colors.primary,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s",
};

const tabContentStyle: React.CSSProperties = {
  minHeight: 200,
};

const newsDisabledStyle: React.CSSProperties = {
  marginTop: 16,
  fontSize: 13,
  color: colors.textMuted,
};

const launchBarStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  background: colors.bgCard,
  borderTop: `1px solid ${colors.border}`,
  padding: "16px 24px",
  display: "flex",
  justifyContent: "center",
  zIndex: 100,
};

const launchButtonStyle: React.CSSProperties = {
  padding: "14px 48px",
  borderRadius: 10,
  border: "none",
  background: colors.primary,
  color: "#000",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  transition: "all 0.2s",
};

const overviewContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 24,
};

const sectionStyle: React.CSSProperties = {
  background: colors.bgCard,
  borderRadius: 12,
  padding: 24,
  border: `1px solid ${colors.border}`,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: colors.text,
  marginTop: 0,
  marginBottom: 16,
};

const permissionsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 12,
};

const permissionItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const permissionIconStyle: React.CSSProperties = {
  color: colors.primary,
  fontSize: 16,
  fontWeight: 700,
};

const permissionTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: colors.text,
};

const limitListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
};

const limitItemStyle: React.CSSProperties = {
  fontSize: 14,
  color: colors.textMuted,
  padding: "8px 0",
  borderBottom: `1px solid ${colors.border}`,
};

const infoTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: colors.textMuted,
  margin: "8px 0",
};

const codeStyle: React.CSSProperties = {
  background: "rgba(0,212,170,0.1)",
  padding: "2px 6px",
  borderRadius: 4,
  fontSize: 13,
  fontFamily: "monospace",
  color: colors.primary,
};
