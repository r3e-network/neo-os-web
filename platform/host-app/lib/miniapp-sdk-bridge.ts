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
      return Boolean(permissions.payments);
    case "governance.vote":
      return Boolean(permissions.governance);
    case "rng.requestRandom":
      return Boolean(permissions.rng);
    case "datafeed.getPrice":
      return Boolean(permissions.datafeed);
    // Safe methods - no special permissions required (explicitly whitelisted)
    case "getConfig":
    case "wallet.getAddress":
    case "getAddress":
    case "wallet.invokeIntent":
    case "stats.getMyUsage":
    case "events.list":
    case "transactions.list":
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
    case "payments.payGAS": {
      if (!sdk.payments?.payGAS) throw new Error("payments.payGAS not available");
      const [requestedAppId, amount, memo] = params;
      const scopedAppId = resolveScopedAppId(requestedAppId, appId);
      const memoValue = memo === undefined || memo === null ? undefined : String(memo);
      return sdk.payments.payGAS(scopedAppId, String(amount ?? ""), memoValue);
    }
    case "governance.vote": {
      if (!sdk.governance?.vote) throw new Error("governance.vote not available");
      const [requestedAppId, proposalId, neoAmount, support] = params;
      const scopedAppId = resolveScopedAppId(requestedAppId, appId);
      const supportValue = typeof support === "boolean" ? support : undefined;
      return sdk.governance.vote(scopedAppId, String(proposalId ?? ""), String(neoAmount ?? ""), supportValue);
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
    case "transactions.list": {
      if (!sdk.transactions?.list) throw new Error("transactions.list not available");
      const [rawParams] = params;
      return sdk.transactions.list(normalizeListParams(rawParams, appId));
    }
    default:
      throw new Error(`unsupported method: ${method}`);
  }
}
