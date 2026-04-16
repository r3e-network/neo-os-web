import { useCallback, useEffect, useMemo, useState } from "react";
import { GetServerSideProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import {
  MiniAppInfo,
  MiniAppNotification,
  AppDetailHeader,
  AppNewsList,
  OperationPanel,
  MiniAppContentBlock,
  MiniAppDetailTab,
  MiniAppDetailTabType,
} from "../../components";
import { MiniAppPlayfield } from "../../components/MiniAppPlayfield";
import type { OperationEntry, OperationParam } from "../../components/types";
import { ActivityTicker } from "../../components/ActivityTicker";
import { DetailContentBlocks } from "../../components/features/miniapp/DetailContentBlocks";
import { Layout } from "../../components/layout";

// Lazy-load heavy tab components (only loaded when user navigates to that tab)
const AppSecretsTab = dynamic(
  () => import("../../components/features/secrets/AppSecretsTab").then((m) => ({ default: m.AppSecretsTab })),
  { loading: () => <div className="h-64 animate-pulse bg-gray-100 rounded-xl" />, ssr: false },
);
const ReviewsTab = dynamic(
  () => import("../../components/features/reviews").then((m) => ({ default: m.ReviewsTab })),
  { loading: () => <div className="h-64 animate-pulse bg-gray-100 rounded-xl" />, ssr: false },
);
const ForumTab = dynamic(
  () => import("../../components/features/forum").then((m) => ({ default: m.ForumTab })),
  { loading: () => <div className="h-64 animate-pulse bg-gray-100 rounded-xl" />, ssr: false },
);
import { useActivityFeed } from "../../hooks/useActivityFeed";
import { useRealtimeNotifications } from "../../hooks/useRealtimeNotifications";
import { coerceMiniAppInfo } from "../../lib/miniapp";
import { fetchWithTimeout, resolveInternalBaseUrl } from "../../lib/edge";
import { loadBundledMiniAppById } from "../../lib/miniapp-definitions";
import { logger } from "../../lib/logger";
import {
  buildSharedInvokeArgs,
  isSharedModeApp,
  resolveSharedModeRuntime,
  resolveSharedOperationRecipe,
  type SharedModeRuntimeInfo,
} from "../../lib/chain";
import type { InvokeParams } from "../../lib/wallet/adapters/base";
import { getWalletAdapter, useWalletStore } from "../../lib/wallet/store";

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

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

type ResolvedTab = {
  id: string;
  label: string;
  type: MiniAppDetailTabType;
  blocks: MiniAppContentBlock[];
};

export type AppDetailPageProps = {
  app: MiniAppInfo | null;
  notifications: MiniAppNotification[];
  sharedRuntime?: SharedModeRuntimeInfo | null;
  error?: string;
};

export default function MiniAppDetailPage({ app, notifications, sharedRuntime, error }: AppDetailPageProps) {
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

  // App-specific activity feed (events + transactions poll, notifications via Realtime)
  const { activities: appActivities } = useActivityFeed({
    appId: app?.app_id,
    pollInterval: 5000,
    enabled: Boolean(app?.app_id),
  });

  // Realtime notifications for the news tab (replaces SSR-only notifications prop)
  const { notifications: realtimeNews, loading: newsLoading } = useRealtimeNotifications({
    appId: app?.app_id,
    enabled: Boolean(app?.app_id) && showNews,
  });

  // Use realtime notifications if available, fall back to SSR-provided notifications
  const liveNotifications = realtimeNews.length > 0 ? realtimeNews : notifications;

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
      <Layout hideFooter>
        <div className="min-h-screen bg-white pb-24 pt-20 text-gray-900">
          <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center p-8">
            <h1 className="mb-4 text-[32px] font-extrabold text-gray-900">App Not Found</h1>
            <p className="mb-6 text-base text-gray-500">
              {error || "The requested MiniApp does not exist."}
            </p>
            <button
              type="button"
              className="cursor-pointer rounded-lg border border-gray-200 bg-transparent px-6 py-3 text-sm text-gray-900 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
              onClick={() => router.push("/miniapps")}
            >
              ← Back to MiniApps
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  const handleBack = () => {
    router.push("/miniapps");
  };

  const handleInvoke = useCallback(async (operation: OperationEntry, values: Record<string, string>) => {
    setInvokeFeedback(null);
    try {
      if (!walletConnected || !walletAddress) {
        throw new Error("Connect wallet before sending transactions.");
      }

      let txid: string;
      if (sharedRuntime && isSharedModeApp(app)) {
        const sharedOperation = resolveSharedOperationRecipe(app, operation.method);
        if (!sharedOperation) {
          throw new Error("Shared runtime operation is not configured for this miniapp.");
        }
        const targetModule = sharedRuntime.modules.find((module) => module.binding === sharedOperation.binding);
        if (!targetModule?.contractHash) {
          throw new Error(`Shared module binding "${sharedOperation.binding}" is unavailable.`);
        }
        const adapter = getWalletAdapter();
        if (!adapter) {
          throw new Error("Wallet adapter unavailable. Reconnect wallet and try again.");
        }

        if (walletAddress.startsWith("0x")) {
          throw new Error("Shared runtime invoke currently supports Neo N3 wallets only.");
        }

        const args = buildSharedInvokeArgs(sharedOperation, values, sharedRuntime, walletAddress);
        const invokePayload: InvokeParams = {
          scriptHash: targetModule.contractHash,
          operation: sharedOperation.method,
          args,
        };
        invokePayload.signers = [{ account: walletAddress, scopes: 1 }];
        const result = await adapter.invoke(invokePayload);
        txid = result.txid;
      } else {
        if (!app.contract_hash) {
          throw new Error("Contract hash is not configured for this miniapp.");
        }

        const args = buildInvokeArgs(operation.params ?? [], values, walletAddress);

        // Neo N3 only (Neo X / EVM not supported yet)
        {
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
  }, [app, sharedRuntime, walletAddress, walletConnected]);

  const operationPanel = app.detail_template?.operation_panel;
  const operationTitle = operationPanel?.title || (app.detail_template?.layout === "prediction" ? "Trade" : "Operations");
  const operationSubtitle = operationPanel?.subtitle;

  return (
    <Layout hideFooter>
      <div className="min-h-screen bg-white pb-16 pt-16 text-gray-900">
        <Head>
          <title>{`${app.name} - R3E MiniApps`}</title>
        </Head>
        <AppDetailHeader app={app} onBack={handleBack} />

        <main className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-8">
          <section className="mb-6 rounded-3xl border border-gray-200/70 bg-white/80 p-6 shadow-sm">
            {app.detail_template?.hero?.eyebrow && (
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-neo">
                {app.detail_template.hero.eyebrow}
              </p>
            )}
            <p className="break-words text-base leading-relaxed text-gray-600">
              {app.description}
            </p>
            {app.detail_template?.hero?.disclaimer && (
              <p className="mt-3 break-words text-xs text-gray-500 italic">
                {app.detail_template.hero.disclaimer}
              </p>
            )}
            {app.docs_url && (
              <div className="mt-4">
                <a
                  href={app.docs_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs font-medium text-gray-500 hover:text-neo transition-colors"
                >
                  View documentation &rarr;
                </a>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-6">
              <section className="relative z-10 w-full">
                <MiniAppPlayfield app={app} />
              </section>

              <section>
                <ActivityTicker activities={appActivities} title={`${app.name} Activity`} height={140} scrollSpeed={20} />
              </section>

              <section className="rounded-3xl border border-gray-200/70 bg-white/70 p-5 shadow-sm">
                <div role="tablist" className="mb-6 flex flex-wrap gap-1 p-1 rounded-2xl bg-gray-100/50 border border-gray-200/50">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      id={`tab-${tab.id}`}
                      aria-selected={activeTabConfig?.id === tab.id}
                      aria-controls={`tabpanel-${tab.id}`}
                      tabIndex={activeTabConfig?.id === tab.id ? 0 : -1}
                      className={`cursor-pointer rounded-xl bg-transparent px-3 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 sm:px-5 sm:py-2.5 ${
                        activeTabConfig?.id === tab.id
                          ? "bg-white text-neo shadow-sm"
                          : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
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
                      <AppNewsList notifications={liveNotifications} loading={newsLoading} />
                    ) : (
                      <p className="text-xs text-gray-500">News feed disabled by manifest.</p>
                    )}
                  </div>
                )}

                {activeTabConfig?.type === "secrets" && (
                  <div id={`tabpanel-${activeTabConfig.id}`} role="tabpanel" aria-labelledby={`tab-${activeTabConfig.id}`}>
                    {showSecrets ? (
                      <AppSecretsTab appId={app.app_id} appName={app.name} />
                    ) : (
                      <p className="text-xs text-gray-500">Secrets are not enabled for this MiniApp.</p>
                    )}
                  </div>
                )}
              </section>
            </section>

            <aside className="self-start space-y-4 xl:sticky xl:top-24">
              <section className="rounded-3xl border border-gray-200/70 bg-white/70 p-4 sm:p-5 shadow-sm">
                <h2 className="text-base font-bold text-gray-900 sm:text-lg">{operationTitle}</h2>
                {operationSubtitle && (
                  <p className="mt-1 break-words text-xs text-gray-500">{operationSubtitle}</p>
                )}

                {invokeFeedback && (
                  <div
                    className={`mt-3 rounded-lg border px-3 py-2 text-xs break-words ${
                      invokeFeedback.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700"
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
                  <p className="mt-4 text-xs text-gray-500">
                    No operation schema is configured for this MiniApp.
                  </p>
                )}

                {!walletConnected && (
                  <p className="mt-3 text-xs text-gray-500">
                    Connect wallet from the top navigation to submit on-chain transactions.
                  </p>
                )}

                {isSharedModeApp(app) && !app.contract_hash && (
                  <p className="mt-3 text-xs text-gray-500">
                    This app is running in shared mode. Operations are resolved through recipe bindings and shared module contracts instead of a dedicated app contract.
                  </p>
                )}
              </section>

              {sharedRuntime && (
                <section className="rounded-3xl border border-gray-200/70 bg-white/70 p-4 sm:p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">Shared Runtime</h3>
                  <p className="my-1.5 text-xs text-gray-500">
                    Instance ID:{" "}
                    <code className="break-all rounded bg-neo/10 px-1.5 py-0.5 font-mono text-[11px] text-neo">
                      {sharedRuntime.instance.instanceId}
                    </code>
                  </p>
                  <p className="my-1.5 text-xs text-gray-500">
                    Recipe:{" "}
                    <code className="break-all rounded bg-neo/10 px-1.5 py-0.5 font-mono text-[11px] text-neo">
                      {sharedRuntime.instance.recipeId}@{sharedRuntime.instance.recipeVersion}
                    </code>
                  </p>
                  <p className="my-1.5 text-xs text-gray-500">
                    Mode:{" "}
                    <span className="rounded bg-neo/10 px-1.5 py-0.5 font-mono text-[11px] text-neo">
                      {sharedRuntime.instance.runtimeMode}
                    </span>
                  </p>
                  <p className="my-1.5 text-xs text-gray-500">
                    Status:{" "}
                    <span className="rounded bg-neo/10 px-1.5 py-0.5 font-mono text-[11px] text-neo">
                      {sharedRuntime.instance.status === 1 ? "active" : String(sharedRuntime.instance.status)}
                    </span>
                  </p>
                  <div className="mt-4 space-y-3">
                    {sharedRuntime.modules.map((module) => (
                      <div key={`${module.binding}:${module.moduleId}:${module.version}`} className="rounded-xl border border-gray-200/70 bg-white/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">{module.binding}</span>
                          <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${module.active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {module.active ? "active" : "inactive"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-700">{module.moduleId}@{module.version}</p>
                        {module.contractHash && (
                          <p className="mt-1 break-all text-[11px] text-gray-500">{module.contractHash}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-3xl border border-gray-200/70 bg-white/70 p-4 sm:p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Contract Details</h3>
                <p className="my-1.5 text-xs text-gray-500">
                  App ID: <code className="break-all rounded bg-neo/10 px-1.5 py-0.5 font-mono text-[11px] text-neo">{app.app_id}</code>
                </p>
                {app.contract_hash && (
                  <p className="my-1.5 text-xs text-gray-500">
                    Contract Hash:{" "}
                    <code className="break-all rounded bg-neo/10 px-1.5 py-0.5 font-mono text-[11px] text-neo">
                      {app.contract_hash}
                    </code>
                  </p>
                )}
                <p className="my-1.5 text-xs text-gray-500">
                  Entry URL: <code className="break-all rounded bg-neo/10 px-1.5 py-0.5 font-mono text-[11px] text-neo">{app.entry_url}</code>
                </p>
                {app.docs_url && (
                  <p className="my-1.5 text-xs text-gray-500">
                    Docs URL: <code className="break-all rounded bg-neo/10 px-1.5 py-0.5 font-mono text-[11px] text-neo">{app.docs_url}</code>
                  </p>
                )}
              </section>
            </aside>
          </div>
        </main>
      </div>
    </Layout>
  );
}

function OverviewTab({ app, blocks }: { app: MiniAppInfo; blocks: MiniAppContentBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.length > 0 && <DetailContentBlocks blocks={blocks} />}

      <div className="bg-white/70 rounded-2xl p-6 border border-gray-200/70">
        <h3 className="text-lg font-semibold text-gray-900 mt-0 mb-4">Permissions</h3>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {Object.entries(app.permissions).map(([key, value]) =>
            value ? (
              <div key={key} className="flex items-center gap-2">
                <span className="text-neo text-base font-bold">✓</span>
                <span className="text-sm text-gray-900">{formatPermission(key)}</span>
              </div>
            ) : null,
          )}
        </div>
      </div>

      {app.limits && (
        <div className="bg-white/70 rounded-2xl p-6 border border-gray-200/70">
          <h3 className="text-lg font-semibold text-gray-900 mt-0 mb-4">Limits</h3>
          <ul className="list-none p-0 m-0">
            {app.limits.max_gas_per_tx && (
              <li className="text-sm text-gray-500 py-2 border-b border-gray-200">
                Max GAS per transaction: {app.limits.max_gas_per_tx}
              </li>
            )}
            {app.limits.daily_gas_cap_per_user && (
              <li className="text-sm text-gray-500 py-2 border-b border-gray-200">
                Daily GAS cap per user: {app.limits.daily_gas_cap_per_user}
              </li>
            )}
            {app.limits.governance_cap && (
              <li className="text-sm text-gray-500 py-2 border-b border-gray-200">
                Governance cap per user: {app.limits.governance_cap}
              </li>
            )}
          </ul>
        </div>
      )}

      {app.docs_url && (
        <div className="bg-white/70 rounded-2xl p-6 border border-gray-200/70">
          <h3 className="text-lg font-semibold text-gray-900 mt-0 mb-4">Documentation</h3>
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

  const fallback = await loadBundledMiniAppById(id);

  try {
    const baseUrl = resolveInternalBaseUrl(context.req as RequestLike | undefined);
    // Parallel fetch with shorter timeout (2s) for faster page load
    const [catalogRes, notifRes] = await Promise.all([
      fetchWithTimeout(`${baseUrl}/api/miniapps/catalog?app_id=${encodedId}`, {}, 2000).catch((e: unknown) => { console.warn("[miniapps/id] catalog fetch failed:", e instanceof Error ? e.message : String(e)); return null; }),
      fetchWithTimeout(`${baseUrl}/api/app/${encodedId}/news?limit=20`, {}, 2000).catch((e: unknown) => { console.warn("[miniapps/id] news fetch failed:", e instanceof Error ? e.message : String(e)); return null; }),
    ]);

    const catalogData = catalogRes?.ok ? await catalogRes.json().catch((e: unknown) => { console.warn("[miniapps/id] failed to parse catalog JSON:", e instanceof Error ? e.message : String(e)); return ({}); }) : {};
    const notifData = notifRes?.ok ? await notifRes.json().catch((e: unknown) => { console.warn("[miniapps/id] failed to parse notifications JSON:", e instanceof Error ? e.message : String(e)); return { notifications: [] }; }) : { notifications: [] };
    const catalogApp = catalogData?.app ?? null;
    const app = coerceMiniAppInfo(catalogApp, fallback ?? undefined);

    if (!app) {
      return {
        props: {
          app: null,
          notifications: [],
          error: "App not found",
        },
      };
    }

    const sharedRuntime = isSharedModeApp(app)
      ? await resolveSharedModeRuntime(app, "testnet").catch((e: unknown) => {
          console.warn("[miniapps/id] shared runtime resolve failed:", e instanceof Error ? e.message : String(e));
          return null;
        })
      : null;

    return {
      props: {
        app: sanitizeForJson(app),
        notifications: notifData.notifications || [],
        sharedRuntime: sanitizeForJson(sharedRuntime),
      },
    };
  } catch (loadError) {
    logger.error("Failed to fetch app details:", loadError);
    if (fallback) {
      return {
        props: {
          app: sanitizeForJson(fallback),
          notifications: [],
          sharedRuntime: null,
          error: "Using fallback app metadata while live API data is unavailable",
        },
      };
    }
    return {
      props: {
        app: null,
        notifications: [],
        sharedRuntime: null,
        error: "Failed to load app details",
      },
    };
  }
};
