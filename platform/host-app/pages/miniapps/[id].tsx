import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import {
  Activity,
  Bell,
  ChevronUp,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Info,
  QrCode,
  Search,
  ShieldCheck,
  Wallet,
  X,
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
import { getNativePlayAreaOperationFallback } from "../../components/playarea/PlayAreaRegistry";
import type {
  MiniAppLaunchContext,
  OnChainActivity,
  OperationEntry,
  OperationParam,
} from "../../components/types";
import { DetailContentBlocks } from "../../components/features/miniapp/DetailContentBlocks";
import { Layout } from "../../components/layout";
import { BRAND } from "@/lib/brand";

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
import {
  type CatalogNetwork,
  loadMiniAppCatalog,
  resolveCatalogNetwork,
  supportsCatalogNetwork,
} from "../../lib/miniapp-catalog";
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
import { getRpcNetwork } from "../../lib/rpc-helpers";
import {
  assertWalletNetworkMatchesTarget,
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
  buildCustomAnchorRegistrationPlan,
  parseAnchorCandidateKeys,
} from "../../lib/custom-anchor";
import {
  buildOneGateDirectMiniAppUrl,
  buildOneGateLaunchUrl,
} from "../../../../apps/shared/utils/onegate-launch";
import {
  BLOCKCHAIN_CONSTANTS,
  EXTERNAL_INTEGRATIONS,
} from "../../../../apps/shared/constants";

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

const MINIAPP_DETAIL_ROUTE_ALIASES: Record<string, string> = {
  "miniapp-onegate-vault": "miniapp-gas-lucky-pool",
  "onegate-vault": "miniapp-gas-lucky-pool",
};

const ONEGATE_QR_LOGO_SRC = "/miniapps/gas-lucky-pool/onegate-logo.png";
const TAB_PANEL_CLASSNAME =
  "min-h-[38rem] [overflow-anchor:none] [contain:layout]";

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
    const launchParams = {
      ...launchContext.params,
      ...(launchContext.operation
        ? { operation: launchContext.operation }
        : {}),
      network: oneGateNetworkParam(targetCatalogNetwork),
    };
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
  const operationDisabledReason =
    networkAvailabilityReason || networkGuardReason || runtimeDisabledReason;

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
    const tabsEl =
      typeof document === "undefined"
        ? null
        : document.querySelector('[data-testid="miniapp-detail-tabs"]');
    const beforeTop = tabsEl?.getBoundingClientRect().top;

    setActiveTab(tabId);

    if (typeof beforeTop !== "number") return;
    const restoreTabPosition = () => {
      const afterTop = tabsEl?.getBoundingClientRect().top;
      if (typeof afterTop !== "number") return;
      const delta = afterTop - beforeTop;
      if (Math.abs(delta) > 1) {
        window.scrollBy({ top: delta, left: 0, behavior: "auto" });
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(restoreTabPosition));
    window.setTimeout(restoreTabPosition, 120);
  }, []);

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
        if (isFrontendLocalOperation(operation.method)) {
          const query = buildFrontendOperationQuery(
            router.query,
            operation.method,
            values,
            targetCatalogNetwork,
          );
          await router.replace(
            { pathname: router.pathname, query },
            undefined,
            { shallow: true },
          );
          setInvokeFeedback({
            type: "success",
            message: frontendOperationFeedback(operation.method),
          });
          return;
        }

        if (!walletConnected || !walletAddress) {
          throw new Error("Connect wallet before sending transactions.");
        }
        assertWalletNetworkMatchesTarget(walletNetwork, targetNetwork);
        if (!appSupportsTargetNetwork) {
          throw new Error(
            networkAvailabilityReason ||
              "MiniApp is not enabled on the selected network.",
          );
        }

        if (operation.method === "claimOneGateVault") {
          const claimKey = String(values.claimKey || values.key || "").trim();
          if (!claimKey) throw new Error("Claim key is required.");
          const poolId = String(
            values.poolId || values.pool || values.campaignId || "",
          ).trim();
          const oneGateAppId = String(
            values.oneGateAppId || values.oneGateId || values.onegateAppId || "",
          ).trim();
          const miniappId = String(values.appId || app.app_id).trim();
          const response = await fetch("/api/onegate-vault/claim", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              claimKey,
              address: walletAddress,
              network: targetNetwork,
              poolId: poolId || undefined,
              oneGateAppId: oneGateAppId || undefined,
              appId: miniappId || undefined,
            }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            const message =
              typeof body?.error?.message === "string"
                ? body.error.message
                : "OneGate Vault claim failed.";
            throw new Error(message);
          }
          const txid = String(body.txHash || body.tx_hash || "");
          const amount = String(body.amount || "");
          const luckPercent = String(body.luckPercent || "");
          setInvokeFeedback({
            type: "success",
            message:
              amount && txid
                ? `Reward paid: ${amount} GAS${luckPercent ? ` · luck beat ${luckPercent}%` : ""} (${txid})`
                : "Reward claim submitted.",
          });
          return;
        }

        if (operation.method === "fundGameCredit") {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "Game contract is not configured for this network.",
            );
          }
          const amountText = String(values.amount || "").trim();
          if (!/^\d+(?:\.\d+)?$/.test(amountText) || Number(amountText) <= 0) {
            throw new Error("Funding amount must be a positive GAS value.");
          }
          const amount = parseScaledDecimal(amountText, 8, "Funding amount");
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          const result = await adapter.invoke({
            scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
            operation: "transfer",
            args: [
              { type: "Hash160", value: walletAddress },
              { type: "Hash160", value: targetHash },
              { type: "Integer", value: amount },
              { type: "String", value: `${app.app_id}:credit` },
            ],
            signers: [{ account: walletAddress, scopes: 1 }],
          });
          setInvokeFeedback({
            type: "success",
            message: `Game credit funded: ${result.txid}`,
          });
          return;
        }

        if (operation.method === "registerCustomAnchor") {
          if (!resolvedRuntime?.contractHash) {
            throw new Error(
              "PlatformAnchor contract is not configured for this network.",
            );
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          if (typeof adapter.invokeMultiple !== "function") {
            throw new Error(
              "This wallet cannot submit the required NEP-21 batch transaction. Open in OneGate or another NEP-21 wallet.",
            );
          }
          const aaCoreHash = EXTERNAL_INTEGRATIONS[targetNetwork].contracts.aaCore;
          const candidateKeys = parseAnchorCandidateKeys(values.candidates || "");
          const plan = buildCustomAnchorRegistrationPlan({
            anchorContractHash: resolvedRuntime.contractHash,
            aaCoreHash,
            ownerAddress: walletAddress,
            slug: values.slug || "",
            nonce: values.nonce || "",
            mode: values.mode || "trust",
            candidateKeys,
          });
          const result = await adapter.invokeMultiple(plan.invocations, [
            { account: walletAddress, scopes: 1 },
          ]);
          setInvokeFeedback({
            type: "success",
            message: `Custom Anchor registered: ${plan.appId} (${result.txid})`,
          });
          return;
        }

        const anchorOperationAppId = resolveAnchorOperationAppId(
          app.app_id,
          values,
          launchContext,
        );

        if (
          operation.method === "stakeNeo" &&
          anchorOperationAppId
        ) {
          if (!resolvedRuntime?.contractHash) {
            throw new Error(
              "PlatformAnchor contract is not configured for this network.",
            );
          }
          const amount = String(values.amount || "").trim();
          if (!/^[1-9]\d*$/.test(amount)) {
            throw new Error("NEO amount must be a positive whole number.");
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          const result = await adapter.invoke({
            scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH,
            operation: "transfer",
            args: [
              { type: "Hash160", value: walletAddress },
              { type: "Hash160", value: resolvedRuntime.contractHash },
              { type: "Integer", value: amount },
              { type: "String", value: anchorOperationAppId },
            ],
            signers: [{ account: walletAddress, scopes: 1 }],
          });
          setInvokeFeedback({
            type: "success",
            message: `Stake transaction submitted: ${result.txid}`,
          });
          return;
        }

        if (
          operation.method === "withdrawNeo" &&
          anchorOperationAppId
        ) {
          if (!resolvedRuntime?.contractHash) {
            throw new Error(
              "PlatformAnchor contract is not configured for this network.",
            );
          }
          const amount = String(values.amount || "").trim();
          if (!/^[1-9]\d*$/.test(amount)) {
            throw new Error("NEO amount must be a positive whole number.");
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          const result = await adapter.invoke({
            scriptHash: resolvedRuntime.contractHash,
            operation: "withdraw",
            args: [
              { type: "String", value: anchorOperationAppId },
              { type: "Hash160", value: walletAddress },
              { type: "Integer", value: amount },
            ],
            signers: [{ account: walletAddress, scopes: 1 }],
          });
          setInvokeFeedback({
            type: "success",
            message: `Redeem transaction submitted: ${result.txid}`,
          });
          return;
        }

        if (
          operation.method === "claimRewards" &&
          anchorOperationAppId
        ) {
          if (!resolvedRuntime?.contractHash) {
            throw new Error(
              "PlatformAnchor contract is not configured for this network.",
            );
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          const result = await adapter.invoke({
            scriptHash: resolvedRuntime.contractHash,
            operation: "claimRewards",
            args: [
              { type: "String", value: anchorOperationAppId },
              { type: "Hash160", value: walletAddress },
            ],
            signers: [{ account: walletAddress, scopes: 1 }],
          });
          setInvokeFeedback({
            type: "success",
            message: `Claim transaction submitted: ${result.txid}`,
          });
          return;
        }

        let txid: string;
        if (resolvedRuntime?.mode === "platform") {
          if (!resolvedRuntime.writesEnabled || !resolvedRuntime.contractHash) {
            throw new Error(
              resolvedRuntime.disabledReason ||
                "Platform runtime is not available on the selected network.",
            );
          }

          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }

          const args = buildInvokeArgs(
            operation.params ?? [],
            values,
            walletAddress,
          );
          const invokePayload: InvokeParams = {
            scriptHash: resolvedRuntime.contractHash,
            operation: operation.method,
            args,
          };
          invokePayload.signers = [{ account: walletAddress, scopes: 1 }];
          const result = await adapter.invoke(invokePayload);
          txid = result.txid;
        } else if (sharedRuntime && isSharedModeApp(app)) {
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
          if (!directContractHash) {
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
              scriptHash: directContractHash,
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
    [
      app,
      appSupportsTargetNetwork,
      directContractHash,
      networkAvailabilityReason,
      resolvedRuntime,
      router,
      sharedRuntime,
      targetCatalogNetwork,
      targetNetwork,
      walletAddress,
      walletConnected,
      walletNetwork,
    ],
  );

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
    (operation) => operation.method === "claimOneGateVault",
  );
  const operationPanelDisabledReason = operations.every((operation) =>
    isFrontendLocalOperation(operation.method),
  )
    ? null
    : operationDisabledReason;
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
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f4f8f6_48%,#f8fafc_100%)] pb-28 pt-16 text-gray-900 xl:pb-10">
        <Head>
          <title>{`${app.name} - ${BRAND.productName}`}</title>
        </Head>
        <AppDetailHeader app={app} onBack={handleBack} />

        <main className="mx-auto max-w-[1600px] px-3 py-5 sm:px-5">
          <div
            className="miniapp-stable-scroll grid grid-cols-1 items-start gap-5 xl:grid-cols-[248px_minmax(0,1fr)_360px]"
            data-testid="miniapp-detail-layout"
          >
            <MiniAppListRail currentAppId={app.app_id} miniapps={miniAppNav} />

            <section
              className="order-1 min-w-0 space-y-5 xl:order-none"
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
                className="rounded-[24px] border border-gray-200 bg-white p-3 shadow-sm shadow-gray-950/5 sm:p-4"
                data-testid="miniapp-detail-tabs"
              >
                <div
                  role="tablist"
                  className="mb-5 flex flex-wrap gap-1 rounded-2xl border border-gray-200 bg-gray-100 p-1"
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
              <section className="overflow-hidden rounded-[26px] border border-gray-200 bg-white p-4 shadow-xl shadow-gray-950/8 sm:p-5">
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

                {operations.length > 0 && (
                  <OperationPanel
                    operations={operations}
                    onInvoke={handleInvoke}
                    showTitle={false}
                    className="mt-3 border-0 shadow-none"
                    variant="embedded"
                    disabledReason={operationPanelDisabledReason}
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

                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
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
                  className={`mt-3 rounded-2xl border px-3 py-2 text-xs ${
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
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                    {networkAvailabilityReason}
                  </div>
                )}

                {invokeFeedback && (
                  <div
                    className={`mt-3 rounded-2xl border px-3 py-2 text-xs break-words ${
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
                className="fixed inset-x-0 bottom-0 z-[70] border-t border-gray-200 bg-white/95 px-3 py-2.5 shadow-[0_-16px_40px_rgba(15,23,42,0.12)] backdrop-blur xl:hidden"
                data-testid="mobile-action-dock"
              >
                <button
                  type="button"
                  className="mx-auto flex min-h-[46px] w-full max-w-[520px] cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-emerald-200 bg-emerald-600 px-3.5 py-2 text-left text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                  onClick={() => setMobileActionOpen(true)}
                  aria-expanded={mobileActionOpen}
                  aria-controls="mobile-action-sheet"
                  data-testid="mobile-action-open"
                >
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-emerald-100">
                      Action Console
                    </span>
                    <span className="block truncate text-sm font-bold">
                      {primaryOperationLabel}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
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
                  <section className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-[24px] border border-gray-200 bg-white p-3 shadow-2xl shadow-gray-950/30 sm:p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
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
                      disabledReason={operationPanelDisabledReason}
                      launchContext={launchContext}
                    />

                    <OneGateLaunchCard
                      app={app}
                      oneGateLaunchUrl={oneGateLaunchUrl}
                      oneGateQrDataUrl={oneGateQrDataUrl}
                      targetNetworkLabel={targetNetworkLabel}
                    />

                    {launchContext.hasParams && !hasClaimOnlyServerPayout && (
                      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
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

                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
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
                      className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
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
                        className={`mt-3 rounded-lg border px-3 py-2 text-xs break-words ${
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

function OneGateLaunchCard({
  app,
  oneGateLaunchUrl,
  oneGateQrDataUrl,
  targetNetworkLabel,
}: {
  app: MiniAppInfo;
  oneGateLaunchUrl: string;
  oneGateQrDataUrl: string;
  targetNetworkLabel: string;
}) {
  return (
    <div
      className="mt-3 rounded-[16px] border border-gray-200 bg-gray-50/80 px-3 py-3 text-xs leading-5 text-gray-600"
      data-testid="onegate-launch-card"
    >
      <div className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
        <QrCode className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        OneGate QR
      </div>
      <div className="flex items-start gap-3">
        <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-sm shadow-gray-950/5">
          {oneGateQrDataUrl ? (
            <img
              src={oneGateQrDataUrl}
              alt={`${app.name} OneGate QR`}
              className="h-full w-full"
              loading="lazy"
              decoding="async"
              data-testid="onegate-launch-qr"
            />
          ) : (
            <QrCode className="h-8 w-8 text-gray-300" aria-hidden="true" />
          )}
          <img
            src={ONEGATE_QR_LOGO_SRC}
            alt="OneGate"
            className="pointer-events-none absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-1.5 shadow-sm"
            loading="lazy"
            decoding="async"
            data-testid="onegate-qr-logo"
          />
        </div>
        <div className="min-w-0 text-xs leading-5 text-gray-500">
          <p className="m-0 font-semibold text-gray-700">
            {targetNetworkLabel}
          </p>
          <p className="m-0 break-words font-mono text-[11px]">{app.app_id}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] font-semibold text-emerald-700">
              Open link
            </summary>
            <a
              href={oneGateLaunchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block break-all font-mono text-[11px] text-emerald-700 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
              data-testid="onegate-launch-url"
            >
              {oneGateLaunchUrl}
            </a>
          </details>
        </div>
      </div>
    </div>
  );
}

function MiniAppStatusBoard({
  app,
  activities,
  activityConnected,
  activityError,
  activityLoading,
  contractDisplayValue,
  contractDomainBinding,
  contractDomainDisplayValue,
  liveNotifications,
  networkLabel,
  newsConnected,
  newsLoading,
  runtimeDisplayValue,
}: {
  app: MiniAppInfo;
  activities: OnChainActivity[];
  activityConnected: boolean;
  activityError: string | null;
  activityLoading: boolean;
  contractDisplayValue: string;
  contractDomainBinding: ReturnType<typeof resolveMiniAppContractDomain> | null;
  contractDomainDisplayValue: string | null;
  liveNotifications: MiniAppNotification[];
  networkLabel: string;
  newsConnected: boolean;
  newsLoading: boolean;
  runtimeDisplayValue: string;
}) {
  const recentActivities = activities.slice(0, 4);
  const recentNotifications = liveNotifications.slice(0, 3);
  const status = app.status || "active";

  return (
    <section
      className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm shadow-gray-950/5"
      aria-label="MiniApp status and updates"
      data-testid="miniapp-info"
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {app.detail_template?.hero?.eyebrow && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase text-emerald-700">
                {app.detail_template.hero.eyebrow}
              </span>
            )}
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${statusBadgeClass(status)}`}
            >
              {status}
            </span>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold uppercase text-gray-600">
              {app.category}
            </span>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
              {networkLabel}
            </span>
          </div>

          <h2 className="mt-4 flex items-center gap-2 text-base font-bold text-gray-900">
            <Info className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            What this MiniApp does
          </h2>
          <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-gray-600">
            {app.description}
          </p>
          {app.detail_template?.hero?.disclaimer && (
            <p className="mt-2 break-words text-xs leading-5 text-gray-500">
              {app.detail_template.hero.disclaimer}
            </p>
          )}

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <InfoPill label="App ID" value={app.app_id} />
            <InfoPill label="Runtime" value={runtimeDisplayValue} />
            <InfoPill label="Contract" value={contractDisplayValue} />
            {contractDomainDisplayValue ? (
              <InfoPill
                label={`${contractDomainBinding ? formatContractDomainNetwork(contractDomainBinding.network) : ""} Domain`.trim()}
                value={contractDomainDisplayValue}
                testId="contract-domain-binding"
              />
            ) : (
              <InfoPill
                label="Domain"
                value="Not configured for this network"
              />
            )}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs leading-5 text-emerald-800">
            <ShieldCheck
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <p className="m-0">
              Events, notifications, and actions on this page are scoped to{" "}
              {networkLabel}. Testnet and mainnet records are queried
              separately.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100 bg-gray-50/70 p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="m-0 flex items-center gap-2 text-sm font-bold text-gray-900">
              <Activity
                className="h-4 w-4 text-emerald-600"
                aria-hidden="true"
              />
              Activity and notices
            </h2>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                activityConnected || newsConnected
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-white text-gray-500"
              }`}
            >
              {activityConnected || newsConnected ? "Live" : "Synced"}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {activityLoading && recentActivities.length === 0 ? (
              <StatusEmptyState label="Loading verified activity..." />
            ) : recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <CompactActivityRow key={activity.id} activity={activity} />
              ))
            ) : (
              <StatusEmptyState label="No verified activity yet." />
            )}
            {activityError && (
              <p className="m-0 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                Activity feed is temporarily unavailable. The page remains
                usable.
              </p>
            )}
          </div>

          <div className="mt-5 border-t border-gray-200 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="m-0 flex items-center gap-2 text-xs font-bold uppercase text-gray-500">
                <Bell className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Notices
              </h3>
              {newsLoading && (
                <span className="text-[11px] font-semibold text-gray-400">
                  Loading
                </span>
              )}
            </div>
            <div className="space-y-2">
              {recentNotifications.length > 0 ? (
                recentNotifications.map((notification) => (
                  <CompactNotificationRow
                    key={notification.id}
                    notification={notification}
                  />
                ))
              ) : (
                <StatusEmptyState label="No notices published for this MiniApp." />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CompactActivityRow({ activity }: { activity: OnChainActivity }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 truncate text-sm font-semibold text-gray-900">
            {activity.title}
          </p>
          <p className="m-0 mt-1 truncate text-xs text-gray-500">
            {activity.description}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-gray-400">
          {formatRelativeTime(activity.timestamp)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {activity.status && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${activityStatusClass(activity.status)}`}
          >
            {activity.status}
          </span>
        )}
        {activity.network && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
            {activity.network}
          </span>
        )}
        {activity.tx_hash && (
          <span className="truncate font-mono text-[11px] text-gray-500">
            {truncateMiddle(activity.tx_hash, 8, 6)}
          </span>
        )}
      </div>
    </div>
  );
}

function CompactNotificationRow({
  notification,
}: {
  notification: MiniAppNotification;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
      <div className="flex items-start gap-2">
        <CheckCircle2
          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="m-0 truncate text-sm font-semibold text-gray-900">
              {notification.title}
            </p>
            <span className="shrink-0 text-[11px] text-gray-400">
              {formatRelativeTime(notification.created_at)}
            </span>
          </div>
          <p className="m-0 mt-1 line-clamp-2 text-xs leading-5 text-gray-500">
            {notification.content}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
              {notification.notification_type || "notice"}
            </span>
            {notification.network && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                {notification.network}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusEmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-white px-3 py-3 text-xs text-gray-500">
      <Clock3 className="h-4 w-4 text-gray-400" aria-hidden="true" />
      {label}
    </div>
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
  const deferredQuery = useDeferredValue(query);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const categories = useMemo(
    () =>
      Array.from(new Set(miniapps.map((item) => item.category).filter(Boolean)))
        .sort()
        .slice(0, 6),
    [miniapps],
  );
  const filteredMiniapps = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
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
  }, [categoryFilter, miniapps, deferredQuery]);
  const visibleMiniapps = filteredMiniapps.slice(0, 80);

  return (
    <aside
      className="hidden self-start rounded-lg border border-gray-200 bg-white p-3 shadow-sm xl:order-none xl:sticky xl:top-24 xl:block"
      aria-label="MiniApp list"
      data-testid="miniapp-list-rail"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-sm font-bold text-gray-900">MiniApps</h2>
          <p className="mt-1 text-xs text-gray-500">
            {filteredMiniapps.length} MiniApps
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
          <p className="rounded-2xl border border-dashed border-gray-200 px-3 py-5 text-center text-xs text-gray-500">
            No MiniApps match this filter.
          </p>
        )}
      </nav>
    </aside>
  );
}

