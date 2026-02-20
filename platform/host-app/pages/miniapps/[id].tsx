import { useState } from "react";
import { GetServerSideProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  MiniAppInfo,
  MiniAppStats,
  MiniAppNotification,
  AppDetailHeader,
  AppStatsCard,
  AppNewsList,
  OperationPanel,
} from "../../components";
import type { OperationEntry } from "../../components/types";
import { ActivityTicker } from "../../components/ActivityTicker";
import { AppSecretsTab } from "../../components/features/secrets/AppSecretsTab";
import { ReviewsTab } from "../../components/features/reviews";
import { ForumTab } from "../../components/features/forum";
import { useActivityFeed } from "../../hooks/useActivityFeed";
import { coerceMiniAppInfo } from "../../lib/miniapp";
import { fetchWithTimeout, resolveInternalBaseUrl } from "../../lib/edge";
import { getBuiltinApp } from "../../lib/builtin-apps";
import { logger } from "../../lib/logger";

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

const STAT_CARD_BUILDERS: Record<string, (stats: MiniAppStats) => StatCardConfig | null> = {
  total_transactions: (stats) =>
    stats.total_transactions != null
      ? { title: "Total TXs", value: stats.total_transactions.toLocaleString(), icon: "📊", trend: "neutral" }
      : null,
  total_users: (stats) =>
    stats.total_users != null
      ? { title: "Total Users", value: stats.total_users.toLocaleString(), icon: "👥", trend: "neutral" }
      : null,
  total_gas_used: (stats) => ({
    title: "GAS Burned",
    value: formatGas(stats.total_gas_used),
    icon: "🔥",
    trend: "neutral",
  }),
  total_gas_earned: (stats) => ({
    title: "GAS Earned",
    value: formatGas(stats.total_gas_earned),
    icon: "💰",
    trend: "neutral",
  }),
  daily_active_users: (stats) =>
    stats.daily_active_users != null
      ? { title: "Daily Active Users", value: stats.daily_active_users.toLocaleString(), icon: "👥", trend: "up" }
      : null,
  weekly_active_users: (stats) =>
    stats.weekly_active_users != null
      ? { title: "Weekly Active", value: stats.weekly_active_users.toLocaleString(), icon: "📈", trend: "up" }
      : null,
  last_activity_at: (stats) => ({
    title: "Last Active",
    value: formatLastActive(stats.last_activity_at),
    icon: "⏱",
    trend: "neutral",
  }),
};

export type AppDetailPageProps = {
  app: MiniAppInfo | null;
  stats: MiniAppStats | null;
  notifications: MiniAppNotification[];
  error?: string;
};

