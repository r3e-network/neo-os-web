import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  PlayCircle,
  SlidersHorizontal,
  Wallet,
  X,
} from "lucide-react";
import { AppDetailHeader, OperationPanel } from "../../components";
import { MiniAppPlayfield } from "../../components/MiniAppPlayfield";
import type { OperationEntry } from "../../components/types";
import {
  getNativePlayAreaOperationFallback,
  resolvePlayAreaOperationNetworkDefaults,
} from "../../components/playarea/PlayAreaOperationFallbacks";
import { isChainRelevant } from "../../components/playarea/PlayAreaFallbacks";
import {
  HOST_PLAYFIELD_REFRESH,
  HOST_WALLET_BRIDGE_ERROR,
  HOST_WALLET_BRIDGE_RESULT,
  type EmbeddedWalletBridgeErrorDetail,
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
  resolveNetworkOperationMethod,
  resolveOneGateDappId,
  resolvePageCatalogNetwork,
  supportsPageCatalogNetwork,
  type AppDetailPageProps,
} from "../../lib/miniapp-detail-helpers";
import { Layout } from "../../components/layout";
import { BRAND } from "@/lib/brand";
import { useFocusTrap } from "@/lib/design-system/a11y";
import { useActivityFeed } from "../../hooks/useActivityFeed";
import {
  useMiniAppDetailInvoke,
  type MiniAppInvokeFeedback,
} from "../../hooks/useMiniAppDetailInvoke";
import { isSharedModeApp } from "../../lib/chain";
import {
  selectConnectedWalletAddress,
  useWalletStore,
} from "../../lib/wallet/store";
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
import { getApplicationLog } from "../../lib/chain/rpc-client";

const DORA_TX_BASE = "https://dora.coz.io/transaction/neo3";
const TX_CONFIRMATION_TIMEOUT_MS = 90_000;
const TX_CONFIRMATION_POLL_MS = 5_000;

type TxConfirmationState =
  | "idle"
  | "pending"
  | "confirmed"
  | "failed"
  | "settled";

type TxVmStateOutcome = "confirmed" | "failed" | "settled";

/**
 * Authoritatively confirm a submitted transaction by polling its application
 * log: a wallet that hands back a txid only proves the tx was *relayed*, not
 * that it executed. We confirm on `vmstate === "HALT"` and surface FAULT as a
 * failure so a reverted on-chain action is never shown as a neutral "Submitted"
 * receipt. If the log never appears before the deadline we fall back to
 * "settled" (the indexer may simply be lagging) rather than asserting failure.
 */
async function confirmTransactionByVmState(
  network: "mainnet" | "testnet",
  txid: string,
  timeoutMs: number,
  pollIntervalMs: number,
  shouldContinue: () => boolean,
): Promise<TxVmStateOutcome> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (!shouldContinue()) return "settled";
    try {
      const log = (await getApplicationLog(txid, network)) as {
        executions?: Array<{ vmstate?: string }>;
      } | null;
      const vmstate = log?.executions?.[0]?.vmstate;
      if (typeof vmstate === "string" && vmstate) {
        return vmstate.toUpperCase() === "HALT" ? "confirmed" : "failed";
      }
      // Log not yet available (tx still mempool/unindexed) — keep polling.
    } catch {
      // getapplicationlog throws while the tx is not yet known; keep polling
      // until the deadline, then fall back to the neutral settled state.
    }
    if (Date.now() >= deadline) return "settled";
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

function shortTxId(value: string) {
  return value.length > 18
    ? `${value.slice(0, 10)}...${value.slice(-8)}`
    : value;
}

function getTransactionExplorerUrl(
  network: "mainnet" | "testnet",
  txid: string,
) {
  const segment = network === "testnet" ? "testnet" : "mainnet";
  return `${DORA_TX_BASE}/${segment}/${encodeURIComponent(txid)}`;
}

function normalizeContractHash(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^0x/, "");
}

