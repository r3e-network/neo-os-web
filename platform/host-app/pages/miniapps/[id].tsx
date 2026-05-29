import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { Activity, ChevronUp, ShieldCheck, Wallet, X } from "lucide-react";
import { AppDetailHeader, AppNewsList, OperationPanel } from "../../components";
import { MiniAppPlayfield } from "../../components/MiniAppPlayfield";
import type { OperationEntry } from "../../components/types";
import { getNativePlayAreaOperationFallback } from "../../components/playarea/PlayAreaRegistry";
import {
  MiniAppStatusBoard,
  OneGateLaunchCard,
  OverviewTab,
  contractDomainBadgeClass,
  formatContractDomainNetwork,
  formatContractDomainSource,
} from "../../components/features/miniapp/MiniAppDetailSections";
import {
  ONEGATE_VAULT_APP_ID,
  ONEGATE_VAULT_DAPP_ID,
  TAB_PANEL_CLASSNAME,
  buildDetailTabs,
  buildOneGateVaultLaunchUrl,
  isFrontendLocalOperation,
  isOneGateVaultPayoutOperation,
  oneGateNetworkParam,
  resolveCustomAnchorOperations,
  resolveDirectMiniAppSlug,
  resolveNetworkContractHash,
  resolveOneGateDappId,
  resolvePageCatalogNetwork,
  supportsPageCatalogNetwork,
  type AppDetailPageProps,
} from "../../lib/miniapp-detail-helpers";
import { Layout } from "../../components/layout";
import { BRAND } from "@/lib/brand";
import { useActivityFeed } from "../../hooks/useActivityFeed";
import { useMiniAppDetailInvoke } from "../../hooks/useMiniAppDetailInvoke";
import { useRealtimeNotifications } from "../../hooks/useRealtimeNotifications";
import { isSharedModeApp } from "../../lib/chain";
import { useWalletStore } from "../../lib/wallet/store";
import { getRpcNetwork } from "../../lib/rpc-helpers";
import {
  getWalletNetworkGuardReason,
  neoNetworkLabel,
} from "../../lib/neo-network";
import {
  injectRuntimeAppIdParam,
  resolveMiniAppContractDomain,
  resolveMiniAppRuntime,
} from "../../lib/miniapp-runtime";
import { parseMiniAppLaunchContext } from "../../lib/miniapp-launch-params";
import {
  buildOneGateDirectMiniAppUrl,
  buildOneGateLaunchUrl,
} from "../../../../apps/shared/utils/onegate-launch";

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

