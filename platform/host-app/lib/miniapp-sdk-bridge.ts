/**
 * MiniApp SDK Bridge Dispatcher
 *
 * Shared bridge logic for dispatching SDK calls from MiniApp iframes.
 * Used by both /miniapps/[id] and /launch/[id] pages.
 */

import type { MiniAppSDK } from "./miniapp-sdk";
import type { MiniAppInfo } from "../components/types";

// ============================================================================
// Permission Checking
// ============================================================================

/**
 * Check if a method is allowed based on app permissions
 *
 * SECURITY: Default to DENY for unlisted methods (fail-secure).
 * Safe methods that don't require special permissions must be explicitly whitelisted.
 */
export function hasPermission(method: string, permissions: MiniAppInfo["permissions"]): boolean {
  if (!permissions) return false;
  switch (method) {
    // Methods requiring specific permissions
    case "payments.payGAS":
    case "payments.payGASAndInvoke":
      return Boolean(permissions.payments);
    case "governance.vote":
    case "governance.voteAndInvoke":
    case "governance.getCandidates":
      return Boolean(permissions.governance);
    case "rng.requestRandom":
      return Boolean(permissions.rng);
    case "datafeed.getPrice":
    case "datafeed.getPrices":
    case "datafeed.getNetworkStats":
    case "datafeed.getRecentTransactions":
      return Boolean(permissions.datafeed);
    case "wallet.signMessage":
      return Boolean(permissions.confidential);
    case "automation.register":
    case "automation.unregister":
    case "automation.status":
    case "automation.list":
    case "automation.update":
    case "automation.enable":
    case "automation.disable":
    case "automation.logs":
      return Boolean(permissions.automation);
    // Safe methods - no special permissions required (explicitly whitelisted)
    case "getConfig":
    case "wallet.getAddress":
    case "getAddress":
    case "wallet.switchChain":
    case "wallet.invokeIntent":
    case "invokeRead":
    case "invokeFunction":
    case "stats.getMyUsage":
    case "events.list":
    case "events.emit":
    case "transactions.list":
    case "share.openModal":
    case "share.getUrl":
    case "share.copy":
      return true;
    // SECURITY: Deny by default for any unlisted method
    default:
      return false;
  }
}

// ============================================================================
// App ID Scoping
// ============================================================================

/**
 * Resolve and validate scoped app ID
 */
export function resolveScopedAppId(requested: unknown, appId: string): string {
  const trimmed = String(requested ?? "").trim();
  if (trimmed && trimmed !== appId) {
    throw new Error("app_id mismatch");
  }
  return appId;
}

/**
 * Normalize list parameters with scoped app ID
 */
export function normalizeListParams(raw: unknown, appId: string): Record<string, unknown> {
  const base = raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  return { ...base, app_id: resolveScopedAppId(base.app_id, appId) };
}

// ============================================================================
// Origin Validation
// ============================================================================

/**
 * Resolve iframe origin from entry URL
 */
export function resolveIframeOrigin(entryUrl: string): string | null {
  const trimmed = String(entryUrl || "").trim();
  if (!trimmed || trimmed.startsWith("mf://")) return null;
  try {
    return new URL(trimmed, window.location.origin).origin;
  } catch {
    return null;
  }
}

// ============================================================================
// Bridge Call Dispatcher
// ============================================================================

