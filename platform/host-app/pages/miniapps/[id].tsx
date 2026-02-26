import { useCallback, useEffect, useMemo, useState } from "react";
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
  MiniAppContentBlock,
  MiniAppDetailTab,
  MiniAppDetailTabType,
} from "../../components";
import type { OperationEntry, OperationParam } from "../../components/types";
import { ActivityTicker } from "../../components/ActivityTicker";
import { DetailContentBlocks } from "../../components/features/miniapp/DetailContentBlocks";
import { AppSecretsTab } from "../../components/features/secrets/AppSecretsTab";
import { ReviewsTab } from "../../components/features/reviews";
import { ForumTab } from "../../components/features/forum";
import { useActivityFeed } from "../../hooks/useActivityFeed";
import { coerceMiniAppInfo } from "../../lib/miniapp";
import { fetchWithTimeout, resolveInternalBaseUrl } from "../../lib/edge";
import { getMiniApp } from "../../lib/miniapp-registry";
import { logger } from "../../lib/logger";
import type { InvokeParams } from "../../lib/wallet/adapters/base";
import { getWalletAdapter, useWalletStore } from "../../lib/wallet/store";
import { invokeEvmContract } from "../../lib/wallet/evm";

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

type ResolvedTab = {
  id: string;
  label: string;
  type: MiniAppDetailTabType;
  blocks: MiniAppContentBlock[];
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
  const [activeTab, setActiveTab] = useState("overview");
  const [invokeFeedback, setInvokeFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const walletConnected = useWalletStore((state) => state.connected);
  const walletAddress = useWalletStore((state) => state.address);

  const showNews = app?.news_integration !== false;
  const showSecrets = app?.permissions?.confidential === true;

  // App-specific activity feed
  const { activities: appActivities } = useActivityFeed({
    appId: app?.app_id,
    pollInterval: 5000,
    enabled: Boolean(app?.app_id),
  });

  const tabs = useMemo(
    () => buildDetailTabs(app?.detail_template?.tabs ?? [], showNews, showSecrets),
    [app?.detail_template?.tabs, showNews, showSecrets],
  );

  const operations = useMemo(() => {
    const panelOps = app?.detail_template?.operation_panel?.operations;
    if (Array.isArray(panelOps) && panelOps.length > 0) return panelOps;
    return Array.isArray(app?.operations) ? app.operations : [];
  }, [app?.detail_template?.operation_panel?.operations, app?.operations]);

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [activeTab, tabs]);

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

  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  const handleBack = () => {
    router.push("/miniapps");
  };

  const handleLaunch = () => {
    router.push(`/launch/${app.app_id}`);
  };

  const handleInvoke = useCallback(async (operation: OperationEntry, values: Record<string, string>) => {
    setInvokeFeedback(null);
    try {
      if (!app.contract_hash) {
        throw new Error("Contract hash is not configured for this miniapp.");
      }
      if (!walletConnected && !walletAddress) {
        throw new Error("Connect wallet before sending transactions.");
      }

      const args = buildInvokeArgs(operation.params ?? [], values, walletAddress);

      let txid: string;

      // Neo X (EVM) Branch
      if (walletAddress.startsWith("0x") || app.contract_hash.startsWith("0x")) {
        const result = await invokeEvmContract(app.contract_hash, operation.method, args, walletAddress);
        txid = result.txid;
      } 
      // Neo N3 Branch
      else {
        const adapter = getWalletAdapter();
        if (!adapter) {
          throw new Error("Wallet adapter unavailable. Reconnect wallet and try again.");
        }

        const invokePayload: InvokeParams = {
          scriptHash: app.contract_hash,
          operation: operation.method,
          args,
        };

        if (walletAddress) {
          invokePayload.signers = [{ account: walletAddress, scopes: 1 }];
        }

        const result = await adapter.invoke(invokePayload);
        txid = result.txid;
      }

      setInvokeFeedback({
        type: "success",
        message: `Transaction submitted: ${txid}`,
      });
    } catch (invokeError) {
      const message = invokeError instanceof Error ? invokeError.message : "Operation failed";
      setInvokeFeedback({
        type: "error",
        message,
      });
      throw invokeError;
    }
  }, [app.contract_hash, walletAddress, walletConnected]);

  const statCards = stats ? buildStatCards(stats, app.stats_display ?? undefined) : [];
  const operationPanel = app.detail_template?.operation_panel;
  const operationTitle = operationPanel?.title || (app.detail_template?.layout === "prediction" ? "Trade" : "Operations");
  const operationSubtitle = operationPanel?.subtitle;
  const launchLabel = operationPanel?.cta_label || "Launch App";

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white pb-16">
      <Head>
        <title>{`${app.name} - R3E MiniApps`}</title>
      </Head>
      <AppDetailHeader app={app} stats={stats || undefined} onBack={handleBack} />

      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <section className="mb-6">
          {app.detail_template?.hero?.eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-neo mb-2">
              {app.detail_template.hero.eyebrow}
            </p>
          )}
          <p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed break-words">
            {app.description}
          </p>
          {app.detail_template?.hero?.disclaimer && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 break-words">
              {app.detail_template.hero.disclaimer}
            </p>
          )}
        </section>

        {stats && statCards.length > 0 && (
          <section className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 mb-8">
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

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          <section className="space-y-6">
            <section>
              <ActivityTicker activities={appActivities} title={`${app.name} Activity`} height={140} scrollSpeed={20} />
            </section>

            <section>
              <div role="tablist" className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 mb-6">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={activeTabConfig?.id === tab.id}
                    aria-controls={`tabpanel-${tab.id}`}
                    tabIndex={activeTabConfig?.id === tab.id ? 0 : -1}
                    className={`px-3 sm:px-5 py-2 sm:py-3 bg-transparent border-none border-b-2 text-sm font-semibold cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 ${
                      activeTabConfig?.id === tab.id
                        ? "border-neo text-neo"
                        : "border-transparent text-gray-500 dark:text-gray-400"
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTabConfig?.type === "content" && (
                <div id={`tabpanel-${activeTabConfig.id}`} role="tabpanel" aria-labelledby={`tab-${activeTabConfig.id}`}>
                  <OverviewTab app={app} blocks={activeTabConfig.blocks} />
                </div>
              )}

              {activeTabConfig?.type === "reviews" && (
                <div id={`tabpanel-${activeTabConfig.id}`} role="tabpanel" aria-labelledby={`tab-${activeTabConfig.id}`}>
                  <ReviewsTab appId={app.app_id} />
                </div>
              )}

              {activeTabConfig?.type === "forum" && (
                <div id={`tabpanel-${activeTabConfig.id}`} role="tabpanel" aria-labelledby={`tab-${activeTabConfig.id}`}>
                  <ForumTab appId={app.app_id} />
                </div>
              )}

              {activeTabConfig?.type === "news" && (
                <div id={`tabpanel-${activeTabConfig.id}`} role="tabpanel" aria-labelledby={`tab-${activeTabConfig.id}`}>
                  {showNews ? (
                    <AppNewsList notifications={notifications} />
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400">News feed disabled by manifest.</p>
                  )}
                </div>
              )}

              {activeTabConfig?.type === "secrets" && (
                <div id={`tabpanel-${activeTabConfig.id}`} role="tabpanel" aria-labelledby={`tab-${activeTabConfig.id}`}>
                  {showSecrets ? (
                    <AppSecretsTab appId={app.app_id} appName={app.name} />
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Secrets are not enabled for this MiniApp.</p>
                  )}
                </div>
              )}
            </section>
          </section>

          <aside className="xl:sticky xl:top-6 self-start space-y-4">
            <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 p-4 sm:p-5">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{operationTitle}</h2>
              {operationSubtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words">{operationSubtitle}</p>
              )}

              {invokeFeedback && (
                <div
                  className={`mt-3 rounded-lg border px-3 py-2 text-xs break-words ${
                    invokeFeedback.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-900/20 dark:text-emerald-300"
                      : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-900/20 dark:text-red-300"
                  }`}
                >
                  {invokeFeedback.message}
                </div>
              )}

              {operations.length > 0 ? (
                <OperationPanel
                  operations={operations}
                  onInvoke={handleInvoke}
                  showTitle={false}
                  className="mt-4"
                />
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                  No operation schema is configured for this MiniApp.
                </p>
              )}

              {!walletConnected && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  Connect wallet from the top navigation to submit on-chain transactions.
                </p>
              )}

              <button
                type="button"
                className="mt-4 w-full px-6 py-3 rounded-xl border-none bg-neo text-black text-sm font-bold cursor-pointer transition-all hover:bg-neo/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
                onClick={handleLaunch}
              >
                {launchLabel} →
              </button>
            </section>

            <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Contract Details</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 my-1.5">
                App ID: <code className="bg-neo/10 px-1.5 py-0.5 rounded text-[11px] font-mono text-neo break-all">{app.app_id}</code>
              </p>
              {app.contract_hash && (
                <p className="text-xs text-gray-500 dark:text-gray-400 my-1.5">
                  Contract Hash:{" "}
                  <code className="bg-neo/10 px-1.5 py-0.5 rounded text-[11px] font-mono text-neo break-all">
                    {app.contract_hash}
                  </code>
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 my-1.5">
                Entry URL: <code className="bg-neo/10 px-1.5 py-0.5 rounded text-[11px] font-mono text-neo break-all">{app.entry_url}</code>
              </p>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function OverviewTab({ app, blocks }: { app: MiniAppInfo; blocks: MiniAppContentBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.length > 0 && <DetailContentBlocks blocks={blocks} />}

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
            className="text-neo no-underline text-sm font-medium transition-colors hover:text-neo/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 rounded-lg"
          >
            📄 View Documentation →
          </a>
        </div>
      )}
    </div>
  );
}

function buildDetailTabs(templateTabs: MiniAppDetailTab[], showNews: boolean, showSecrets: boolean): ResolvedTab[] {
  const mappedTemplateTabs = templateTabs
    .map((tab) => ({
      id: String(tab.id || "").trim().toLowerCase() || slugifyTabLabel(tab.label || ""),
      label: String(tab.label || "").trim() || "Overview",
      type: tab.type,
      blocks: Array.isArray(tab.blocks) ? tab.blocks : [],
    }))
    .filter((tab) => Boolean(tab.id) && tab.type)
    .filter((tab) => (tab.type === "news" ? showNews : true))
    .filter((tab) => (tab.type === "secrets" ? showSecrets : true));

  if (mappedTemplateTabs.length > 0) {
    return dedupeTabs(mappedTemplateTabs);
  }

  const defaults: ResolvedTab[] = [
    { id: "overview", label: "Overview", type: "content", blocks: [] },
    { id: "reviews", label: "Reviews", type: "reviews", blocks: [] },
    { id: "forum", label: "Forum", type: "forum", blocks: [] },
  ];

  if (showNews) {
    defaults.push({ id: "news", label: "News", type: "news", blocks: [] });
  }
  if (showSecrets) {
    defaults.push({ id: "secrets", label: "Secrets", type: "secrets", blocks: [] });
  }

  return defaults;
}

function dedupeTabs(tabs: ResolvedTab[]): ResolvedTab[] {
  const seen = new Set<string>();
  const deduped: ResolvedTab[] = [];

  for (const tab of tabs) {
    if (seen.has(tab.id)) continue;
    seen.add(tab.id);
    deduped.push(tab);
  }

  return deduped;
}

function slugifyTabLabel(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "overview";
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

function buildInvokeArgs(
  params: OperationParam[],
  values: Record<string, string>,
  walletAddress: string,
): Array<{ type: string; value: unknown }> {
  return params.map((param) => {
    const rawValue = String(values[param.name] ?? "").trim();
    const value = rawValue || String(param.default_value ?? "").trim();

    if (!value && param.required) {
      throw new Error(`${param.label || param.name} is required.`);
    }

    if (param.type === "boolean") {
      return {
        type: "Boolean",
        value: value === "true",
      };
    }

    if (param.type === "integer") {
      if (!/^-?\d+$/.test(value)) {
        throw new Error(`${param.label || param.name} must be an integer.`);
      }
      return {
        type: "Integer",
        value,
      };
    }

    if (param.type === "amount") {
      if (!/^-?\d+(?:\.\d+)?$/.test(value)) {
        throw new Error(`${param.label || param.name} must be numeric.`);
      }
      return {
        type: "Integer",
        value,
      };
    }

    if (param.type === "hash160") {
      return {
        type: "Hash160",
        value,
      };
    }

    if (param.type === "hash256") {
      return {
        type: "Hash256",
        value,
      };
    }

    if (param.type === "address") {
      return {
        type: "String",
        value: value === "$wallet" ? walletAddress : value,
      };
    }

    return {
      type: "String",
      value,
    };
  });
}

// Server-Side Props
export const getServerSideProps: GetServerSideProps<AppDetailPageProps> = async (context) => {
  const { id } = context.params as { id: string };
  const encodedId = encodeURIComponent(id);

  // First check if it's a registry miniapp - return immediately if found
  const fallback = getMiniApp(id);

  try {
    const baseUrl = resolveInternalBaseUrl(context.req as RequestLike | undefined);
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
    const app = coerceMiniAppInfo(catalogApp, fallback ?? undefined);

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
  } catch (loadError) {
    logger.error("Failed to fetch app details:", loadError);
    if (fallback) {
      return {
        props: {
          app: sanitizeForJson(fallback),
          stats: null,
          notifications: [],
          error: "Using fallback app metadata while live API data is unavailable",
        },
      };
    }
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
