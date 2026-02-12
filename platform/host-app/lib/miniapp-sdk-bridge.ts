/**
 * MiniApp SDK Bridge Dispatcher
 *
 * Shared bridge logic for dispatching SDK calls from MiniApp iframes.
 * Uses handler registry pattern for maintainability.
 */

import type { MiniAppSDK } from "./miniapp-sdk";
import type { MiniAppInfo } from "../components/types";
import type { ChainId } from "./chains/types";

// ============================================================================
// Types
// ============================================================================

export interface BridgeContext {
  sdk: MiniAppSDK;
  params: unknown[];
  appId: string;
  walletAddress?: string;
}

type BridgeHandler = (ctx: BridgeContext) => Promise<unknown>;

// ============================================================================
// Permission Checking
// ============================================================================

const PERMISSION_MAP: Record<string, keyof NonNullable<MiniAppInfo["permissions"]> | null> = {
  "payments.payGAS": "payments",
  "payments.payGASAndInvoke": "payments",
  "governance.vote": "governance",
  "governance.voteAndInvoke": "governance",
  "governance.getCandidates": "governance",
  "rng.requestRandom": "rng",
  "datafeed.getPrice": "datafeed",
  "datafeed.getPrices": "datafeed",
  "datafeed.getNetworkStats": "datafeed",
  "datafeed.getRecentTransactions": "datafeed",
  "wallet.signMessage": "confidential",
  "automation.register": "automation",
  "automation.unregister": "automation",
  "automation.status": "automation",
  "automation.list": "automation",
  "automation.update": "automation",
  "automation.enable": "automation",
  "automation.disable": "automation",
  "automation.logs": "automation",
  "wallet.invokeIntent": "payments",
  "events.emit": "datafeed",
};

const SAFE_METHODS = new Set([
  "getConfig",
  "wallet.getAddress",
  "getAddress",
  "wallet.switchChain",
  // TODO: invokeFunction/invokeRead need contract-level ACL (restrict to app's own contract).
  // Kept safe for now because all miniapps depend on them for core functionality.
  "invokeRead",
  "invokeFunction",
  "stats.getMyUsage",
  "events.list",
  "transactions.list",
  "share.openModal",
  "share.getUrl",
  "share.copy",
]);

export function hasPermission(method: string, permissions: MiniAppInfo["permissions"]): boolean {
  if (!permissions) return false;
  if (SAFE_METHODS.has(method)) return true;
  const requiredPerm = PERMISSION_MAP[method];
  if (requiredPerm === undefined || requiredPerm === null) return false; // Unknown method - deny
  return Boolean(permissions[requiredPerm]);
}

// ============================================================================
// Utility Functions
// ============================================================================

export function resolveScopedAppId(requested: unknown, appId: string): string {
  const trimmed = String(requested ?? "").trim();
  if (trimmed && trimmed !== appId) throw new Error("app_id mismatch");
  return appId;
}

export function normalizeListParams(raw: unknown, appId: string): Record<string, unknown> {
  const base = raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  return { ...base, app_id: resolveScopedAppId(base.app_id, appId) };
}

export function resolveIframeOrigin(entryUrl: string): string | null {
  const trimmed = String(entryUrl || "").trim();
  if (!trimmed || trimmed.startsWith("mf://")) return null;
  try {
    return new URL(trimmed, window.location.origin).origin;
  } catch {
    return null;
  }
}

