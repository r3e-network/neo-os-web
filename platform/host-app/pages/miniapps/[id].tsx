import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { ChevronDown, ChevronUp, Wallet, X } from "lucide-react";
import { AppDetailHeader, OperationPanel } from "../../components";
import { MiniAppPlayfield } from "../../components/MiniAppPlayfield";
import type { OperationEntry } from "../../components/types";
import {
  getNativePlayAreaOperationFallback,
  resolvePlayAreaOperationNetworkDefaults,
} from "../../components/playarea/PlayAreaOperationFallbacks";
import {
  HOST_WALLET_BRIDGE_RESULT,
  type EmbeddedWalletBridgeResultDetail,
} from "../../components/playarea/PlayAreaShared";
import {
  MiniAppStatusBoard,
  OneGateLaunchCard,
} from "../../components/features/miniapp/MiniAppDetailSections";
import { AppNotFoundView } from "../../components/features/miniapp/AppNotFoundView";
import { DetailTabsSection } from "../../components/features/miniapp/DetailTabsSection";
import { SharedRuntimePanel } from "../../components/features/miniapp/SharedRuntimePanel";
import { TechnicalDetailsPanel } from "../../components/features/miniapp/TechnicalDetailsPanel";
import { NetworkSafetyBadge } from "../../components/features/miniapp/NetworkSafetyBadge";
import { LaunchParamsAppliedNotice } from "../../components/features/miniapp/LaunchParamsAppliedNotice";
import {
  ONEGATE_VAULT_APP_ID,
  ONEGATE_VAULT_DAPP_ID,
  buildDetailTabs,
  buildOneGateVaultLaunchUrl,
  isFrontendLocalOperation,
  isHostManagedApiOperation,
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

const DAILY_CHECKIN_APP_ID = "miniapp-dailycheckin";
const DAILY_CHECKIN_MEMO = "miniapp-dailycheckin:checkin";

function shortTxId(value: string) {
  return value.length > 18
    ? `${value.slice(0, 10)}...${value.slice(-8)}`
    : value;
}

function isEmbeddedSubmittedOperation(
  appId: string | undefined,
  operation: OperationEntry | null | undefined,
  result: EmbeddedWalletBridgeResultDetail | null,
) {
  if (!appId || !operation || !result) return false;
  if (result.appId !== appId) return false;
  return (
    appId === DAILY_CHECKIN_APP_ID &&
    operation.method === "checkIn" &&
    result.memo === DAILY_CHECKIN_MEMO &&
    Boolean(result.txid)
  );
}

export default function MiniAppDetailPage({
  app,
  initialTargetNetwork,
  miniAppNav: _miniAppNav,
  notifications,
  sharedRuntime,
  error,
}: AppDetailPageProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("workflow");
  const [invokeFeedback, setInvokeFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [mobileActionOpen, setMobileActionOpen] = useState(false);
  const [activeOperationKey, setActiveOperationKey] = useState("");
  const [embeddedWalletResult, setEmbeddedWalletResult] =
    useState<EmbeddedWalletBridgeResultDetail | null>(null);

  const walletConnected = useWalletStore((state) => state.connected);
  const walletAddress = useWalletStore((state) => state.address);
  const walletNetwork = useWalletStore((state) => state.network);
  const routerPath = typeof router.asPath === "string" ? router.asPath : "";
  const launchContext = useMemo(
    () => parseMiniAppLaunchContext(routerPath, app?.app_id),
    [app?.app_id, routerPath],
  );
  const targetNetwork =
    launchContext.network ?? initialTargetNetwork ?? getRpcNetwork();
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
  useEffect(() => {
    const handleEmbeddedWalletResult = (event: Event) => {
      const detail = (event as CustomEvent<EmbeddedWalletBridgeResultDetail>)
        .detail;
      if (!detail || detail.appId !== app?.app_id) return;
      if (detail.network !== targetNetwork) return;
      setEmbeddedWalletResult(detail);
      setInvokeFeedback({
        type: "success",
        message: detail.txid
          ? `Embedded workspace submitted transaction: ${detail.txid}`
          : "Embedded workspace submitted transaction.",
      });
    };

    window.addEventListener(
      HOST_WALLET_BRIDGE_RESULT,
      handleEmbeddedWalletResult,
    );
    return () =>
      window.removeEventListener(
        HOST_WALLET_BRIDGE_RESULT,
        handleEmbeddedWalletResult,
      );
  }, [app?.app_id, targetNetwork]);
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
    (operation: OperationEntry) => {
      if (isFrontendLocalOperation(operation.method)) return null;
      if (isHostManagedApiOperation(app?.app_id, operation.method)) {
        return networkAvailabilityReason;
      }
      if (
        embeddedWalletResult &&
        isEmbeddedSubmittedOperation(
          app?.app_id,
          operation,
          embeddedWalletResult,
        )
      ) {
        return `Already submitted from the embedded workspace: ${shortTxId(
          embeddedWalletResult.txid,
        )}. Refresh after confirmation before submitting again.`;
      }
      return operationDisabledReason;
    },
    [
      app?.app_id,
      embeddedWalletResult,
      networkAvailabilityReason,
      operationDisabledReason,
    ],
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
          ? getNativePlayAreaOperationFallback(app.app_id, targetNetwork)
          : [];
    const networkDefaultedOps = app?.app_id
      ? resolvePlayAreaOperationNetworkDefaults(
          app.app_id,
          targetNetwork,
          resolvedOps,
        )
      : resolvedOps;
    if (app?.app_id === "miniapp-custom-anchor") {
      return resolveCustomAnchorOperations(networkDefaultedOps, launchContext);
    }
    if (resolvedRuntime?.mode !== "platform") {
      return networkDefaultedOps;
    }
    return networkDefaultedOps.map((operation) =>
      injectRuntimeAppIdParam(operation, resolvedRuntime),
    );
  }, [
    app?.app_id,
    app?.detail_template?.operation_panel?.operations,
    app?.operations,
    launchContext,
    resolvedRuntime,
    targetNetwork,
  ]);
  const operationsAreLocalOnly =
    operations.length > 0 &&
    operations.every((operation) =>
      isFrontendLocalOperation(operation.method),
    );
  const activeOperation =
    operations.find(
      (operation) =>
        `${operation.method || ""}:${operation.name || ""}` ===
        activeOperationKey,
    ) ??
    operations[0] ??
    null;
  const activeOperationIsLocal =
    activeOperation && isFrontendLocalOperation(activeOperation.method);
  const operationsAreHostApiOnly =
    operations.length > 0 &&
    app?.app_id &&
    operations.every((operation) =>
      isHostManagedApiOperation(app.app_id, operation.method),
    );
  const activeOperationUsesHostApi =
    activeOperation &&
    isHostManagedApiOperation(app?.app_id, activeOperation.method);
  const actionConsoleUsesLocalContext =
    operationsAreLocalOnly || Boolean(activeOperationIsLocal);
  const actionConsoleUsesHostApi =
    Boolean(operationsAreHostApiOnly) || Boolean(activeOperationUsesHostApi);
  const actionConsoleRequiresWallet =
    !actionConsoleUsesLocalContext && !actionConsoleUsesHostApi;
  const handleActiveOperationChange = useCallback((operation: OperationEntry) => {
    setActiveOperationKey(`${operation.method || ""}:${operation.name || ""}`);
  }, []);
  const activeOperationSubmittedFromEmbed = isEmbeddedSubmittedOperation(
    app?.app_id,
    activeOperation,
    embeddedWalletResult,
  );
  const actionConsoleStatusLabel = actionConsoleUsesLocalContext
    ? "Workspace Preview"
    : actionConsoleUsesHostApi
      ? "API Ready"
      : activeOperationSubmittedFromEmbed
      ? "Synced"
      : walletConnected
      ? "Wallet Ready"
      : "Wallet Required";
  const actionConsoleStatusClass = actionConsoleUsesLocalContext
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : actionConsoleUsesHostApi
      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
      : activeOperationSubmittedFromEmbed
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : walletConnected
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-gray-200 bg-gray-50 text-gray-500";
  const actionConsoleWalletText = actionConsoleUsesLocalContext
    ? `No transaction is sent from this host button. It opens or updates the embedded workspace for ${targetNetworkLabel}; submit wallet actions inside the MiniApp.`
    : actionConsoleUsesHostApi
      ? `This action is handled by the platform API for ${targetNetworkLabel}. It checks sponsorship or submits the relay payload without opening a browser wallet prompt.`
      : activeOperationSubmittedFromEmbed && embeddedWalletResult?.txid
      ? `Embedded workspace submitted ${shortTxId(embeddedWalletResult.txid)}. Refresh after confirmation before submitting again.`
      : walletConnected && walletAddress
      ? walletAddress
      : "Connect wallet from the top navigation to submit on-chain transactions.";

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
      <AppNotFoundView
        message={error}
        onBack={() => router.push("/miniapps")}
      />
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
  const primaryOperationLabel =
    operations[0]?.method === "prepareMiniAppOperation"
      ? "Open workspace"
      : operations[0]?.name || operationTitle;
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

        <main className="mx-auto max-w-[1580px] px-3 py-2 sm:px-4 sm:py-3">
          <div
            className="miniapp-stable-scroll focus-mode-layout grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"
            data-testid="miniapp-detail-layout"
          >
            <section
              className="order-1 min-w-0 space-y-4 xl:order-none"
              aria-label="MiniApp workspace"
            >
              <section
                className="focus-mode-canvas relative z-10 w-full"
                aria-label="MiniApp play area"
                data-testid="miniapp-playarea"
              >
                <MiniAppPlayfield
                  app={app}
                  launchContext={launchContext}
                  targetNetwork={targetNetwork}
                />
              </section>

              <details className="focus-mode-reference group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm shadow-gray-950/5 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/40">
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-gray-950">
                      Reference and diagnostics
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-gray-600">
                      Open only when you need activity, docs, contract details, or raw app context.
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-3 space-y-3">
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

                  <DetailTabsSection
                    app={app}
                    tabs={tabs}
                    activeTabConfig={activeTabConfig}
                    onTabClick={handleDetailTabClick}
                    targetNetwork={targetNetwork}
                    liveNotifications={liveNotifications}
                    newsLoading={newsLoading}
                    showNews={showNews}
                    showSecrets={showSecrets}
                  />
                </div>
              </details>
            </section>

            <aside
              className="order-2 hidden self-start space-y-3 xl:order-none xl:sticky xl:top-24 xl:block"
              aria-label="MiniApp actions"
              data-testid="miniapp-actions"
            >
              <section className="focus-mode-action-panel overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-md shadow-gray-950/8 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-600">
                      Focus action
                    </p>
                    <h2 className="m-0 text-base font-bold text-gray-900 sm:text-lg">
                      {operationTitle}
                    </h2>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      actionConsoleStatusClass
                    }`}
                  >
                    {actionConsoleStatusLabel}
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
                    onActiveOperationChange={handleActiveOperationChange}
                    launchContext={launchContext}
                    showInvokeError={false}
                  />
                )}

                <OneGateLaunchCard
                  app={app}
                  oneGateLaunchUrl={oneGateLaunchUrl}
                  oneGateQrDataUrl={oneGateQrDataUrl}
                  targetNetworkLabel={targetNetworkLabel}
                />

                {launchContext.hasParams && !hasClaimOnlyServerPayout && (
                  <LaunchParamsAppliedNotice
                    launchContext={launchContext}
                    testId="launch-params-status"
                  />
                )}

                <div
                  className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
                  data-testid="action-console-wallet-status"
                >
                  <Wallet
                    className="h-4 w-4 text-gray-400"
                    aria-hidden="true"
                  />
                  <span
                    className={`min-w-0 flex-1 ${
                      !actionConsoleRequiresWallet
                        ? "break-words leading-5"
                        : "truncate"
                    }`}
                  >
                    {actionConsoleWalletText}
                  </span>
                </div>

                {actionConsoleRequiresWallet && (
                  <NetworkSafetyBadge
                    networkSafetyOk={networkSafetyOk}
                    targetNetworkLabel={targetNetworkLabel}
                    walletNetworkLabel={walletNetworkLabel}
                    testId="network-safety-status"
                  />
                )}

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

                {isSharedModeApp(app) && !app.contract_hash && (
                  <p className="mt-3 text-xs leading-5 text-gray-500">
                    This app is running in shared mode. Operations are resolved
                    through recipe bindings and shared module contracts instead
                    of a dedicated app contract.
                  </p>
                )}
              </section>

              {sharedRuntime && <SharedRuntimePanel runtime={sharedRuntime} />}

              <TechnicalDetailsPanel
                app={app}
                contractDisplayValue={contractDisplayValue}
                runtimeDisplayValue={runtimeDisplayValue}
                contractDomainBinding={contractDomainBinding}
              />
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
                      Focus action
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
                          Focus action
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
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                            actionConsoleStatusClass
                          }`}
                        >
                          {actionConsoleStatusLabel}
                        </span>
                        <button
                          type="button"
                          className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
                          onClick={() => setMobileActionOpen(false)}
                          aria-label="Close actions"
                        >
                          <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <OperationPanel
                      operations={operations}
                      onInvoke={handleInvoke}
                      showTitle={false}
                      className="border-0 shadow-none"
                      variant="embedded"
                      getDisabledReason={getOperationDisabledReason}
                      onActiveOperationChange={handleActiveOperationChange}
                      launchContext={launchContext}
                      showInvokeError={false}
                    />

                    <OneGateLaunchCard
                      app={app}
                      oneGateLaunchUrl={oneGateLaunchUrl}
                      oneGateQrDataUrl={oneGateQrDataUrl}
                      targetNetworkLabel={targetNetworkLabel}
                    />

                    {launchContext.hasParams && !hasClaimOnlyServerPayout && (
                      <LaunchParamsAppliedNotice
                        launchContext={launchContext}
                        className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800"
                      />
                    )}

                    <div
                      className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
                      data-testid="action-console-wallet-status"
                    >
                      <Wallet
                        className="h-4 w-4 text-gray-400"
                        aria-hidden="true"
                      />
                      <span
                        className={`min-w-0 flex-1 ${
                          !actionConsoleRequiresWallet
                            ? "break-words leading-5"
                            : "truncate"
                        }`}
                      >
                        {actionConsoleWalletText}
                      </span>
                    </div>

                    {actionConsoleRequiresWallet && (
                      <NetworkSafetyBadge
                        networkSafetyOk={networkSafetyOk}
                        targetNetworkLabel={targetNetworkLabel}
                        walletNetworkLabel={walletNetworkLabel}
                      />
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