export default function MiniAppDetailPage({
  app,
  miniAppNav: _miniAppNav,
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
  const [mobileActionOpen, setMobileActionOpen] = useState(false);

  const walletConnected = useWalletStore((state) => state.connected);
  const walletAddress = useWalletStore((state) => state.address);
  const walletNetwork = useWalletStore((state) => state.network);
  const routerPath = typeof router.asPath === "string" ? router.asPath : "";
  const launchContext = useMemo(
    () => parseMiniAppLaunchContext(routerPath, app?.app_id),
    [app?.app_id, routerPath],
  );
  const targetNetwork = launchContext.network ?? getRpcNetwork();
  const targetNetworkLabel = neoNetworkLabel(targetNetwork);
  const targetCatalogNetwork = useMemo(
    () => resolvePageCatalogNetwork(targetNetwork),
    [targetNetwork],
  );
  const appSupportsTargetNetwork = app
    ? supportsPageCatalogNetwork(app, targetCatalogNetwork)
    : false;
  const walletNetworkLabel = walletNetwork
    ? neoNetworkLabel(walletNetwork)
    : "Not verified";
  const networkGuardReason = walletConnected
    ? getWalletNetworkGuardReason(walletNetwork, targetNetwork)
    : null;
  const networkAvailabilityReason = appSupportsTargetNetwork
    ? null
    : `${app?.name || "This MiniApp"} is not deployed or enabled on ${targetNetworkLabel}. Switch to a supported network before submitting transactions.`;
  const networkSafetyOk =
    walletConnected && !networkGuardReason && appSupportsTargetNetwork;
  const resolvedRuntime = useMemo(
    () => (app ? resolveMiniAppRuntime(app, targetNetwork) : null),
    [app, targetNetwork],
  );
  const directContractHash = useMemo(
    () => (app ? resolveNetworkContractHash(app, targetCatalogNetwork) : null),
    [app, targetCatalogNetwork],
  );
  const contractDomainBinding = useMemo(
    () =>
      app
        ? resolveMiniAppContractDomain(app, targetNetwork, resolvedRuntime)
        : null,
    [app, resolvedRuntime, targetNetwork],
  );
  const oneGateLaunchUrl = useMemo(() => {
    if (!app) return "";
    const oneGateDappId = resolveOneGateDappId(app);
    if (app.app_id === ONEGATE_VAULT_APP_ID) {
      return buildOneGateVaultLaunchUrl(
        oneGateDappId || ONEGATE_VAULT_DAPP_ID,
        launchContext.params,
        targetCatalogNetwork,
      );
    }
    const launchParams = {
      ...launchContext.params,
      ...(launchContext.operation
        ? { operation: launchContext.operation }
        : {}),
      network: oneGateNetworkParam(targetCatalogNetwork),
      ...(oneGateDappId
        ? { oneGateId: oneGateDappId, oneGateAppId: oneGateDappId }
        : {}),
    };
    if (oneGateDappId) {
      return buildOneGateLaunchUrl(app.app_id, launchParams, {
        dappId: oneGateDappId,
      });
    }
    const directSlug = resolveDirectMiniAppSlug(app);
    return directSlug
      ? buildOneGateDirectMiniAppUrl(directSlug, app.app_id, launchParams)
      : buildOneGateLaunchUrl(app.app_id, launchParams);
  }, [
    app,
    launchContext.operation,
    launchContext.params,
    targetCatalogNetwork,
  ]);
  const [oneGateQrDataUrl, setOneGateQrDataUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (!oneGateLaunchUrl) {
      setOneGateQrDataUrl("");
      return () => {
        cancelled = true;
      };
    }

    import("qrcode")
      .then((qrcode) =>
        qrcode.toDataURL(oneGateLaunchUrl, {
          errorCorrectionLevel: "H",
          margin: 1,
          width: 160,
          color: {
            dark: "#111827",
            light: "#ffffff",
          },
        }),
      )
      .then((dataUrl) => {
        if (!cancelled) setOneGateQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setOneGateQrDataUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [oneGateLaunchUrl]);
  useEffect(() => {
    if (!mobileActionOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileActionOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileActionOpen]);
  const runtimeDisabledReason =
    resolvedRuntime?.mode === "platform"
      ? resolvedRuntime.disabledReason
      : null;
  const walletRequiredReason = walletConnected
    ? null
    : "Connect wallet before sending transactions.";
  const operationDisabledReason =
    networkAvailabilityReason ||
    networkGuardReason ||
    runtimeDisabledReason ||
    walletRequiredReason;
  const getOperationDisabledReason = useCallback(
    (operation: OperationEntry) =>
      isFrontendLocalOperation(operation.method)
        ? null
        : operationDisabledReason,
    [operationDisabledReason],
  );

  const showNews = app?.news_integration !== false;
  const showSecrets = app?.permissions?.confidential === true;

  // App-specific activity feed (events + transactions poll, notifications via Realtime)
  const {
    activities: appActivities,
    loading: activityLoading,
    error: activityError,
    isConnected: activityConnected,
  } = useActivityFeed({
    appId: app?.app_id,
    network: targetNetwork,
    pollInterval: 5000,
    enabled: Boolean(app?.app_id),
  });

  // Realtime notifications for the news tab (replaces SSR-only notifications prop)
  const {
    notifications: realtimeNews,
    loading: newsLoading,
    isConnected: newsConnected,
  } = useRealtimeNotifications({
    appId: app?.app_id,
    network: targetNetwork,
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
    const sourceOps =
      Array.isArray(panelOps) && panelOps.length > 0
        ? panelOps
        : Array.isArray(app?.operations)
          ? app.operations
          : [];
    const resolvedOps =
      sourceOps.length > 0
        ? sourceOps
        : app?.app_id
          ? getNativePlayAreaOperationFallback(app.app_id)
          : [];
    if (app?.app_id === "miniapp-custom-anchor") {
      return resolveCustomAnchorOperations(resolvedOps, launchContext);
    }
    if (resolvedRuntime?.mode !== "platform") {
      return resolvedOps;
    }
    return resolvedOps.map((operation) =>
      injectRuntimeAppIdParam(operation, resolvedRuntime),
    );
  }, [
    app?.app_id,
    app?.detail_template?.operation_panel?.operations,
    app?.operations,
    launchContext,
    resolvedRuntime,
  ]);

  useEffect(() => {
    if (!tabs.length) return;
    if (launchContext.tab && tabs.some((tab) => tab.id === launchContext.tab)) {
      setActiveTab(launchContext.tab);
      return;
    }
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [activeTab, launchContext.tab, tabs]);

  const handleDetailTabClick = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  const handleInvoke = useMiniAppDetailInvoke({
    app,
    appSupportsTargetNetwork,
    directContractHash,
    launchContext,
    networkAvailabilityReason,
    resolvedRuntime,
    router,
    setInvokeFeedback,
    sharedRuntime,
    targetCatalogNetwork,
    targetNetwork,
    walletAddress,
    walletConnected,
    walletNetwork,
  });

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

  const operationPanel = app.detail_template?.operation_panel;
  const operationTitle =
    operationPanel?.title ||
    (app.detail_template?.layout === "prediction" ? "Trade" : "Operations");
  const operationSubtitle = operationPanel?.subtitle;
  const primaryOperationLabel = operations[0]?.name || operationTitle;
  const mobileActionVerb = /^claim\b/i.test(primaryOperationLabel)
    ? "Claim"
    : "Open";
  const hasClaimOnlyServerPayout = operations.some(
    isOneGateVaultPayoutOperation,
  );
  const contractDisplayValue = networkAvailabilityReason
    ? `Not deployed on ${targetNetworkLabel}`
    : resolvedRuntime?.mode === "platform"
      ? resolvedRuntime.contractHash ||
        "Platform runtime not deployed on this network"
      : directContractHash || "Shared / frontend runtime";
  const runtimeDisplayValue =
    resolvedRuntime?.mode === "platform"
      ? `${resolvedRuntime.platform || "Platform runtime"} / ${resolvedRuntime.registered ? "registered" : "not registered"}`
      : isSharedModeApp(app)
        ? "Shared module runtime"
        : "Integrated dApp runtime";
  const contractDomainDisplayValue = contractDomainBinding?.domain || null;

  return (
    <Layout hideFooter>
      <div className="min-h-screen bg-[#f7f8fb] pb-28 pt-16 text-gray-900 xl:pb-6">
        <Head>
          <title>{`${app.name} - ${BRAND.productName}`}</title>
        </Head>
        <AppDetailHeader app={app} onBack={handleBack} />

        <main className="mx-auto max-w-[1600px] px-3 py-2 sm:px-4 sm:py-3">
          <div
            className="miniapp-stable-scroll grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_340px]"
            data-testid="miniapp-detail-layout"
          >
            <section
              className="order-1 min-w-0 space-y-3 xl:order-none"
              aria-label="MiniApp workspace"
            >
              <section
                className="relative z-10 w-full"
                aria-label="MiniApp play area"
                data-testid="miniapp-playarea"
              >
                <MiniAppPlayfield app={app} launchContext={launchContext} />
              </section>

              <MiniAppStatusBoard
                app={app}
                activities={appActivities}
                activityConnected={activityConnected}
                activityError={activityError}
                activityLoading={activityLoading}
                contractDisplayValue={contractDisplayValue}
                contractDomainBinding={contractDomainBinding}
                contractDomainDisplayValue={contractDomainDisplayValue}
                liveNotifications={liveNotifications}
                networkLabel={targetNetworkLabel}
                newsConnected={newsConnected}
                newsLoading={newsLoading}
                runtimeDisplayValue={runtimeDisplayValue}
              />

              <section
                className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm shadow-gray-950/5 sm:p-4"
                data-testid="miniapp-detail-tabs"
              >
                <div
                  role="tablist"
                  className="mb-5 flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1"
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
                      className={`cursor-pointer rounded-xl bg-transparent px-3 py-2 text-sm font-semibold ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 sm:px-4 ${
                        activeTabConfig?.id === tab.id
                          ? "bg-white text-emerald-700 ring-gray-200"
                          : "text-gray-500 ring-transparent hover:bg-white/70 hover:text-gray-900"
                      }`}
                      onClick={() => handleDetailTabClick(tab.id)}
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
                    className={TAB_PANEL_CLASSNAME}
                  >
                    <OverviewTab app={app} blocks={activeTabConfig.blocks} />
                  </div>
                )}

                {activeTabConfig?.type === "reviews" && (
                  <div
                    id={`tabpanel-${activeTabConfig.id}`}
                    role="tabpanel"
                    aria-labelledby={`tab-${activeTabConfig.id}`}
                    className={TAB_PANEL_CLASSNAME}
                  >
                    <ReviewsTab appId={app.app_id} network={targetNetwork} />
                  </div>
                )}

                {activeTabConfig?.type === "forum" && (
                  <div
                    id={`tabpanel-${activeTabConfig.id}`}
                    role="tabpanel"
                    aria-labelledby={`tab-${activeTabConfig.id}`}
                    className={TAB_PANEL_CLASSNAME}
                  >
                    <ForumTab appId={app.app_id} network={targetNetwork} />
                  </div>
                )}

                {activeTabConfig?.type === "news" && (
                  <div
                    id={`tabpanel-${activeTabConfig.id}`}
                    role="tabpanel"
                    aria-labelledby={`tab-${activeTabConfig.id}`}
                    className={TAB_PANEL_CLASSNAME}
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
                    className={TAB_PANEL_CLASSNAME}
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
              className="order-2 hidden self-start space-y-3 xl:order-none xl:sticky xl:top-24 xl:block"
              aria-label="MiniApp actions"
              data-testid="miniapp-actions"
            >
              <section className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-md shadow-gray-950/8 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-600">
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

                {operations.length > 0 && (
                  <OperationPanel
                    operations={operations}
                    onInvoke={handleInvoke}
                    showTitle={false}
                    className="mt-3 border-0 shadow-none"
                    variant="embedded"
                    getDisabledReason={getOperationDisabledReason}
                    launchContext={launchContext}
                  />
                )}

                <OneGateLaunchCard
                  app={app}
                  oneGateLaunchUrl={oneGateLaunchUrl}
                  oneGateQrDataUrl={oneGateQrDataUrl}
                  targetNetworkLabel={targetNetworkLabel}
                />

                {launchContext.hasParams && !hasClaimOnlyServerPayout && (
                  <div
                    className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800"
                    data-testid="launch-params-status"
                  >
                    <p className="m-0 font-semibold">
                      Launch parameters applied
                    </p>
                    <p className="m-0 break-words">
                      Source: {launchContext.source}
                      {launchContext.operation
                        ? ` · Operation: ${launchContext.operation}`
                        : ""}
                      {launchContext.keys.length > 0
                        ? ` · Fields: ${launchContext.keys.join(", ")}`
                        : ""}
                    </p>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <Wallet
                    className="h-4 w-4 text-gray-400"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {walletConnected && walletAddress
                      ? walletAddress
                      : "Connect wallet from the top navigation to submit on-chain transactions."}
                  </span>
                </div>

                <div
                  className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                    networkSafetyOk
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                  data-testid="network-safety-status"
                >
                  <div className="flex items-start gap-2">
                    <ShieldCheck
                      className="mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="m-0 font-semibold">
                        Target: {targetNetworkLabel}
                      </p>
                      <p className="m-0 break-words">
                        Wallet: {walletNetworkLabel}
                      </p>
                    </div>
                  </div>
                </div>

                {networkAvailabilityReason && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                    {networkAvailabilityReason}
                  </div>
                )}

                {invokeFeedback && (
                  <div
                    className={`mt-3 rounded-xl border px-3 py-2 text-xs break-words ${
                      invokeFeedback.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {invokeFeedback.message}
                  </div>
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
                    <Activity
                      className="h-4 w-4 text-emerald-600"
                      aria-hidden="true"
                    />
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

              <details className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50">
                  <ShieldCheck
                    className="h-4 w-4 text-emerald-600"
                    aria-hidden="true"
                  />
                  Technical details
                </summary>
                <div className="mt-3 space-y-2">
                  <p className="my-0 text-xs text-gray-500">
                    Application ID:{" "}
                    <code className="break-all rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700">
                      {app.app_id}
                    </code>
                  </p>
                  <p className="my-0 text-xs text-gray-500">
                    Contract Hash:{" "}
                    <code className="break-all rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700">
                      {contractDisplayValue}
                    </code>
                  </p>
                  <p className="my-0 text-xs text-gray-500">
                    Runtime:{" "}
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700">
                      {runtimeDisplayValue}
                    </span>
                  </p>
                  {contractDomainBinding && (
                    <p
                      className="my-0 text-xs text-gray-500"
                      data-testid="contract-domain-binding-technical"
                    >
                      {formatContractDomainNetwork(
                        contractDomainBinding.network,
                      )}{" "}
                      Domain:{" "}
                      <code className="break-all rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700">
                        {contractDomainBinding.domain}
                      </code>{" "}
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${contractDomainBadgeClass(contractDomainBinding.source)}`}
                      >
                        {formatContractDomainSource(
                          contractDomainBinding.source,
                        )}
                      </span>
                    </p>
                  )}
                  {app.docs_url && (
                    <p className="my-0 text-xs text-gray-500">
                      Docs URL:{" "}
                      <code className="break-all rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700">
                        {app.docs_url}
                      </code>
                    </p>
                  )}
                </div>
              </details>
            </aside>
          </div>

          {operations.length > 0 && (
            <>
              <div
                className="mobile-action-dock-shell fixed inset-x-0 bottom-0 z-[70] border-t border-gray-200 bg-white px-3 py-2.5 shadow-sm xl:hidden"
                data-testid="mobile-action-dock"
              >
                <button
                  type="button"
                  className="mobile-action-button mx-auto flex min-h-12 w-full max-w-[520px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-emerald-600 bg-emerald-700 px-3.5 py-2 text-left text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 focus-visible:ring-offset-2"
                  onClick={() => setMobileActionOpen(true)}
                  aria-expanded={mobileActionOpen}
                  aria-controls="mobile-action-sheet"
                  data-testid="mobile-action-open"
                >
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-white">
                      Action Console
                    </span>
                    <span className="block truncate text-sm font-bold">
                      {primaryOperationLabel}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-900">
                    {mobileActionVerb}
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
              </div>

              {mobileActionOpen && (
                <div
                  id="mobile-action-sheet"
                  className="fixed inset-0 z-[80] xl:hidden"
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${app.name} actions`}
                  data-testid="mobile-action-sheet"
                >
                  <button
                    type="button"
                    className="absolute inset-0 cursor-default bg-gray-950/40"
                    aria-label="Close actions"
                    onClick={() => setMobileActionOpen(false)}
                  />
                  <section className="mobile-action-sheet-shell absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-xl border border-gray-200 bg-white p-3 shadow-md shadow-gray-950/10 sm:p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-600">
                          Action Console
                        </p>
                        <h2 className="m-0 truncate text-lg font-bold text-gray-900">
                          {operationTitle}
                        </h2>
                        {operationSubtitle && (
                          <p className="mt-1 text-xs leading-5 text-gray-500">
                            {operationSubtitle}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
                        onClick={() => setMobileActionOpen(false)}
                        aria-label="Close actions"
                      >
                        <X className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>

                    <OperationPanel
                      operations={operations}
                      onInvoke={handleInvoke}
                      showTitle={false}
                      className="border-0 shadow-none"
                      variant="embedded"
                      getDisabledReason={getOperationDisabledReason}
                      launchContext={launchContext}
                    />

                    <OneGateLaunchCard
                      app={app}
                      oneGateLaunchUrl={oneGateLaunchUrl}
                      oneGateQrDataUrl={oneGateQrDataUrl}
                      targetNetworkLabel={targetNetworkLabel}
                    />

                    {launchContext.hasParams && !hasClaimOnlyServerPayout && (
                      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
                        <p className="m-0 font-semibold">
                          Launch parameters applied
                        </p>
                        <p className="m-0 break-words">
                          Source: {launchContext.source}
                          {launchContext.operation
                            ? ` · Operation: ${launchContext.operation}`
                            : ""}
                          {launchContext.keys.length > 0
                            ? ` · Fields: ${launchContext.keys.join(", ")}`
                            : ""}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                      <Wallet
                        className="h-4 w-4 text-gray-400"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {walletConnected && walletAddress
                          ? walletAddress
                          : "Connect wallet from the top navigation to submit on-chain transactions."}
                      </span>
                    </div>

                    <div
                      className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                        networkSafetyOk
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <ShieldCheck
                          className="mt-0.5 h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="m-0 font-semibold">
                            Target: {targetNetworkLabel}
                          </p>
                          <p className="m-0 break-words">
                            Wallet: {walletNetworkLabel}
                          </p>
                        </div>
                      </div>
                    </div>

                    {invokeFeedback && (
                      <div
                        className={`mt-3 rounded-xl border px-3 py-2 text-xs break-words ${
                          invokeFeedback.type === "success"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        }`}
                      >
                        {invokeFeedback.message}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </Layout>
  );
}

export { getMiniAppDetailServerSideProps as getServerSideProps } from "../../lib/miniapp-detail-server";