export default function MiniAppDetailPage({ app, stats, notifications, error }: AppDetailPageProps) {
  const router = useRouter();
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
      <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white pb-24">
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <h1 className="text-[32px] font-extrabold text-gray-900 dark:text-white mb-4">App Not Found</h1>
          <p className="text-base text-gray-500 dark:text-gray-400 mb-6">
            {error || "The requested MiniApp does not exist."}
          </p>
          <button
            type="button"
            className="px-6 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white text-sm cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
            onClick={() => router.push("/miniapps")}
          >
            ← Back to MiniApps
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

  const statCards = stats ? buildStatCards(stats, app.stats_display ?? undefined) : [];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white pb-24">
      <Head><title>{app.name} - NeoHub</title></Head>
      <AppDetailHeader app={app} stats={stats || undefined} onBack={handleBack} />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Hero Section */}
        <section className="mb-8">
          <p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed">{app.description}</p>
        </section>

        {/* Stats Grid */}
        {stats && statCards.length > 0 && (
          <section className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-8">
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
        <section className="mb-6">
          <ActivityTicker activities={appActivities} title={`${app.name} Activity`} height={150} scrollSpeed={20} />
        </section>

        {/* Tabs */}
        <section className="mb-8">
          <div role="tablist" className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 mb-6">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "overview"}
              className={`px-3 sm:px-6 py-2 sm:py-3 bg-transparent border-none border-b-2 text-sm font-semibold cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 ${
                activeTab === "overview" ? "border-neo text-neo" : "border-transparent text-gray-500 dark:text-gray-400"
              }`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "reviews"}
              className={`px-3 sm:px-6 py-2 sm:py-3 bg-transparent border-none border-b-2 text-sm font-semibold cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 ${
                activeTab === "reviews" ? "border-neo text-neo" : "border-transparent text-gray-500 dark:text-gray-400"
              }`}
              onClick={() => setActiveTab("reviews")}
            >
              ⭐ Reviews
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "forum"}
              className={`px-3 sm:px-6 py-2 sm:py-3 bg-transparent border-none border-b-2 text-sm font-semibold cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 ${
                activeTab === "forum" ? "border-neo text-neo" : "border-transparent text-gray-500 dark:text-gray-400"
              }`}
              onClick={() => setActiveTab("forum")}
            >
              💬 Forum
            </button>
            {showNews && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "news"}
                className={`px-3 sm:px-6 py-2 sm:py-3 bg-transparent border-none border-b-2 text-sm font-semibold cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 ${
                  activeTab === "news" ? "border-neo text-neo" : "border-transparent text-gray-500 dark:text-gray-400"
                }`}
                onClick={() => setActiveTab("news")}
              >
                News ({notifications.length})
              </button>
            )}
            {showSecrets && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "secrets"}
                className={`px-3 sm:px-6 py-2 sm:py-3 bg-transparent border-none border-b-2 text-sm font-semibold cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 ${
                  activeTab === "secrets" ? "border-neo text-neo" : "border-transparent text-gray-500 dark:text-gray-400"
                }`}
                onClick={() => setActiveTab("secrets")}
              >
                🔐 Secrets
              </button>
            )}
          </div>

          <div className="min-h-[200px]">
            {activeTab === "overview" && <OverviewTab app={app} />}
            {activeTab === "reviews" && <ReviewsTab appId={app.app_id} />}
            {activeTab === "forum" && <ForumTab appId={app.app_id} />}
            {activeTab === "news" && showNews && <AppNewsList notifications={notifications} />}
            {activeTab === "secrets" && showSecrets && <AppSecretsTab appId={app.app_id} appName={app.name} />}
            {!showNews && activeTab === "news" && (
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">News feed disabled by manifest.</p>
            )}
          </div>
        </section>
      </main>

      {/* Fixed Launch Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-50 dark:bg-gray-900/80 border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4 flex justify-center z-[100]">
        <button
          type="button"
          className="px-12 py-3.5 rounded-xl border-none bg-neo text-black text-base font-bold cursor-pointer transition-all hover:bg-neo/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
          onClick={handleLaunch}
        >
          Launch App →
        </button>
      </div>
    </div>
  );
}

function OverviewTab({ app }: { app: MiniAppInfo }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-gray-50 dark:bg-gray-900/80 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-0 mb-4">Permissions</h3>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {Object.entries(app.permissions).map(([key, value]) =>
            value ? (
              <div key={key} className="flex items-center gap-2">
                <span className="text-neo text-base font-bold">✓</span>
                <span className="text-sm text-gray-900 dark:text-white">{formatPermission(key)}</span>
              </div>
            ) : null,
          )}
        </div>
      </div>

      {app.limits && (
        <div className="bg-gray-50 dark:bg-gray-900/80 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-0 mb-4">Limits</h3>
          <ul className="list-none p-0 m-0">
            {app.limits.max_gas_per_tx && (
              <li className="text-sm text-gray-500 dark:text-gray-400 py-2 border-b border-gray-200 dark:border-gray-700">
                Max GAS per transaction: {app.limits.max_gas_per_tx}
              </li>
            )}
            {app.limits.daily_gas_cap_per_user && (
              <li className="text-sm text-gray-500 dark:text-gray-400 py-2 border-b border-gray-200 dark:border-gray-700">
                Daily GAS cap per user: {app.limits.daily_gas_cap_per_user}
              </li>
            )}
            {app.limits.governance_cap && (
              <li className="text-sm text-gray-500 dark:text-gray-400 py-2 border-b border-gray-200 dark:border-gray-700">
                Governance cap per user: {app.limits.governance_cap}
              </li>
            )}
          </ul>
        </div>
      )}

      {app.docs_url && (
        <div className="bg-gray-50 dark:bg-gray-900/80 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-0 mb-4">Documentation</h3>
          <a
            href={app.docs_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neo no-underline text-sm font-medium transition-colors hover:text-neo/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 rounded"
          >
            📄 View Documentation →
          </a>
        </div>
      )}

      {(() => {
        const a = app as Record<string, unknown>;
        const m = (a.manifest as Record<string, unknown>) ?? {};
        const ops = (a.operations ?? m.operations) as OperationEntry[] | undefined;
        if (!Array.isArray(ops) || !ops.length) return null;
        return <OperationPanel operations={ops} contractHash={app.contract_hash ?? undefined} onInvoke={(method, params) => { logger.debug("invoke", app.contract_hash, method, params); }} />;
      })()}

      <div className="bg-gray-50 dark:bg-gray-900/80 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-0 mb-4">Contract Details</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 my-2">
          App ID: <code className="bg-neo/10 px-1.5 py-0.5 rounded text-xs font-mono text-neo break-all">{app.app_id}</code>
        </p>
        {app.contract_hash && (
          <p className="text-sm text-gray-500 dark:text-gray-400 my-2">
            Contract Hash: <code className="bg-neo/10 px-1.5 py-0.5 rounded text-xs font-mono text-neo break-all">{app.contract_hash}</code>
          </p>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400 my-2">
          Entry URL: <code className="bg-neo/10 px-1.5 py-0.5 rounded text-xs font-mono text-neo break-all">{app.entry_url}</code>
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

function buildStatCards(stats: MiniAppStats, display?: string[]): StatCardConfig[] {
  const keys = display ? display : DEFAULT_STATS_DISPLAY;
  const cards: StatCardConfig[] = [];
  for (const rawKey of keys) {
    const key = String(rawKey || "")
      .trim()
      .toLowerCase();
    if (!key) continue;
    const canonicalKey = STAT_KEY_ALIASES[key] ?? key;
    const builder = STAT_CARD_BUILDERS[canonicalKey];
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
    const [catalogRes, statsRes, notifRes] = await Promise.all([
      fetchWithTimeout(`${baseUrl}/api/miniapps/catalog?app_id=${encodedId}`, {}, 2000).catch(() => null),
      fetchWithTimeout(`${baseUrl}/api/miniapp-stats?app_id=${encodedId}`, {}, 2000).catch(() => null),
      fetchWithTimeout(`${baseUrl}/api/app/${encodedId}/news?limit=20`, {}, 2000).catch(() => null),
    ]);

    const catalogData = catalogRes?.ok ? await catalogRes.json().catch(() => ({})) : {};
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
    const catalogApp = catalogData?.app ?? null;
    const app = coerceMiniAppInfo(catalogApp, rawStats ? coerceMiniAppInfo(rawStats, fallback) ?? fallback ?? undefined : fallback ?? undefined);

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