function statusBadgeClass(status: string): string {
  if (status === "active")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "beta") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "disabled")
    return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

function activityStatusClass(
  status: NonNullable<OnChainActivity["status"]>,
): string {
  if (status === "confirmed") return "bg-emerald-50 text-emerald-700";
  if (status === "failed") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

function truncateMiddle(value: string, prefix = 8, suffix = 6): string {
  if (value.length <= prefix + suffix + 3) return value;
  return `${value.slice(0, prefix)}...${value.slice(-suffix)}`;
}

function formatRelativeTime(timestamp: string): string {
  const time = new Date(timestamp).getTime();
  if (!Number.isFinite(time)) return "recently";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatContractDomainNetwork(network: string): string {
  return network === "neo-n3-mainnet" ? "Mainnet" : "Testnet";
}

function formatContractDomainSource(source: string): string {
  if (source === "expected") return "expected";
  return "configured";
}

function contractDomainBadgeClass(source: string): string {
  return source === "expected"
    ? "bg-amber-100 text-amber-700"
    : "bg-emerald-100 text-emerald-700";
}

function InfoPill({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div
      className="min-w-0 rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-2.5"
      data-testid={testId}
    >
      <div className="text-[11px] font-semibold uppercase text-gray-400">
        {label}:
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
      const scaledValue =
        typeof param.scale === "number"
          ? parseScaledDecimal(value, param.scale, param.label || param.name)
          : value;
      return {
        type: "Integer",
        value: scaledValue,
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

    if (param.type === "publickey") {
      if (!/^(02|03)[0-9a-fA-F]{64}$/.test(value)) {
        throw new Error(
          `${param.label || param.name} must be a compressed public key.`,
        );
      }
      return {
        type: "PublicKey",
        value,
      };
    }

    if (param.type === "bytearray") {
      const normalized = value.startsWith("0x") ? value.slice(2) : value;
      if (!/^[0-9a-fA-F]*$/.test(normalized)) {
        throw new Error(
          `${param.label || param.name} must be a hex byte array.`,
        );
      }
      return {
        type: "ByteArray",
        value: normalized,
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

function resolveAnchorOperationAppId(
  appId: string,
  values: Record<string, string>,
  launchContext: MiniAppLaunchContext | null,
): string {
  if (appId === "miniapp-profitanchor" || appId === "miniapp-profitanchor-admin") {
    return "miniapp-profitanchor";
  }
  if (appId === "miniapp-trustanchor" || appId === "miniapp-trustanchor-admin") {
    return "miniapp-trustanchor";
  }
  if (appId !== "miniapp-custom-anchor") return "";
  return String(
    values.anchorAppId ||
      values.appId ||
      launchContext?.params.anchorAppId ||
      launchContext?.params.appId ||
      launchContext?.params.anchor ||
      "",
  ).trim();
}

function resolveCustomAnchorOperations(
  operations: OperationEntry[],
  launchContext: MiniAppLaunchContext | null,
): OperationEntry[] {
  const anchorAppId = String(
    launchContext?.params.anchorAppId ||
      launchContext?.params.anchor ||
      launchContext?.params.appId ||
      "",
  ).trim();
  const userScoped = Boolean(anchorAppId);
  const userOrder = new Map([
    ["stakeNeo", 0],
    ["withdrawNeo", 1],
    ["claimRewards", 2],
  ]);
  const registrationOrder = new Map([["registerCustomAnchor", 0]]);

  return operations
    .map((operation) => {
      if (userScoped) {
        if (userOrder.has(operation.method)) {
          return { ...operation, priority: "primary" as const };
        }
        if (operation.method === "registerCustomAnchor") {
          return { ...operation, priority: "secondary" as const };
        }
        return { ...operation, priority: "operator" as const };
      }

      if (operation.method === "registerCustomAnchor") {
        return { ...operation, priority: "primary" as const };
      }
      if (userOrder.has(operation.method)) {
        return { ...operation, priority: "secondary" as const };
      }
      return operation;
    })
    .sort((left, right) => {
      if (userScoped) {
        const leftRank = userOrder.get(left.method) ?? (left.method === "registerCustomAnchor" ? 10 : 20);
        const rightRank = userOrder.get(right.method) ?? (right.method === "registerCustomAnchor" ? 10 : 20);
        return leftRank - rightRank;
      }
      const leftRank = registrationOrder.get(left.method) ?? (userOrder.has(left.method) ? 10 : 20);
      const rightRank = registrationOrder.get(right.method) ?? (userOrder.has(right.method) ? 10 : 20);
      return leftRank - rightRank;
    });
}

function parseScaledDecimal(
  value: string,
  scale: number,
  label: string,
): string {
  if (!Number.isInteger(scale) || scale < 0 || scale > 18) {
    throw new Error(`${label} has an invalid scale.`);
  }
  const negative = value.startsWith("-");
  const raw = negative ? value.slice(1) : value;
  const [wholeRaw, fractionRaw = ""] = raw.split(".");
  if (!wholeRaw && !fractionRaw) throw new Error(`${label} must be numeric.`);
  if (fractionRaw.length > scale) {
    throw new Error(`${label} supports at most ${scale} decimal places.`);
  }
  const whole = wholeRaw || "0";
  const fraction = fractionRaw.padEnd(scale, "0");
  const scaled = `${whole}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
  return negative && scaled !== "0" ? `-${scaled}` : scaled;
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

function findCatalogAppById(
  miniapps: MiniAppInfo[],
  appId: string,
): MiniAppInfo | null {
  const target = appId.trim().toLowerCase();
  if (!target) return null;
  return miniapps.find((item) => item.app_id.toLowerCase() === target) ?? null;
}

function resolveMiniAppDetailRouteId(appId: string): string {
  const target = appId.trim().toLowerCase();
  return MINIAPP_DETAIL_ROUTE_ALIASES[target] || appId;
}

function getRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getString(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

function resolvePageCatalogNetwork(value: unknown): CatalogNetwork | null {
  const raw = getString(value).toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "neo-n3-mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet") return "neo-n3-testnet";
  return null;
}

function oneGateNetworkParam(network: CatalogNetwork | null): string {
  if (network === "neo-n3-mainnet") return "mainnet";
  if (network === "neo-n3-testnet") return "testnet";
  return "";
}

const FRONTEND_LOCAL_OPERATION_METHODS = new Set([
  "explorerSearch",
  "sealPrivateTransfer",
  "buildOraclePackage",
  "sealOracleRequest",
  "drawTarotReading",
  "flipTarotReading",
  "bridgeAsset",
  "bridgeMessage",
  "trackBridgeOperation",
  "prepareMiniAppOperation",
]);

function isFrontendLocalOperation(method?: string | null): boolean {
  return FRONTEND_LOCAL_OPERATION_METHODS.has(String(method || ""));
}

function buildFrontendOperationQuery(
  currentQuery: Record<string, unknown>,
  method: string,
  values: Record<string, string>,
  targetNetwork: CatalogNetwork | null,
): Record<string, string | string[]> {
  const next: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(currentQuery)) {
    if (key === "operation") continue;
    if (Array.isArray(value)) {
      next[key] = value.map((item) => String(item));
    } else if (value !== undefined && value !== null) {
      next[key] = String(value);
    }
  }

  next.operation = method;
  next.network = oneGateNetworkParam(targetNetwork);
  for (const [key, value] of Object.entries(values)) {
    const trimmed = String(value ?? "").trim();
    if (trimmed) next[key] = trimmed;
  }
  next._op = String(Date.now());
  return next;
}

function frontendOperationFeedback(method: string): string {
  if (method === "explorerSearch") return "Explorer search parameters applied.";
  if (method === "sealPrivateTransfer")
    return "Private transfer sealing started in the playarea.";
  if (method === "sealOracleRequest")
    return "Oracle request sealing started in the playarea.";
  if (method === "buildOraclePackage") return "Oracle request package rebuilt.";
  if (method === "drawTarotReading") return "Tarot reading redrawn.";
  if (method === "flipTarotReading") return "Tarot reading flipped.";
  if (
    method === "bridgeAsset" ||
    method === "bridgeMessage" ||
    method === "trackBridgeOperation"
  ) {
    return "Bridge operation parameters applied.";
  }
  if (method === "prepareMiniAppOperation") {
    return "MiniApp operation parameters applied to the playarea preview.";
  }
  return "Operation parameters applied.";
}

function resolveDirectMiniAppSlug(app: MiniAppInfo): string {
  const manifest = getRecord(app.manifest);
  const urls = getRecord(manifest.urls);
  const candidates = [app.dapp_url, app.entry_url, urls.dapp, urls.entry];

  for (const candidate of candidates) {
    const raw = getString(candidate);
    if (!raw) continue;
    try {
      const url = new URL(raw, "https://neomini.app");
      const parts = url.pathname.split("/").filter(Boolean);
      if (
        parts[0] === "miniapps" &&
        parts[1] &&
        !parts[1].startsWith("miniapp-")
      ) {
        return parts[1];
      }
    } catch {
      // Keep scanning candidate URLs.
    }
  }

  return "";
}

function supportsPageCatalogNetwork(
  app: MiniAppInfo,
  network: CatalogNetwork | null,
): boolean {
  if (!network) return true;
  const manifest = getRecord(app.manifest);
  const supported = Array.isArray(manifest.supported_networks)
    ? manifest.supported_networks
        .map(resolvePageCatalogNetwork)
        .filter((item): item is CatalogNetwork => Boolean(item))
    : [];
  if (supported.length > 0 && !supported.includes(network)) return false;

  const runtimeModules = Array.isArray(getRecord(manifest.runtime).modules)
    ? (getRecord(manifest.runtime).modules as unknown[])
    : [];
  const supportsPlatformRuntime = runtimeModules.some((rawModule) => {
    const networks = getRecord(getRecord(rawModule).networks);
    const networkConfig = getRecord(networks[network]);
    return Boolean(getString(networkConfig.contract_hash));
  });
  if (supportsPlatformRuntime) return true;

  const contracts = getRecord(manifest.contracts);
  const hasNetworkedContracts = Object.values(contracts).some((value) =>
    Boolean(getString(value)),
  );
  if (!hasNetworkedContracts) {
    return (
      Boolean(app.contract_hash) ||
      supported.length > 0 ||
      !manifest.supported_networks
    );
  }

  return Boolean(resolveNetworkContractHash(app, network));
}

function resolveNetworkContractHash(
  app: MiniAppInfo,
  network: CatalogNetwork | null,
): string | null {
  if (!network) return app.contract_hash || null;
  const contracts = getRecord(getRecord(app.manifest).contracts);
  const shortKey = network === "neo-n3-mainnet" ? "mainnet" : "testnet";
  const networkHash = getString(contracts[network] ?? contracts[shortKey]);
  if (networkHash) return networkHash;
  const hasNetworkedContracts = Object.values(contracts).some((value) =>
    Boolean(getString(value)),
  );
  return hasNetworkedContracts ? null : app.contract_hash || null;
}

function withBundledAuthoritativeFields(
  remote: MiniAppInfo | null,
  bundled: MiniAppInfo | null,
): MiniAppInfo | null {
  if (!remote) return bundled;
  if (!bundled) return remote;
  return {
    ...remote,
    name: bundled.name || remote.name,
    description: bundled.description || remote.description,
    category: bundled.category || remote.category,
    contract_hash: bundled.contract_hash ?? remote.contract_hash,
    entry_url: bundled.entry_url || remote.entry_url,
    permissions: bundled.permissions ?? remote.permissions,
    operations: bundled.operations ?? remote.operations,
    detail_template: bundled.detail_template ?? remote.detail_template,
    logo_url: bundled.logo_url ?? remote.logo_url,
    banner_url: bundled.banner_url ?? remote.banner_url,
    docs_url: bundled.docs_url ?? remote.docs_url,
    manifest: bundled.manifest ?? remote.manifest,
  };
}

function appendNavItemIfMissing(
  items: MiniAppNavItem[],
  app: MiniAppInfo,
): MiniAppNavItem[] {
  if (items.some((item) => item.app_id === app.app_id)) return items;
  return [
    {
      app_id: app.app_id,
      name: app.name,
      category: app.category,
      entry_url: app.entry_url,
      logo_url: app.logo_url ?? null,
    },
    ...items,
  ];
}

// Server-Side Props
export const getServerSideProps: GetServerSideProps<
  AppDetailPageProps
> = async (context) => {
  const routeParams = context.params as { id: string };
  const id = resolveMiniAppDetailRouteId(routeParams.id);
  const encodedId = encodeURIComponent(id);

  if (id !== routeParams.id) {
    const queryString = (context.req.url || "").split("?")[1];
    return {
      redirect: {
        destination: `/miniapps/${id}${queryString ? `?${queryString}` : ""}`,
        permanent: false,
      },
    };
  }

  if (isArchivedMiniAppId(id)) {
    return { notFound: true };
  }

  const fallback = await loadBundledMiniAppById(id);
  const targetNetwork = getRpcNetwork();
  const catalogNetwork = resolveCatalogNetwork(targetNetwork);
  const rawMiniAppNav = await loadMiniAppCatalog("active", {
    includeManifest: true,
  }).catch((e: unknown) => {
    console.warn(
      "[miniapps/id] miniapp navigation catalog failed:",
      e instanceof Error ? e.message : String(e),
    );
    return [];
  });

  try {
    const baseUrl = resolveInternalBaseUrl(
      context.req as RequestLike | undefined,
    );
    const catalogApp = withBundledAuthoritativeFields(
      findCatalogAppById(rawMiniAppNav, id),
      fallback,
    );
    const notifRes =
      process.env.PLAYWRIGHT === "1"
        ? null
        : await fetchWithTimeout(
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
    const miniAppNavItems = appendNavItemIfMissing(
      toMiniAppNavItems(rawMiniAppNav),
      app,
    );

    const sharedRuntime =
      supportsCatalogNetwork(app, catalogNetwork) && isSharedModeApp(app)
        ? await resolveSharedModeRuntime(app, targetNetwork).catch(
            (e: unknown) => {
              console.warn(
                "[miniapps/id] shared runtime resolve failed:",
                e instanceof Error ? e.message : String(e),
              );
              return null;
            },
          )
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
          miniAppNav: sanitizeForJson(
            appendNavItemIfMissing(toMiniAppNavItems(rawMiniAppNav), fallback),
          ),
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
        miniAppNav: sanitizeForJson(toMiniAppNavItems(rawMiniAppNav)),
        notifications: [],
        sharedRuntime: null,
        error: "Failed to load app details",
      },
    };
  }
};