function normalizeMethodToken(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

type ConsoleOperationTarget = {
  chainMethod: string;
  contractHash: string | null;
};

/**
 * Cross-lane double-submit guard: a write submitted from the embedded
 * workspace locks the matching host-console operation until it confirms.
 * Matching is generic — by resolved chain method + contract hash for direct
 * contract writes, and by the "<appId>:<action>" transfer memo for
 * deposit-then-act recipes — instead of keying on one hardcoded app.
 */
function isEmbeddedSubmittedOperation(
  appId: string | undefined,
  operation: OperationEntry | null | undefined,
  result: EmbeddedWalletBridgeResultDetail | null,
  target: ConsoleOperationTarget,
) {
  if (!appId || !operation || !result) return false;
  if (result.appId !== appId || !result.txid) return false;

  // Lane 1: direct contract write — the embedded workspace invoked the same
  // resolved chain method on the same contract the console would target.
  if (
    target.contractHash &&
    normalizeContractHash(result.contractHash) ===
      normalizeContractHash(target.contractHash) &&
    normalizeMethodToken(result.operation) ===
      normalizeMethodToken(target.chainMethod)
  ) {
    return true;
  }

  // Lane 2: deposit-then-act recipe — a NEP-17 transfer carrying the
  // "<appId>:<action>" memo duplicates the console operation whose method
  // normalizes to the same action token (e.g. checkIn ↔ checkin).
  if (normalizeMethodToken(result.operation) === "transfer") {
    const memo = String(result.memo || "");
    const prefix = `${appId.toLowerCase()}:`;
    if (memo.toLowerCase().startsWith(prefix)) {
      const action = memo.slice(prefix.length);
      if (
        action &&
        normalizeMethodToken(action) === normalizeMethodToken(operation.method)
      ) {
        return true;
      }
    }
  }

  return false;
}

function InvokeFeedbackNotice({
  feedback,
  txid,
  confirmation,
  network,
}: {
  feedback: MiniAppInvokeFeedback;
  txid: string | null;
  confirmation: TxConfirmationState;
  network: "mainnet" | "testnet";
}) {
  // A txid alone only means the tx was relayed. An on-chain FAULT must read as a
  // failure, not a neutral success banner — recolor the whole notice red once
  // the application log reports a non-HALT execution.
  const failed = confirmation === "failed";
  const success = feedback.type === "success" && !failed;
  return (
    <div
      className={`mt-3 rounded-xl border px-3 py-2 text-xs break-words ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
      data-testid="invoke-feedback"
    >
      <span className="block">
        {failed
          ? "Transaction reverted on-chain (FAULT). Nothing was applied."
          : feedback.message}
      </span>
      {feedback.type === "success" && txid && (
        <span
          className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1"
          data-testid="invoke-feedback-tx"
        >
          <span className="font-mono font-semibold">{shortTxId(txid)}</span>
          <a
            href={getTransactionExplorerUrl(network, txid)}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1 font-semibold underline underline-offset-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/40 ${
              failed ? "hover:text-red-900" : "hover:text-emerald-900"
            }`}
          >
            View on explorer
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
          <span
            className={`inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              failed ? "border-red-200" : "border-emerald-200"
            }`}
          >
            {confirmation === "confirmed" ? (
              <>
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Confirmed
              </>
            ) : confirmation === "failed" ? (
              <>
                <X className="h-3 w-3" aria-hidden="true" />
                Failed
              </>
            ) : confirmation === "pending" ? (
              "Confirming…"
            ) : (
              "Submitted"
            )}
          </span>
        </span>
      )}
    </div>
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
  const [invokeFeedback, setInvokeFeedback] =
    useState<MiniAppInvokeFeedback | null>(null);
  const [mobileActionOpen, setMobileActionOpen] = useState(false);
  const [activeOperationKey, setActiveOperationKey] = useState("");
  const [embeddedWalletResult, setEmbeddedWalletResult] =
    useState<EmbeddedWalletBridgeResultDetail | null>(null);
  const [bridgeErrorNotice, setBridgeErrorNotice] = useState<string | null>(
    null,
  );
  const [txConfirmation, setTxConfirmation] =
    useState<TxConfirmationState>("idle");
  // The reference/diagnostics accordion is collapsed by default. Gating the
  // activity feed on it stops two `/api/activity/*` endpoints from polling every
  // 5s behind a section the user never opened.
  const [referenceOpen, setReferenceOpen] = useState(false);

  const walletConnected = useWalletStore((state) => state.connected);
  const walletAddress = useWalletStore(selectConnectedWalletAddress);
  const walletReady = walletConnected && Boolean(walletAddress);
  const walletNetwork = useWalletStore((state) => state.network);
  const refreshWalletBalance = useWalletStore((state) => state.refreshBalance);
  // A persisted session is reconnecting when restore is in flight (`loading`)
  // or pending a one-click resume (`restorePending`). During that window the
  // action console should not flash "Wallet Required"/unsafe-network.
  const walletLoading = useWalletStore((state) => state.loading);
  const walletRestorePending = useWalletStore((state) => state.restorePending);
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
  const networkGuardReason = walletReady
    ? getWalletNetworkGuardReason(walletNetwork, targetNetwork)
    : null;
  const networkAvailabilityReason = appSupportsTargetNetwork
    ? null
    : `${app?.name || "This MiniApp"} is not deployed or enabled on ${targetNetworkLabel}. Switch to a supported network before submitting transactions.`;
  const networkSafetyOk =
    walletReady && !networkGuardReason && appSupportsTargetNetwork;
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
  // Mobile action sheet a11y: lock body scroll while the sheet is open (same
  // pattern as the connect modal) and trap focus inside the dialog.
  useEffect(() => {
    if (!mobileActionOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileActionOpen]);
  const mobileSheetRef = useFocusTrap({
    active: mobileActionOpen,
    initialFocus: "[data-mobile-action-close]",
    returnFocus: true,
  });
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
          ? `Embedded workspace submitted transaction: ${shortTxId(detail.txid)}`
          : "Embedded workspace submitted transaction.",
        ...(detail.txid ? { txid: detail.txid } : {}),
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
  // Rejected/failed sensitive bridge requests surface as a short-lived host
  // notice so the user who just dismissed the approval prompt gets an
  // acknowledgment even when the embedded app swallows the error.
  useEffect(() => {
    const handleEmbeddedWalletError = (event: Event) => {
      const detail = (event as CustomEvent<EmbeddedWalletBridgeErrorDetail>)
        .detail;
      if (!detail || detail.appId !== app?.app_id) return;
      if (detail.network !== targetNetwork) return;
      setBridgeErrorNotice(
        detail.rejected
          ? "Request rejected — nothing was submitted."
          : `${detail.message || "Embedded wallet request failed."} Nothing was submitted.`,
      );
    };
    window.addEventListener(HOST_WALLET_BRIDGE_ERROR, handleEmbeddedWalletError);
    return () =>
      window.removeEventListener(
        HOST_WALLET_BRIDGE_ERROR,
        handleEmbeddedWalletError,
      );
  }, [app?.app_id, targetNetwork]);
  useEffect(() => {
    if (!bridgeErrorNotice) return undefined;
    const timeout = window.setTimeout(() => setBridgeErrorNotice(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [bridgeErrorNotice]);
  const runtimeDisabledReason =
    resolvedRuntime?.mode === "platform"
      ? resolvedRuntime.disabledReason
      : null;
  const walletRequiredReason = walletReady
    ? null
    : "Connect wallet before sending transactions.";
  const operationDisabledReason =
    networkAvailabilityReason ||
    networkGuardReason ||
    runtimeDisabledReason ||
    walletRequiredReason;
  // The contract the action console targets on this network — used both for
  // the cross-lane double-submit guard and for confirmation polling.
  const consoleContractHash =
    resolvedRuntime?.mode === "platform"
      ? resolvedRuntime.contractHash || directContractHash
      : directContractHash;
  const consoleOperationTarget = useCallback(
    (operation: OperationEntry): ConsoleOperationTarget => ({
      chainMethod: app?.app_id
        ? resolveNetworkOperationMethod(
            app.app_id,
            operation.method || "",
            targetNetwork,
          )
        : operation.method || "",
      contractHash: consoleContractHash,
    }),
    [app?.app_id, consoleContractHash, targetNetwork],
  );
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
          consoleOperationTarget(operation),
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
      consoleOperationTarget,
      embeddedWalletResult,
      networkAvailabilityReason,
      operationDisabledReason,
    ],
  );
  // Once a submitted transaction confirms, push fresh chain state into the
  // playfield, refresh the wallet balance, and lift the cross-lane lock.
  const handleTxConfirmed = useCallback(() => {
    window.dispatchEvent(new CustomEvent(HOST_PLAYFIELD_REFRESH));
    if (typeof refreshWalletBalance === "function") {
      void refreshWalletBalance();
    }
    setEmbeddedWalletResult(null);
  }, [refreshWalletBalance]);
  const invokeFeedbackTxId =
    invokeFeedback?.type === "success"
      ? (invokeFeedback.txid ??
        invokeFeedback.message.match(/0x[0-9a-f]{64}/i)?.[0] ??
        null)
      : null;
  useEffect(() => {
    if (!invokeFeedbackTxId || !consoleContractHash) {
      setTxConfirmation("idle");
      return undefined;
    }
    if (typeof fetch !== "function") {
      setTxConfirmation("settled");
      return undefined;
    }
    let cancelled = false;
    setTxConfirmation("pending");
    confirmTransactionByVmState(
      targetNetwork,
      invokeFeedbackTxId,
      TX_CONFIRMATION_TIMEOUT_MS,
      TX_CONFIRMATION_POLL_MS,
      () => !cancelled,
    )
      .then((outcome) => {
        if (cancelled) return;
        if (outcome === "confirmed") {
          setTxConfirmation("confirmed");
          handleTxConfirmed();
        } else {
          // FAULT → "failed"; deadline with no log → neutral "settled".
          setTxConfirmation(outcome);
        }
      })
      .catch(() => {
        if (!cancelled) setTxConfirmation("settled");
      });
    return () => {
      cancelled = true;
    };
  }, [
    consoleContractHash,
    handleTxConfirmed,
    invokeFeedbackTxId,
    targetNetwork,
  ]);
  const showNews = app?.news_integration !== false;
  const showSecrets = app?.permissions?.confidential === true;

  // App-specific activity feed (events + transactions poll, notifications via
  // Realtime). The single realtime subscription it owns also backs the news tab
  // below — `newsEnabled` keeps it on the showNews gate so we never open a
  // duplicate channel / news fetch. The notifications subscription stays scoped
  // to the news tab being visible.
  const {
    activities: appActivities,
    loading: activityLoading,
    error: activityError,
    isConnected: activityConnected,
    notifications: realtimeNews,
    notificationsLoading: newsLoading,
    notificationsConnected: newsConnected,
  } = useActivityFeed({
    appId: app?.app_id,
    network: targetNetwork,
    pollInterval: 5000,
    // Only poll/subscribe once the diagnostics accordion (which renders the
    // activity feed and news tab) is actually open. News still SSR-hydrates via
    // the `notifications` prop, so the closed state shows hydrated content
    // without any client polling.
    enabled: Boolean(app?.app_id) && referenceOpen,
    newsEnabled: Boolean(app?.app_id) && showNews && referenceOpen,
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
  const activeOperationSubmittedFromEmbed = Boolean(
    activeOperation &&
      isEmbeddedSubmittedOperation(
        app?.app_id,
        activeOperation,
        embeddedWalletResult,
        consoleOperationTarget(activeOperation),
      ),
  );
  // While a persisted wallet session is silently reconnecting (or waiting on a
  // one-click resume), the console shouldn't claim "Wallet Required" or warn
  // about an unsafe network — neither is known yet. Show a neutral checking
  // state instead.
  const actionConsoleWalletRestoring =
    actionConsoleRequiresWallet &&
    !walletReady &&
    !activeOperationSubmittedFromEmbed &&
    (walletLoading || walletRestorePending);
  const actionConsoleStatusLabel = actionConsoleUsesLocalContext
    ? "Workspace Preview"
    : actionConsoleUsesHostApi
      ? "API Ready"
      : activeOperationSubmittedFromEmbed
      ? "Synced"
      : walletReady
      ? "Wallet Ready"
      : actionConsoleWalletRestoring
      ? "Checking wallet…"
      : "Wallet Required";
  const actionConsoleStatusClass = actionConsoleUsesLocalContext
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : actionConsoleUsesHostApi
      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
      : activeOperationSubmittedFromEmbed
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : walletReady
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : actionConsoleWalletRestoring
      ? "border-gray-200 bg-gray-50 text-gray-500"
      : "border-gray-200 bg-gray-50 text-gray-500";
  const actionConsoleWalletText = actionConsoleUsesLocalContext
    ? `No transaction is sent from this host button. It opens or updates the embedded workspace for ${targetNetworkLabel}; submit wallet actions inside the MiniApp.`
    : actionConsoleUsesHostApi
      ? `This action is handled by the platform API for ${targetNetworkLabel}. It checks sponsorship or submits the relay payload without opening a browser wallet prompt.`
      : activeOperationSubmittedFromEmbed && embeddedWalletResult?.txid
      ? `Embedded workspace submitted ${shortTxId(embeddedWalletResult.txid)}. Refresh after confirmation before submitting again.`
      : walletReady && walletAddress
      ? walletAddress
      : actionConsoleWalletRestoring
      ? "Reconnecting your saved wallet session…"
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
    walletConnected: walletReady,
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
  const focusMiniAppWorkspace = () => {
    const workspace = document.querySelector('[data-testid="miniapp-playarea"]');
    workspace?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const operationPanel = app.detail_template?.operation_panel;
  const operationTitle =
    operationPanel?.title ||
    (app.detail_template?.layout === "prediction" ? "Trade" : "Operations");
  const operationSubtitle = operationPanel?.subtitle;
  const mobileDockLabel = `Play ${app.name}`;
  const showActionRail =
    operations.length > 0 ||
    Boolean(sharedRuntime) ||
    Boolean(invokeFeedback) ||
    Boolean(bridgeErrorNotice) ||
    (isChainRelevant(app) && Boolean(networkAvailabilityReason));
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
  const renderPrimaryActionGuide = (compact = false) => (
    <div
      className={`rounded-xl border border-emerald-100 bg-emerald-50/70 ${
        compact ? "p-3" : "mt-4 p-3"
      }`}
      data-testid={
        compact ? "mobile-primary-action-guide" : "primary-action-guide"
      }
    >
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm shadow-emerald-900/10">
          <PlayCircle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-sm font-bold text-gray-900">
            Play in the MiniApp
          </p>
          <p className="m-0 mt-1 text-xs leading-5 text-gray-600">
            Use the embedded workspace for the normal flow. Wallet prompts and
            transaction results stay tied to the MiniApp experience.
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        <button
          type="button"
          onClick={focusMiniAppWorkspace}
          className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-700 px-3 py-2 text-sm font-bold text-white shadow-sm shadow-emerald-700/15 transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
        >
          <PlayCircle className="h-4 w-4" aria-hidden="true" />
          Use embedded workspace
        </button>
        {oneGateLaunchUrl && (
          <a
            href={oneGateLaunchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
          >
            Open in OneGate
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
  const renderOperationConsole = (compact = false) =>
    operations.length > 0 ? (
      <details
        className="group mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm shadow-gray-950/5"
        data-testid={
          compact
            ? "mobile-advanced-operation-console"
            : "advanced-operation-console"
        }
      >
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/40">
          <span className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gray-50 text-gray-600">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-gray-900">
                Host transaction console
              </span>
              <span className="mt-0.5 block truncate text-xs text-gray-500">
                Advanced fallback for direct host-side submissions.
              </span>
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-gray-100 p-3">
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
        </div>
      </details>
    ) : null;

  return (
    <Layout hideFooter>
      <div className="min-h-screen bg-[#faf9f7] pb-28 pt-16 text-gray-900 xl:pb-6">
        <Head>
          <title>{`${app.name} - ${BRAND.productName}`}</title>
        </Head>
        <AppDetailHeader app={app} onBack={handleBack} />

        <main className="mx-auto max-w-[1580px] px-3 py-2 sm:px-4 sm:py-3">
          <div
            className={`miniapp-stable-scroll focus-mode-layout grid grid-cols-1 items-start gap-4 ${
              showActionRail ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "xl:grid-cols-1"
            }`}
            data-testid="miniapp-detail-layout"
            data-action-rail={showActionRail ? "visible" : "hidden"}
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

              <details
                className="focus-mode-reference group"
                open={referenceOpen}
                onToggle={(event) =>
                  setReferenceOpen(event.currentTarget.open)
                }
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm shadow-gray-950/5 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/40">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">
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

            {showActionRail && (
              <aside
                className="order-2 hidden self-start space-y-3 xl:order-none xl:sticky xl:top-24 xl:block"
                aria-label="MiniApp actions"
                data-testid="miniapp-actions"
              >
              <section className="focus-mode-action-panel overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-md shadow-gray-950/8 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-600">
                      Focus action
                    </p>
                    <h2 className="m-0 text-base font-bold text-gray-900 sm:text-lg">
                      {app.name}
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

                {renderPrimaryActionGuide()}
                {renderOperationConsole()}

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

                {actionConsoleRequiresWallet && !actionConsoleWalletRestoring && (
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
                  <InvokeFeedbackNotice
                    feedback={invokeFeedback}
                    txid={invokeFeedbackTxId}
                    confirmation={txConfirmation}
                    network={targetNetwork}
                  />
                )}

                {bridgeErrorNotice && (
                  <div
                    className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"
                    data-testid="bridge-error-notice"
                    role="status"
                  >
                    {bridgeErrorNotice}
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
            )}
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
                      Play / OneGate
                    </span>
                    <span className="block truncate text-sm font-bold">
                      {mobileDockLabel}
                    </span>
                  </span>
                  {/* The chevron alone signals the bottom sheet; a verb pill
                      ("Open"/"Claim") mislabeled non-claim actions as navigation. */}
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-emerald-900">
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
              </div>

              {mobileActionOpen && (
                <div
                  id="mobile-action-sheet"
                  ref={mobileSheetRef}
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
                          Play / OneGate
                        </p>
                        <h2 className="m-0 truncate text-lg font-bold text-gray-900">
                          {app.name}
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
                          data-mobile-action-close
                        >
                          <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {renderPrimaryActionGuide(true)}
                    {renderOperationConsole(true)}

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

                    {actionConsoleRequiresWallet &&
                      !actionConsoleWalletRestoring && (
                        <NetworkSafetyBadge
                          networkSafetyOk={networkSafetyOk}
                          targetNetworkLabel={targetNetworkLabel}
                          walletNetworkLabel={walletNetworkLabel}
                        />
                      )}

                    {invokeFeedback && (
                      <InvokeFeedbackNotice
                        feedback={invokeFeedback}
                        txid={invokeFeedbackTxId}
                        confirmation={txConfirmation}
                        network={targetNetwork}
                      />
                    )}

                    {bridgeErrorNotice && (
                      <div
                        className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"
                        data-testid="bridge-error-notice"
                        role="status"
                      >
                        {bridgeErrorNotice}
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