/**
 * Dispatch SDK bridge calls from MiniApp iframe
 */
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

  switch (method) {
    case "getConfig": {
      if (!sdk.getConfig) throw new Error("getConfig not available");
      return sdk.getConfig();
    }
    case "wallet.getAddress":
    case "getAddress": {
      if (walletAddress) return walletAddress;
      if (sdk.wallet?.getAddress) return sdk.wallet.getAddress();
      if (sdk.getAddress) return sdk.getAddress();
      throw new Error("wallet.getAddress not available");
    }
    case "wallet.invokeIntent": {
      if (!sdk.wallet?.invokeIntent) throw new Error("wallet.invokeIntent not available");
      const [requestId] = params;
      return sdk.wallet.invokeIntent(String(requestId ?? ""));
    }
    case "wallet.switchChain": {
      const [chainId] = params;
      if (!chainId || typeof chainId !== "string") {
        throw new Error("chainId required");
      }
      if (sdk.wallet?.switchChain) {
        return sdk.wallet.switchChain(chainId);
      }
      const { useWalletStore } = await import("./wallet/store");
      await useWalletStore.getState().switchChain(chainId as import("./chains/types").ChainId);
      return true;
    }
    case "invokeRead":
    case "invokeFunction": {
      if (!sdk.invoke) throw new Error("invoke not available");
      const [payload] = params;
      if (!payload || typeof payload !== "object") {
        throw new Error(`${method} params required`);
      }
      return sdk.invoke(method, payload);
    }
    case "wallet.signMessage": {
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
    }
    case "payments.payGAS": {
      if (!sdk.payments?.payGAS) throw new Error("payments.payGAS not available");
      const [requestedAppId, amount, memo] = params;
      const scopedAppId = resolveScopedAppId(requestedAppId, appId);
      const memoValue = memo === undefined || memo === null ? undefined : String(memo);
      return sdk.payments.payGAS(scopedAppId, String(amount ?? ""), memoValue);
    }
    case "payments.payGASAndInvoke": {
      if (!sdk.payments?.payGASAndInvoke) throw new Error("payments.payGASAndInvoke not available");
      const [requestedAppId, amount, memo] = params;
      const scopedAppId = resolveScopedAppId(requestedAppId, appId);
      const memoValue = memo === undefined || memo === null ? undefined : String(memo);
      return sdk.payments.payGASAndInvoke(scopedAppId, String(amount ?? ""), memoValue);
    }
    case "governance.vote": {
      if (!sdk.governance?.vote) throw new Error("governance.vote not available");
      const [requestedAppId, proposalId, neoAmount, support] = params;
      const scopedAppId = resolveScopedAppId(requestedAppId, appId);
      const supportValue = typeof support === "boolean" ? support : undefined;
      return sdk.governance.vote(scopedAppId, String(proposalId ?? ""), String(neoAmount ?? ""), supportValue);
    }
    case "governance.voteAndInvoke": {
      if (!sdk.governance?.voteAndInvoke) throw new Error("governance.voteAndInvoke not available");
      const [requestedAppId, proposalId, neoAmount, support] = params;
      const scopedAppId = resolveScopedAppId(requestedAppId, appId);
      const supportValue = typeof support === "boolean" ? support : undefined;
      return sdk.governance.voteAndInvoke(scopedAppId, String(proposalId ?? ""), String(neoAmount ?? ""), supportValue);
    }
    case "governance.getCandidates": {
      if (!sdk.governance?.getCandidates) throw new Error("governance.getCandidates not available");
      return sdk.governance.getCandidates();
    }
    case "rng.requestRandom": {
      if (!sdk.rng?.requestRandom) throw new Error("rng.requestRandom not available");
      const [requestedAppId] = params;
      const scopedAppId = resolveScopedAppId(requestedAppId, appId);
      return sdk.rng.requestRandom(scopedAppId);
    }
    case "datafeed.getPrice": {
      if (!sdk.datafeed?.getPrice) throw new Error("datafeed.getPrice not available");
      const [symbol] = params;
      return sdk.datafeed.getPrice(String(symbol ?? ""));
    }
    case "datafeed.getPrices": {
      if (!sdk.datafeed?.getPrices) throw new Error("datafeed.getPrices not available");
      return sdk.datafeed.getPrices();
    }
    case "datafeed.getNetworkStats": {
      if (!sdk.datafeed?.getNetworkStats) throw new Error("datafeed.getNetworkStats not available");
      return sdk.datafeed.getNetworkStats();
    }
    case "datafeed.getRecentTransactions": {
      if (!sdk.datafeed?.getRecentTransactions) throw new Error("datafeed.getRecentTransactions not available");
      const [limit] = params;
      const limitValue = typeof limit === "number" ? limit : undefined;
      return sdk.datafeed.getRecentTransactions(limitValue);
    }
    case "stats.getMyUsage": {
      if (!sdk.stats?.getMyUsage) throw new Error("stats.getMyUsage not available");
      const [requestedAppId, date] = params;
      const resolvedAppId = resolveScopedAppId(requestedAppId, appId);
      const dateValue = date === undefined || date === null ? undefined : String(date);
      return sdk.stats.getMyUsage(resolvedAppId, dateValue);
    }
    case "events.list": {
      if (!sdk.events?.list) throw new Error("events.list not available");
      const [rawParams] = params;
      return sdk.events.list(normalizeListParams(rawParams, appId));
    }
    case "events.emit": {
      if (!sdk.events?.emit) throw new Error("events.emit not available");
      const [eventName, data] = params;
      const name = String(eventName ?? "").trim();
      if (!name) throw new Error("eventName required");
      const payload = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
      return sdk.events.emit(name, payload);
    }
    case "transactions.list": {
      if (!sdk.transactions?.list) throw new Error("transactions.list not available");
      const [rawParams] = params;
      return sdk.transactions.list(normalizeListParams(rawParams, appId));
    }
    case "automation.register": {
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
    }
    case "automation.unregister": {
      if (!sdk.automation?.unregister) throw new Error("automation.unregister not available");
      const [taskName] = params;
      const name = String(taskName ?? "").trim();
      if (!name) throw new Error("taskName required");
      return sdk.automation.unregister(name);
    }
    case "automation.status": {
      if (!sdk.automation?.status) throw new Error("automation.status not available");
      const [taskName] = params;
      const name = String(taskName ?? "").trim();
      if (!name) throw new Error("taskName required");
      return sdk.automation.status(name);
    }
    case "automation.list": {
      if (!sdk.automation?.list) throw new Error("automation.list not available");
      return sdk.automation.list();
    }
    case "automation.update": {
      if (!sdk.automation?.update) throw new Error("automation.update not available");
      const [taskId, payload, schedule] = params;
      const id = String(taskId ?? "").trim();
      if (!id) throw new Error("taskId required");
      return sdk.automation.update(
        id,
        payload && typeof payload === "object" ? (payload as Record<string, unknown>) : undefined,
        schedule && typeof schedule === "object" ? (schedule as { intervalSeconds?: number; cron?: string; maxRuns?: number }) : undefined,
      );
    }
    case "automation.enable": {
      if (!sdk.automation?.enable) throw new Error("automation.enable not available");
      const [taskId] = params;
      const id = String(taskId ?? "").trim();
      if (!id) throw new Error("taskId required");
      return sdk.automation.enable(id);
    }
    case "automation.disable": {
      if (!sdk.automation?.disable) throw new Error("automation.disable not available");
      const [taskId] = params;
      const id = String(taskId ?? "").trim();
      if (!id) throw new Error("taskId required");
      return sdk.automation.disable(id);
    }
    case "automation.logs": {
      if (!sdk.automation?.logs) throw new Error("automation.logs not available");
      const [taskId, limit] = params;
      const id = taskId ? String(taskId) : undefined;
      const limitValue = typeof limit === "number" ? limit : undefined;
      return sdk.automation.logs(id, limitValue);
    }
    case "share.openModal": {
      // Dispatch custom event that the page will handle
      const [options] = params;
      const shareOptions = options && typeof options === "object" ? options as { page?: string; params?: Record<string, string> } : {};
      const event = new CustomEvent("miniapp-share-request", {
        detail: { appId, ...shareOptions }
      });
      window.dispatchEvent(event);
      return { success: true };
    }
    case "share.getUrl": {
      const [options] = params;
      const shareOptions = options && typeof options === "object" ? options as { page?: string; params?: Record<string, string> } : {};
      const config = sdk.getConfig?.();
      const chainId = config?.chainId;
      const baseUrl = `${window.location.origin}/miniapps/${appId}`;
      const queryParams = new URLSearchParams();
      if (chainId) queryParams.set("chain", chainId);
      if (shareOptions.page) queryParams.set("page", shareOptions.page);
      if (shareOptions.params) {
        for (const [key, value] of Object.entries(shareOptions.params)) {
          queryParams.set(key, value);
        }
      }
      const queryString = queryParams.toString();
      return queryString ? `${baseUrl}?${queryString}` : baseUrl;
    }
    case "share.copy": {
      const [options] = params;
      const shareOptions = options && typeof options === "object" ? options as { page?: string; params?: Record<string, string> } : {};
      const config = sdk.getConfig?.();
      const chainId = config?.chainId;
      const baseUrl = `${window.location.origin}/miniapps/${appId}`;
      const queryParams = new URLSearchParams();
      if (chainId) queryParams.set("chain", chainId);
      if (shareOptions.page) queryParams.set("page", shareOptions.page);
      if (shareOptions.params) {
        for (const [key, value] of Object.entries(shareOptions.params)) {
          queryParams.set(key, value);
        }
      }
      const queryString = queryParams.toString();
      const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;
      try {
        await navigator.clipboard.writeText(url);
        return true;
      } catch {
        return false;
      }
    }
    default:
      throw new Error(`unsupported method: ${method}`);
  }
}