function buildShareUrl(
  appId: string,
  chainId?: string,
  options?: { page?: string; params?: Record<string, string> },
): string {
  const baseUrl = `${window.location.origin}/miniapps/${appId}`;
  const queryParams = new URLSearchParams();
  if (chainId) queryParams.set("chain", chainId);
  if (options?.page) queryParams.set("page", options.page);
  if (options?.params) {
    for (const [key, value] of Object.entries(options.params)) {
      queryParams.set(key, value);
    }
  }
  const queryString = queryParams.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

// ============================================================================
// Handler Registry - Core Methods
// ============================================================================

const handleGetConfig: BridgeHandler = async ({ sdk }) => {
  if (!sdk.getConfig) throw new Error("getConfig not available");
  return sdk.getConfig();
};

const handleGetAddress: BridgeHandler = async ({ sdk, walletAddress, params }) => {
  const [chainId] = params;

  // Try to resolve from MultiChainStore to support specific chain address
  try {
    const { useMultiChainWallet } = await import("./wallet/multi-chain-store");
    const mcState = useMultiChainWallet.getState();
    const targetChainId = (typeof chainId === "string" && chainId ? chainId : mcState.activeChainId) as ChainId | null;

    if (targetChainId) {
      const account = mcState.account?.accounts?.[targetChainId as keyof typeof mcState.account.accounts];
      if (account) {
        return account;
      }
    }
  } catch {
    // Ignore if multi-chain store lookup fails
  }

  // Fallback to current address if no specific chain requested or lookup failed
  if (walletAddress && (!chainId || typeof chainId !== "string")) return walletAddress;

  if (sdk.wallet?.getAddress) return sdk.wallet.getAddress();
  if (sdk.getAddress) return sdk.getAddress();
  throw new Error("wallet.getAddress not available");
};

const handleInvokeIntent: BridgeHandler = async ({ sdk, params }) => {
  if (!sdk.wallet?.invokeIntent) throw new Error("wallet.invokeIntent not available");
  return sdk.wallet.invokeIntent(String(params[0] ?? ""));
};

const handleSwitchChain: BridgeHandler = async ({ sdk, params }) => {
  const [chainId] = params;
  if (!chainId || typeof chainId !== "string") throw new Error("chainId required");
  if (sdk.wallet?.switchChain) return sdk.wallet.switchChain(chainId as ChainId);
  const { useWalletStore } = await import("./wallet/store");
  await useWalletStore.getState().switchChain(chainId as ChainId);
  return true;
};

const handleInvokeRead: BridgeHandler = async ({ sdk, params }) => {
  if (!sdk.invoke) throw new Error("invoke not available");
  const [payload] = params;
  if (!payload || typeof payload !== "object") throw new Error("invoke params required");
  return sdk.invoke("invokeRead", payload);
};

const handleInvokeFunction: BridgeHandler = async ({ sdk, params }) => {
  if (!sdk.invoke) throw new Error("invoke not available");
  const [payload] = params;
  if (!payload || typeof payload !== "object") throw new Error("invoke params required");
  return sdk.invoke("invokeFunction", payload);
};

const handleSignMessage: BridgeHandler = async ({ sdk, params }) => {
  if (!sdk.wallet?.signMessage) throw new Error("wallet.signMessage not available");
  const [payload] = params;
  const message =
    typeof payload === "string"
      ? payload
      : payload && typeof payload === "object"
        ? String((payload as { message?: unknown }).message ?? "")
        : "";
  if (!message) throw new Error("message required");
  return sdk.wallet.signMessage(message);
};

// ============================================================================
// Handler Registry - Payments
// ============================================================================

const handlePayGAS: BridgeHandler = async ({ sdk, params, appId }) => {
  if (!sdk.payments?.payGAS) throw new Error("payments.payGAS not available");
  const [requestedAppId, amount, memo] = params;
  const scopedAppId = resolveScopedAppId(requestedAppId, appId);
  const memoValue = memo == null ? undefined : String(memo);
  return sdk.payments.payGAS(scopedAppId, String(amount ?? ""), memoValue);
};

const handlePayGASAndInvoke: BridgeHandler = async ({ sdk, params, appId }) => {
  if (!sdk.payments?.payGASAndInvoke) throw new Error("payments.payGASAndInvoke not available");
  const [requestedAppId, amount, memo] = params;
  const scopedAppId = resolveScopedAppId(requestedAppId, appId);
  const memoValue = memo == null ? undefined : String(memo);
  return sdk.payments.payGASAndInvoke(scopedAppId, String(amount ?? ""), memoValue);
};

// ============================================================================
// Handler Registry - Governance
// ============================================================================

const handleGovernanceVote: BridgeHandler = async ({ sdk, params, appId }) => {
  if (!sdk.governance?.vote) throw new Error("governance.vote not available");
  const [requestedAppId, proposalId, neoAmount, support] = params;
  const scopedAppId = resolveScopedAppId(requestedAppId, appId);
  const supportValue = typeof support === "boolean" ? support : undefined;
  return sdk.governance.vote(scopedAppId, String(proposalId ?? ""), String(neoAmount ?? ""), supportValue);
};

const handleGovernanceVoteAndInvoke: BridgeHandler = async ({ sdk, params, appId }) => {
  if (!sdk.governance?.voteAndInvoke) throw new Error("governance.voteAndInvoke not available");
  const [requestedAppId, proposalId, neoAmount, support] = params;
  const scopedAppId = resolveScopedAppId(requestedAppId, appId);
  const supportValue = typeof support === "boolean" ? support : undefined;
  return sdk.governance.voteAndInvoke(scopedAppId, String(proposalId ?? ""), String(neoAmount ?? ""), supportValue);
};

const handleGetCandidates: BridgeHandler = async ({ sdk }) => {
  if (!sdk.governance?.getCandidates) throw new Error("governance.getCandidates not available");
  return sdk.governance.getCandidates();
};

// ============================================================================
// Handler Registry - RNG & Datafeed
// ============================================================================

const handleRequestRandom: BridgeHandler = async ({ sdk, params, appId }) => {
  if (!sdk.rng?.requestRandom) throw new Error("rng.requestRandom not available");
  return sdk.rng.requestRandom(resolveScopedAppId(params[0], appId));
};

const handleGetPrice: BridgeHandler = async ({ sdk, params }) => {
  if (!sdk.datafeed?.getPrice) throw new Error("datafeed.getPrice not available");
  return sdk.datafeed.getPrice(String(params[0] ?? ""));
};

const handleGetPrices: BridgeHandler = async ({ sdk }) => {
  if (!sdk.datafeed?.getPrices) throw new Error("datafeed.getPrices not available");
  return sdk.datafeed.getPrices();
};

const handleGetNetworkStats: BridgeHandler = async ({ sdk }) => {
  if (!sdk.datafeed?.getNetworkStats) throw new Error("datafeed.getNetworkStats not available");
  return sdk.datafeed.getNetworkStats();
};

const handleGetRecentTransactions: BridgeHandler = async ({ sdk, params }) => {
  if (!sdk.datafeed?.getRecentTransactions) throw new Error("datafeed.getRecentTransactions not available");
  const limitValue = typeof params[0] === "number" ? params[0] : undefined;
  return sdk.datafeed.getRecentTransactions(limitValue);
};

// ============================================================================
// Handler Registry - Stats, Events, Transactions
// ============================================================================

const handleGetMyUsage: BridgeHandler = async ({ sdk, params, appId }) => {
  if (!sdk.stats?.getMyUsage) throw new Error("stats.getMyUsage not available");
  const [requestedAppId, date] = params;
  const dateValue = date == null ? undefined : String(date);
  return sdk.stats.getMyUsage(resolveScopedAppId(requestedAppId, appId), dateValue);
};

const handleEventsList: BridgeHandler = async ({ sdk, params, appId }) => {
  if (!sdk.events?.list) throw new Error("events.list not available");
  return sdk.events.list(normalizeListParams(params[0], appId));
};

const handleEventsEmit: BridgeHandler = async ({ sdk, params }) => {
  if (!sdk.events?.emit) throw new Error("events.emit not available");
  const [eventName, data] = params;
  const name = String(eventName ?? "").trim();
  if (!name) throw new Error("eventName required");
  const payload = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return sdk.events.emit(name, payload);
};

const handleTransactionsList: BridgeHandler = async ({ sdk, params, appId }) => {
  if (!sdk.transactions?.list) throw new Error("transactions.list not available");
  return sdk.transactions.list(normalizeListParams(params[0], appId));
};

// ============================================================================
// Handler Registry - Automation
// ============================================================================

const handleAutomationRegister: BridgeHandler = async ({ sdk, params }) => {
  if (!sdk.automation?.register) throw new Error("automation.register not available");
  const [taskName, taskType, payload, schedule] = params;
  const name = String(taskName ?? "").trim();
  const type = String(taskType ?? "").trim();
  if (!name || !type) throw new Error("taskName and taskType required");
  return sdk.automation.register(
    name,
    type,
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : undefined,
    schedule && typeof schedule === "object" ? (schedule as { intervalSeconds?: number; maxRuns?: number }) : undefined,
  );
};

const handleAutomationUnregister: BridgeHandler = async ({ sdk, params }) => {
  if (!sdk.automation?.unregister) throw new Error("automation.unregister not available");
  const name = String(params[0] ?? "").trim();
  if (!name) throw new Error("taskName required");
  return sdk.automation.unregister(name);
};

const handleAutomationStatus: BridgeHandler = async ({ sdk, params }) => {
  if (!sdk.automation?.status) throw new Error("automation.status not available");
  const name = String(params[0] ?? "").trim();
  if (!name) throw new Error("taskName required");
  return sdk.automation.status(name);
};

const handleAutomationList: BridgeHandler = async ({ sdk }) => {
  if (!sdk.automation?.list) throw new Error("automation.list not available");
  return sdk.automation.list();
};

const handleAutomationUpdate: BridgeHandler = async ({ sdk, params }) => {
  if (!sdk.automation?.update) throw new Error("automation.update not available");
  const [taskId, payload, schedule] = params;
  const id = String(taskId ?? "").trim();
  if (!id) throw new Error("taskId required");
  return sdk.automation.update(
    id,
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : undefined,
    schedule && typeof schedule === "object"
      ? (schedule as { intervalSeconds?: number; cron?: string; maxRuns?: number })
      : undefined,
  );
};

const handleAutomationEnable: BridgeHandler = async ({ sdk, params }) => {
  if (!sdk.automation?.enable) throw new Error("automation.enable not available");
  const id = String(params[0] ?? "").trim();
  if (!id) throw new Error("taskId required");
  return sdk.automation.enable(id);
};

const handleAutomationDisable: BridgeHandler = async ({ sdk, params }) => {
  if (!sdk.automation?.disable) throw new Error("automation.disable not available");
  const id = String(params[0] ?? "").trim();
  if (!id) throw new Error("taskId required");
  return sdk.automation.disable(id);
};

const handleAutomationLogs: BridgeHandler = async ({ sdk, params }) => {
  if (!sdk.automation?.logs) throw new Error("automation.logs not available");
  const [taskId, limit] = params;
  const id = taskId ? String(taskId) : undefined;
  const limitValue = typeof limit === "number" ? limit : undefined;
  return sdk.automation.logs(id, limitValue);
};

// ============================================================================
// Handler Registry - Share
// ============================================================================

const handleShareOpenModal: BridgeHandler = async ({ params, appId }) => {
  const [options] = params;
  const shareOptions =
    options && typeof options === "object" ? (options as { page?: string; params?: Record<string, string> }) : {};
  window.dispatchEvent(new CustomEvent("miniapp-share-request", { detail: { appId, ...shareOptions } }));
  return { success: true };
};

const handleShareGetUrl: BridgeHandler = async ({ sdk, params, appId }) => {
  const [options] = params;
  const shareOptions =
    options && typeof options === "object" ? (options as { page?: string; params?: Record<string, string> }) : {};
  const chainId = sdk.getConfig?.()?.chainId;
  return buildShareUrl(appId, chainId ?? undefined, shareOptions);
};

const handleShareCopy: BridgeHandler = async ({ sdk, params, appId }) => {
  const [options] = params;
  const shareOptions =
    options && typeof options === "object" ? (options as { page?: string; params?: Record<string, string> }) : {};
  const chainId = sdk.getConfig?.()?.chainId;
  const url = buildShareUrl(appId, chainId ?? undefined, shareOptions);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
};

// ============================================================================
// Handler Registry Map
// ============================================================================

const HANDLERS: Record<string, BridgeHandler> = {
  getConfig: handleGetConfig,
  "wallet.getAddress": handleGetAddress,
  getAddress: handleGetAddress,
  "wallet.invokeIntent": handleInvokeIntent,
  "wallet.switchChain": handleSwitchChain,
  invokeRead: handleInvokeRead,
  invokeFunction: handleInvokeFunction,
  "wallet.signMessage": handleSignMessage,
  "payments.payGAS": handlePayGAS,
  "payments.payGASAndInvoke": handlePayGASAndInvoke,
  "governance.vote": handleGovernanceVote,
  "governance.voteAndInvoke": handleGovernanceVoteAndInvoke,
  "governance.getCandidates": handleGetCandidates,
  "rng.requestRandom": handleRequestRandom,
  "datafeed.getPrice": handleGetPrice,
  "datafeed.getPrices": handleGetPrices,
  "datafeed.getNetworkStats": handleGetNetworkStats,
  "datafeed.getRecentTransactions": handleGetRecentTransactions,
  "stats.getMyUsage": handleGetMyUsage,
  "events.list": handleEventsList,
  "events.emit": handleEventsEmit,
  "transactions.list": handleTransactionsList,
  "automation.register": handleAutomationRegister,
  "automation.unregister": handleAutomationUnregister,
  "automation.status": handleAutomationStatus,
  "automation.list": handleAutomationList,
  "automation.update": handleAutomationUpdate,
  "automation.enable": handleAutomationEnable,
  "automation.disable": handleAutomationDisable,
  "automation.logs": handleAutomationLogs,
  "share.openModal": handleShareOpenModal,
  "share.getUrl": handleShareGetUrl,
  "share.copy": handleShareCopy,
};

// ============================================================================
// Main Dispatcher
// ============================================================================

export async function dispatchBridgeCall(
  sdk: MiniAppSDK,
  method: string,
  params: unknown[],
  permissions: MiniAppInfo["permissions"],
  appId: string,
  walletAddress?: string,
): Promise<unknown> {
  if (!hasPermission(method, permissions)) {
    throw new Error(`permission denied: ${method}`);
  }

  const handler = HANDLERS[method];
  if (!handler) {
    throw new Error(`unsupported method: ${method}`);
  }

  return handler({ sdk, params, appId, walletAddress });
}
