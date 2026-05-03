import { useCallback, useEffect, useMemo, useState } from "react";
import { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import {
  Activity,
  ExternalLink,
  Info,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
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
  () =>
    import("../../components/features/secrets/AppSecretsTab").then((m) => ({
      default: m.AppSecretsTab,
    })),
  {
    loading: () => (
      <div className="h-64 animate-pulse bg-gray-100 rounded-xl" />
    ),
    ssr: false,
  },
);
const ReviewsTab = dynamic(
  () =>
    import("../../components/features/reviews").then((m) => ({
      default: m.ReviewsTab,
    })),
  {
    loading: () => (
      <div className="h-64 animate-pulse bg-gray-100 rounded-xl" />
    ),
    ssr: false,
  },
);
const ForumTab = dynamic(
  () =>
    import("../../components/features/forum").then((m) => ({
      default: m.ForumTab,
    })),
  {
    loading: () => (
      <div className="h-64 animate-pulse bg-gray-100 rounded-xl" />
    ),
    ssr: false,
  },
);
import { useActivityFeed } from "../../hooks/useActivityFeed";
import { useRealtimeNotifications } from "../../hooks/useRealtimeNotifications";
import { coerceMiniAppInfo } from "../../lib/miniapp";
import { fetchWithTimeout, resolveInternalBaseUrl } from "../../lib/edge";
import { loadBundledMiniAppById } from "../../lib/miniapp-definitions";
import { loadMiniAppCatalog } from "../../lib/miniapp-catalog";
import { isArchivedMiniAppId } from "../../lib/archived-miniapps";
import { logger } from "../../lib/logger";
import { MiniAppLogo } from "../../components/features/miniapp/MiniAppLogo";
import {
  addressToScriptHash,
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

type MiniAppNavItem = Pick<
  MiniAppInfo,
  "app_id" | "name" | "category" | "entry_url" | "logo_url"
>;

export type AppDetailPageProps = {
  app: MiniAppInfo | null;
  miniAppNav: MiniAppNavItem[];
  notifications: MiniAppNotification[];
  sharedRuntime?: SharedModeRuntimeInfo | null;
  error?: string;
};

export default function MiniAppDetailPage({
  app,
  miniAppNav,
  notifications,
  sharedRuntime,
  error,
}: AppDetailPageProps) {
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
  const { notifications: realtimeNews, loading: newsLoading } =
    useRealtimeNotifications({
      appId: app?.app_id,
      enabled: Boolean(app?.app_id) && showNews,
    });

  // Use realtime notifications if available, fall back to SSR-provided notifications
  const liveNotifications =
    realtimeNews.length > 0 ? realtimeNews : notifications;

  const tabs = useMemo(
    () =>
      buildDetailTabs(app?.detail_template?.tabs ?? [], showNews, showSecrets),
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
            <h1 className="mb-4 text-[32px] font-extrabold text-gray-900">
              App Not Found
            </h1>
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

  const handleInvoke = useCallback(
    async (operation: OperationEntry, values: Record<string, string>) => {
      setInvokeFeedback(null);
      try {
        if (!walletConnected || !walletAddress) {
          throw new Error("Connect wallet before sending transactions.");
        }

        let txid: string;
        if (sharedRuntime && isSharedModeApp(app)) {
          const sharedOperation = resolveSharedOperationRecipe(
            app,
            operation.method,
          );
          if (!sharedOperation) {
            throw new Error(
              "Shared runtime operation is not configured for this miniapp.",
            );
          }
          const targetModule = sharedRuntime.modules.find(
            (module) => module.binding === sharedOperation.binding,
          );
          if (!targetModule?.contractHash) {
            throw new Error(
              `Shared module binding "${sharedOperation.binding}" is unavailable.`,
            );
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }

          if (walletAddress.startsWith("0x")) {
            throw new Error(
              "Shared runtime invoke currently supports Neo N3 wallets only.",
            );
          }

          const args = buildSharedInvokeArgs(
            sharedOperation,
            values,
            sharedRuntime,
            walletAddress,
          );
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
            throw new Error(
              "Contract hash is not configured for this miniapp.",
            );
          }

          const args = buildInvokeArgs(
            operation.params ?? [],
            values,
            walletAddress,
          );

          // Neo N3 execution only; embedded EVM auth is not a transaction path here.
          {
            const adapter = getWalletAdapter();
            if (!adapter) {
              throw new Error(
                "Wallet adapter unavailable. Reconnect wallet and try again.",
              );
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
        const message =
          invokeError instanceof Error
            ? invokeError.message
            : "Operation failed";
        setInvokeFeedback({
          type: "error",
          message,
        });
        throw invokeError;
      }
    },
    [app, sharedRuntime, walletAddress, walletConnected],
  );

  const operationPanel = app.detail_template?.operation_panel;
  const operationTitle =
    operationPanel?.title ||
    (app.detail_template?.layout === "prediction" ? "Trade" : "Operations");
  const operationSubtitle = operationPanel?.subtitle;

  return (
    <Layout hideFooter>
      <div className="min-h-screen bg-[#f6f8fb] pb-10 pt-16 text-gray-900">
        <Head>
          <title>{`${app.name} - R3E MiniApps`}</title>
        </Head>
        <AppDetailHeader app={app} onBack={handleBack} />

        <main className="mx-auto max-w-[1600px] px-3 py-4 sm:px-5">
          <div
            className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[268px_minmax(0,1fr)_340px]"
            data-testid="miniapp-detail-layout"
          >
            <MiniAppListRail currentAppId={app.app_id} miniapps={miniAppNav} />

            <section className="order-1 min-w-0 space-y-6 xl:order-none" aria-label="MiniApp workspace">
              <section
                className="relative z-10 w-full"
                aria-label="MiniApp play area"
                data-testid="miniapp-playarea"
              >
                <MiniAppPlayfield app={app} />
              </section>

              <section
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
                aria-label="MiniApp information"
                data-testid="miniapp-info"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {app.detail_template?.hero?.eyebrow && (
                      <p className="mb-2 text-xs font-semibold uppercase text-emerald-600">
                        {app.detail_template.hero.eyebrow}
                      </p>
                    )}
                    <h2 className="m-0 flex items-center gap-2 text-base font-bold text-gray-900">
                      <Info className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      MiniApp Information
                    </h2>
                    <p className="mt-2 break-words text-sm leading-6 text-gray-600">
                      {app.description}
                    </p>
                    {app.detail_template?.hero?.disclaimer && (
                      <p className="mt-2 break-words text-xs italic text-gray-500">
                        {app.detail_template.hero.disclaimer}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold capitalize text-emerald-700">
                      {app.status || "active"}
                    </span>
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold capitalize text-gray-600">
                      {app.category}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                  <InfoPill label="App ID" value={app.app_id} />
                  <InfoPill
                    label="Contract"
                    value={app.contract_hash || "Shared / frontend runtime"}
                  />
                </div>
              </section>

              {appActivities && appActivities.length > 0 && (
                <section>
                  <ActivityTicker
                    activities={appActivities}
                    title={`${app.name} Activity`}
                    height={140}
                    scrollSpeed={20}
                  />
                </section>
              )}

              <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                <div
                  role="tablist"
                  className="mb-5 flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1"
                >
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      id={`tab-${tab.id}`}
                      aria-selected={activeTabConfig?.id === tab.id}
                      aria-controls={`tabpanel-${tab.id}`}
                      tabIndex={activeTabConfig?.id === tab.id ? 0 : -1}
                      className={`cursor-pointer rounded-md bg-transparent px-3 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 sm:px-4 ${
                        activeTabConfig?.id === tab.id
                          ? "bg-white text-emerald-700 shadow-sm"
                          : "text-gray-500 hover:bg-white/70 hover:text-gray-900"
                      }`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTabConfig?.type === "content" && (
                  <div
                    id={`tabpanel-${activeTabConfig.id}`}
                    role="tabpanel"
                    aria-labelledby={`tab-${activeTabConfig.id}`}
                  >
                    <OverviewTab app={app} blocks={activeTabConfig.blocks} />
                  </div>
                )}

                {activeTabConfig?.type === "reviews" && (
                  <div
                    id={`tabpanel-${activeTabConfig.id}`}
                    role="tabpanel"
                    aria-labelledby={`tab-${activeTabConfig.id}`}
                  >
                    <ReviewsTab appId={app.app_id} />
                  </div>
                )}

                {activeTabConfig?.type === "forum" && (
                  <div
                    id={`tabpanel-${activeTabConfig.id}`}
                    role="tabpanel"
                    aria-labelledby={`tab-${activeTabConfig.id}`}
                  >
                    <ForumTab appId={app.app_id} />
                  </div>
                )}

                {activeTabConfig?.type === "news" && (
                  <div
                    id={`tabpanel-${activeTabConfig.id}`}
                    role="tabpanel"
                    aria-labelledby={`tab-${activeTabConfig.id}`}
                  >
                    {showNews ? (
                      <AppNewsList
                        notifications={liveNotifications}
                        loading={newsLoading}
                      />
                    ) : (
                      <p className="text-xs text-gray-500">
                        News feed disabled by manifest.
                      </p>
                    )}
                  </div>
                )}

                {activeTabConfig?.type === "secrets" && (
                  <div
                    id={`tabpanel-${activeTabConfig.id}`}
                    role="tabpanel"
                    aria-labelledby={`tab-${activeTabConfig.id}`}
                  >
                    {showSecrets ? (
                      <AppSecretsTab appId={app.app_id} appName={app.name} />
                    ) : (
                      <p className="text-xs text-gray-500">
                        Secrets are not enabled for this MiniApp.
                      </p>
                    )}
                  </div>
                )}
              </section>
            </section>

            <aside
              className="order-3 self-start space-y-3 xl:order-none xl:sticky xl:top-24"
              aria-label="MiniApp actions"
              data-testid="miniapp-actions"
            >
              <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                      Action Console
                    </p>
                    <h2 className="m-0 text-base font-bold text-gray-900 sm:text-lg">
                      {operationTitle}
                    </h2>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      walletConnected
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-gray-50 text-gray-500"
                    }`}
                  >
                    {walletConnected ? "Wallet Ready" : "Wallet Required"}
                  </span>
                </div>
                {operationSubtitle && (
                  <p className="mt-1 break-words text-xs text-gray-500">
                    {operationSubtitle}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <Wallet className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">
                    {walletConnected && walletAddress
                      ? walletAddress
                      : "Connect wallet from the top navigation to submit on-chain transactions."}
                  </span>
                </div>

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

                {operations.length > 0 && (
                  <OperationPanel
                    operations={operations}
                    onInvoke={handleInvoke}
                    showTitle={false}
                    className="mt-4"
                    variant="embedded"
                  />
                )}

                {!walletConnected && (
                  <p className="mt-3 text-xs leading-5 text-gray-500">
                    Connect wallet from the top navigation to submit on-chain
                    transactions.
                  </p>
                )}

                {isSharedModeApp(app) && !app.contract_hash && (
                  <p className="mt-3 text-xs leading-5 text-gray-500">
                    This app is running in shared mode. Operations are resolved
                    through recipe bindings and shared module contracts instead
                    of a dedicated app contract.
                  </p>
                )}
              </section>

              {sharedRuntime && (
                <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Activity className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    Shared Runtime
                  </h3>
                  <p className="my-1.5 text-xs text-gray-500">
                    Instance ID:{" "}
                    <code className="break-all rounded bg-neo/10 px-1.5 py-0.5 font-mono text-[11px] text-neo">
                      {sharedRuntime.instance.instanceId}
                    </code>
                  </p>
                  <p className="my-1.5 text-xs text-gray-500">
                    Recipe:{" "}
                    <code className="break-all rounded bg-neo/10 px-1.5 py-0.5 font-mono text-[11px] text-neo">
                      {sharedRuntime.instance.recipeId}@
                      {sharedRuntime.instance.recipeVersion}
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
                      {sharedRuntime.instance.status === 1
                        ? "active"
                        : String(sharedRuntime.instance.status)}
                    </span>
                  </p>
                  <div className="mt-4 space-y-3">
                    {sharedRuntime.modules.map((module) => (
                      <div
                        key={`${module.binding}:${module.moduleId}:${module.version}`}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold uppercase text-gray-500">
                            {module.binding}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${module.active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                          >
                            {module.active ? "active" : "inactive"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-700">
                          {module.moduleId}@{module.version}
                        </p>
                        {module.contractHash && (
                          <p className="mt-1 break-all text-[11px] text-gray-500">
                            {module.contractHash}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  Contract Details
                </h3>
                <p className="my-1.5 text-xs text-gray-500">
                  App ID:{" "}
                  <code className="break-all rounded bg-neo/10 px-1.5 py-0.5 font-mono text-[11px] text-neo">
                    {app.app_id}
                  </code>
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
                  Runtime:{" "}
                  <span className="rounded bg-neo/10 px-1.5 py-0.5 font-mono text-[11px] text-neo">
                    Native MiniApp page
                  </span>
                </p>
                {app.docs_url && (
                  <p className="my-1.5 text-xs text-gray-500">
                    Docs URL:{" "}
                    <code className="break-all rounded bg-neo/10 px-1.5 py-0.5 font-mono text-[11px] text-neo">
                      {app.docs_url}
                    </code>
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

function OverviewTab({
  app,
  blocks,
}: {
  app: MiniAppInfo;
  blocks: MiniAppContentBlock[];
}) {
  return (
    <div className="space-y-4">
      {blocks.length > 0 && <DetailContentBlocks blocks={blocks} />}

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="mb-4 mt-0 text-sm font-semibold text-gray-900">
          Permissions
        </h3>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
          {Object.entries(app.permissions).map(([key, value]) =>
            value ? (
              <div key={key} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                  ✓
                </span>
                <span className="text-sm text-gray-700">
                  {formatPermission(key)}
                </span>
              </div>
            ) : null,
          )}
        </div>
      </div>

      {app.limits && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-3 mt-0 text-sm font-semibold text-gray-900">
            Limits
          </h3>
          <ul className="list-none p-0 m-0">
            {app.limits.max_gas_per_tx && (
              <li className="border-b border-gray-200 py-2 text-sm text-gray-600">
                Max GAS per transaction: {app.limits.max_gas_per_tx}
              </li>
            )}
            {app.limits.daily_gas_cap_per_user && (
              <li className="border-b border-gray-200 py-2 text-sm text-gray-600">
                Daily GAS cap per user: {app.limits.daily_gas_cap_per_user}
              </li>
            )}
            {app.limits.governance_cap && (
              <li className="border-b border-gray-200 py-2 text-sm text-gray-600">
                Governance cap per user: {app.limits.governance_cap}
              </li>
            )}
          </ul>
        </div>
      )}

      {app.docs_url && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-3 mt-0 text-sm font-semibold text-gray-900">
            Documentation
          </h3>
          <a
            href={app.docs_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-emerald-700 no-underline transition-colors hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            View Documentation
          </a>
        </div>
      )}
    </div>
  );
}

function MiniAppListRail({
  currentAppId,
  miniapps,
}: {
  currentAppId: string;
  miniapps: MiniAppNavItem[];
}) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const categories = useMemo(
    () =>
      Array.from(new Set(miniapps.map((item) => item.category).filter(Boolean)))
        .sort()
        .slice(0, 6),
    [miniapps],
  );
  const filteredMiniapps = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return miniapps.filter((item) => {
      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;
      if (!matchesCategory) return false;
      if (!normalizedQuery) return true;
      return (
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.app_id.toLowerCase().includes(normalizedQuery) ||
        item.category.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [categoryFilter, miniapps, query]);
  const visibleMiniapps = filteredMiniapps.slice(0, 80);

  return (
    <aside
      className="order-2 self-start rounded-lg border border-gray-200 bg-white p-3 shadow-sm xl:order-none xl:sticky xl:top-24"
      aria-label="MiniApp list"
      data-testid="miniapp-list-rail"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-sm font-bold text-gray-900">MiniApps</h2>
          <p className="mt-1 text-xs text-gray-500">
            {filteredMiniapps.length} active surfaces
          </p>
        </div>
        <Link
          href="/miniapps"
          prefetch={false}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-neo/40 hover:text-neo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
        >
          Browse
        </Link>
      </div>

      <label className="relative mb-3 block">
        <span className="sr-only">Search MiniApps</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search miniapps"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-neo focus:bg-white focus:ring-2 focus:ring-neo/20"
        />
      </label>

      <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
        {["all", ...categories].map((category) => {
          const active = categoryFilter === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setCategoryFilter(category)}
              className={`shrink-0 cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 ${
                active
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-white text-gray-500 hover:text-gray-800"
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>

      <nav className="max-h-[calc(100vh-15rem)] space-y-1 overflow-y-auto pr-1">
        {visibleMiniapps.map((item) => {
          const selected = item.app_id === currentAppId;
          return (
            <Link
              key={item.app_id}
              href={`/miniapps/${item.app_id}`}
              prefetch={false}
              aria-current={selected ? "page" : undefined}
              className={`flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 ${
                selected
                  ? "border-neo/30 bg-neo/10 text-gray-900"
                  : "border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <MiniAppLogo
                appId={item.app_id}
                category={item.category}
                entryUrl={item.entry_url}
                logoUrl={item.logo_url}
                manifest={null}
                size="sm"
                className="shrink-0"
                alt={item.name}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {item.name}
                </span>
                <span className="mt-0.5 block truncate text-[11px] capitalize text-gray-500">
                  {item.category}
                </span>
              </span>
            </Link>
          );
        })}
        {visibleMiniapps.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-200 px-3 py-5 text-center text-xs text-gray-500">
            No MiniApps match this filter.
          </p>
        )}
      </nav>
    </aside>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase text-gray-400">
        {label}
      </div>
      <div className="mt-1 break-all font-mono text-[12px] text-gray-700">
        {value}
      </div>
    </div>
  );
}

function buildDetailTabs(
  templateTabs: MiniAppDetailTab[],
  showNews: boolean,
  showSecrets: boolean,
): ResolvedTab[] {
  const mappedTemplateTabs = templateTabs
    .map((tab) => ({
      id:
        String(tab.id || "")
          .trim()
          .toLowerCase() || slugifyTabLabel(tab.label || ""),
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
    defaults.push({
      id: "secrets",
      label: "Secrets",
      type: "secrets",
      blocks: [],
    });
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
      const source = value === "$wallet" ? walletAddress : value;
      const hash = source.startsWith("0x")
        ? source.toLowerCase()
        : addressToScriptHash(source);
      if (!/^0x[0-9a-f]{40}$/.test(hash)) {
        throw new Error(
          `${param.label || param.name} must be a Neo N3 address or 0x-prefixed Hash160.`,
        );
      }
      return { type: "Hash160", value: hash };
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

function toMiniAppNavItems(miniapps: MiniAppInfo[]): MiniAppNavItem[] {
  return miniapps.map((item) => ({
    app_id: item.app_id,
    name: item.name,
    category: item.category,
    entry_url: item.entry_url,
    logo_url: item.logo_url ?? null,
  }));
}

function findCatalogAppById(miniapps: MiniAppInfo[], appId: string): MiniAppInfo | null {
  const target = appId.trim().toLowerCase();
  if (!target) return null;
  return miniapps.find((item) => item.app_id.toLowerCase() === target) ?? null;
}

function withBundledAuthoritativeFields(
  remote: MiniAppInfo | null,
  bundled: MiniAppInfo | null,
): MiniAppInfo | null {
  if (!remote) return bundled;
  if (!bundled) return remote;
  return {
    ...remote,
    contract_hash: bundled.contract_hash ?? remote.contract_hash,
    entry_url: bundled.entry_url || remote.entry_url,
    permissions: bundled.permissions ?? remote.permissions,
    operations: bundled.operations ?? remote.operations,
    logo_url: bundled.logo_url ?? remote.logo_url,
    banner_url: bundled.banner_url ?? remote.banner_url,
    manifest: bundled.manifest ?? remote.manifest,
  };
}

// Server-Side Props
export const getServerSideProps: GetServerSideProps<
  AppDetailPageProps
> = async (context) => {
  const { id } = context.params as { id: string };
  const encodedId = encodeURIComponent(id);

  if (isArchivedMiniAppId(id)) {
    return { notFound: true };
  }

  const fallback = await loadBundledMiniAppById(id);
  const miniAppNav = await loadMiniAppCatalog("active").catch((e: unknown) => {
    console.warn(
      "[miniapps/id] miniapp navigation catalog failed:",
      e instanceof Error ? e.message : String(e),
    );
    return [];
  });
  const miniAppNavItems = toMiniAppNavItems(miniAppNav);

  try {
    const baseUrl = resolveInternalBaseUrl(
      context.req as RequestLike | undefined,
    );
    const catalogApp = withBundledAuthoritativeFields(
      findCatalogAppById(miniAppNav, id),
      fallback,
    );
    const notifRes = await fetchWithTimeout(
      `${baseUrl}/api/app/${encodedId}/news?limit=20`,
      {},
      2000,
    ).catch((e: unknown) => {
      console.warn(
        "[miniapps/id] news fetch failed:",
        e instanceof Error ? e.message : String(e),
      );
      return null;
    });

    const notifData = notifRes?.ok
      ? await notifRes.json().catch((e: unknown) => {
          console.warn(
            "[miniapps/id] failed to parse notifications JSON:",
            e instanceof Error ? e.message : String(e),
          );
          return { notifications: [] };
        })
      : { notifications: [] };
    const app = coerceMiniAppInfo(catalogApp, fallback ?? undefined);

    if (!app) {
      return { notFound: true };
    }

    const sharedRuntime = isSharedModeApp(app)
      ? await resolveSharedModeRuntime(app, "testnet").catch((e: unknown) => {
          console.warn(
            "[miniapps/id] shared runtime resolve failed:",
            e instanceof Error ? e.message : String(e),
          );
          return null;
        })
      : null;

    return {
      props: {
        app: sanitizeForJson(app),
        miniAppNav: sanitizeForJson(miniAppNavItems),
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
          miniAppNav: sanitizeForJson(miniAppNavItems),
          notifications: [],
          sharedRuntime: null,
          error:
            "Using fallback app metadata while live API data is unavailable",
        },
      };
    }
    return {
      props: {
        app: null,
        miniAppNav: sanitizeForJson(miniAppNavItems),
        notifications: [],
        sharedRuntime: null,
        error: "Failed to load app details",
      },
    };
  }
};
