/**
 * SDK Bridge - Connects uni-app to the MiniApp SDK
 *
 * Refactored with centralized origin validation (SOLID: Single Responsibility)
 */

import type { MiniAppSDK, MiniAppSDKConfig, ChainId, ChainType } from "./types";
import { SDK_TIMEOUTS, PRODUCTION_ORIGINS, DEV_ORIGINS } from "./config";

declare global {
  interface Window {
    MiniAppSDK?: MiniAppSDK;
  }
}

// ============================================================================
// OriginValidator - Centralized origin validation (SOLID: Single Responsibility)
// ============================================================================

class OriginValidator {
  private readonly baseOrigins: Set<string>;
  private readonly dynamicOrigins: Set<string> = new Set();

  constructor() {
    this.baseOrigins = new Set([...PRODUCTION_ORIGINS, ...(process.env.NODE_ENV === "development" ? DEV_ORIGINS : [])]);
  }

  /** Get self origin safely */
  getSelfOrigin(): string | null {
    if (typeof window === "undefined") return null;
    try {
      const url = new URL(window.location.href);
      if (url.origin === "null") return null;
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.origin;
      }
    } catch {
      // ignore invalid URLs (e.g., about:blank)
    }
    return null;
  }

  /** Get referrer origin safely */
  getReferrerOrigin(): string | null {
    if (typeof document === "undefined" || !document.referrer) return null;
    try {
      return new URL(document.referrer).origin;
    } catch {
      return null;
    }
  }

  /** Get all valid origins (base + dynamic + contextual) */
  getAllowedOrigins(): Set<string> {
    const allowed = new Set(this.baseOrigins);

    // Add dynamic origins
    this.dynamicOrigins.forEach((o) => allowed.add(o));

    // Add referrer origin only if it's in baseOrigins (security fix)
    const referrer = this.getReferrerOrigin();
    if (referrer && this.baseOrigins.has(referrer)) {
      allowed.add(referrer);
    }

    // Add self origin
    const self = this.getSelfOrigin();
    if (self) allowed.add(self);

    // Add localhost origin in dev
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        allowed.add(window.location.origin);
      }
    }

    return allowed;
  }

  /** Check if origin is valid */
  isValid(origin: string): boolean {
    if (!origin || origin === "null") return false;
    return this.getAllowedOrigins().has(origin);
  }

  /** Get target origin for postMessage */
  getTargetOrigin(): string {
    // 1. Try referrer origin
    const referrer = this.getReferrerOrigin();
    if (referrer && this.baseOrigins.has(referrer)) {
      return referrer;
    }

    // 2. Try ancestor origins (iframe context)
    try {
      if (typeof window !== "undefined" && window.parent !== window && window.location.ancestorOrigins?.length > 0) {
        const ancestor = window.location.ancestorOrigins[0];
        if (this.baseOrigins.has(ancestor)) {
          return ancestor;
        }
      }
    } catch {
      // Cross-origin access blocked
    }

    // 3. Fall back to self origin
    const self = this.getSelfOrigin();
    if (self) return self;

    // 4. Check localhost
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        return window.location.origin;
      }
    }

    // 5. SECURITY: Fail-secure - throw error instead of falling back to production
    // This prevents accidental message leakage to unintended origins
    throw new Error("Cannot determine safe target origin - no valid origin found");
  }

  /** Get safe target origin (throws if unknown) */
  getSafeTargetOrigin(): string {
    try {
      const target = this.getTargetOrigin();
      if (target && target !== "null") {
        return target;
      }
    } catch {
      // fall through to strict mode
    }

    // SECURITY FIX: Never use "*" as target origin - this allows any parent window
    // to receive sensitive data. Instead, we require a known trusted origin.
    //
    // If running in an iframe without ancestorOrigins support (Safari):
    // - The host app should inject __MINIAPP_PARENT_ORIGIN__ before loading the MiniApp
    // - Or the MiniApp should only work with hosts that properly identify themselves
    if (typeof window !== "undefined" && window.parent !== window) {
      // Check for injected parent origin from host
      const injectedOrigin = window.__MINIAPP_PARENT_ORIGIN__;
      if (typeof injectedOrigin === "string" && injectedOrigin && this.baseOrigins.has(injectedOrigin)) {
        return injectedOrigin;
      }

      // Log warning for debugging (removed in production)
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[MiniApp SDK] Cannot determine parent origin. " +
          "Host app should set window.__MINIAPP_PARENT_ORIGIN__ before loading MiniApp iframe."
        );
      }

      // Fail secure - throw error instead of using "*"
      throw new Error(
        "Cannot communicate securely with parent - origin unknown. " +
        "Ensure host app sets __MINIAPP_PARENT_ORIGIN__ or uses a supported browser."
      );
    }

    // SECURITY: Fail-secure - reject unknown origins
    throw new Error("Cannot determine safe target origin - origin is null or undefined");
  }

  /** Add dynamic origin (for runtime additions) */
  addDynamicOrigin(origin: string): void {
    if (origin && origin !== "null") {
      this.dynamicOrigins.add(origin);
    }
  }
}

// Singleton instance
const originValidator = new OriginValidator();
let cachedConfig: MiniAppSDKConfig | null = null;

export function resolveLayout(config?: Partial<MiniAppSDKConfig>): "web" | "mobile" {
  const declared = config?.layout;
  if (declared === "web" || declared === "mobile") return declared;

  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const layoutParam = params.get("layout");
  if (layoutParam === "web" || layoutParam === "mobile") return layoutParam;
  if (window.ReactNativeWebView) return "mobile";
  }

  return "web";
}

/**
 * Validate SDK injection to prevent tampering
 * Check for either new interface (invoke/getConfig) or legacy interface (wallet/payments)
 */
function validateSDK(sdk: MiniAppSDK): boolean {
  if (!sdk || typeof sdk !== "object") return false;
  // New interface: invoke + getConfig
  const hasNewInterface = typeof sdk.invoke === "function" && typeof sdk.getConfig === "function";
  // Legacy interface: wallet or payments object
  const hasLegacyInterface = typeof sdk.wallet === "object" || typeof sdk.payments === "object";
  return hasNewInterface || hasLegacyInterface;
}

/**
 * Create a postMessage-based SDK proxy for cross-origin iframes
 */
function createPostMessageSDK(): MiniAppSDK {
  const safeTargetOrigin = originValidator.getSafeTargetOrigin();
  let requestId = 0;

  const invoke = (method: string, ...args: unknown[]): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      const id = `sdk-${++requestId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const timer = setTimeout(() => {
        window.removeEventListener("message", handler);
        reject(new Error("SDK invoke timeout"));
      }, SDK_TIMEOUTS.INVOKE);

      const handler = (event: MessageEvent) => {
        // Use centralized origin validation
        if (!originValidator.isValid(event.origin)) return;
        if (event.source !== window.parent) return;
        if (event.data?.type !== "miniapp_sdk_response") return;
        if (event.data?.id !== id) return;

        clearTimeout(timer);
        window.removeEventListener("message", handler);

        if (event.data.ok) {
          resolve(event.data.result);
        } else {
          reject(new Error(event.data.error || "SDK call failed"));
        }
      };

      window.addEventListener("message", handler);
      window.parent.postMessage({ type: "miniapp_sdk_request", id, method, params: args }, safeTargetOrigin);
    });
  };

  return {
    invoke,
    getConfig: () => {
      // Return cached config or fetch from host
      if (cachedConfig) {
        return { ...cachedConfig, layout: resolveLayout(cachedConfig) };
      }
      // Try to get config synchronously from window if available
      if (typeof window !== "undefined" && window.__MINIAPP_CONFIG__) {
        cachedConfig = window.__MINIAPP_CONFIG__;
        return { ...cachedConfig, layout: resolveLayout(cachedConfig ?? undefined) };
      }
      // Return default config (will be updated async)
      return {
        appId: "",
        contractAddress: null,
        chainId: null,
        chainType: undefined,
        supportedChains: [],
        layout: resolveLayout(),
        debug: false,
      };
    },
    getAddress: () => invoke("getAddress") as Promise<string>,
    wallet: {
      getAddress: () => invoke("wallet.getAddress") as Promise<string>,
      switchChain: (chainId: ChainId) => invoke("wallet.switchChain", chainId) as Promise<void>,
      invokeIntent: (requestId: string) => invoke("wallet.invokeIntent", requestId),
      signMessage: (message: string) => invoke("wallet.signMessage", message),
    },
    payments: {
      payGAS: (appId: string, amount: string, memo?: string) => invoke("payments.payGAS", appId, amount, memo),
      payGASAndInvoke: (appId: string, amount: string, memo?: string) =>
        invoke("payments.payGASAndInvoke", appId, amount, memo),
    },
    governance: {
      vote: (appId: string, proposalId: string, amount: string, support?: boolean) =>
        invoke("governance.vote", appId, proposalId, amount, support),
      voteAndInvoke: (appId: string, proposalId: string, amount: string, support?: boolean) =>
        invoke("governance.voteAndInvoke", appId, proposalId, amount, support),
      getCandidates: () => invoke("governance.getCandidates"),
    },
    rng: {
      requestRandom: (appId: string) => invoke("rng.requestRandom", appId),
    },
    datafeed: {
      getPrice: (symbol: string) => invoke("datafeed.getPrice", symbol),
      getPrices: () => invoke("datafeed.getPrices"),
      getNetworkStats: () => invoke("datafeed.getNetworkStats"),
      getRecentTransactions: (limit?: number) => invoke("datafeed.getRecentTransactions", limit),
    },
    stats: {
      getMyUsage: (appId: string, date?: string) => invoke("stats.getMyUsage", appId, date),
    },
    events: {
      list: (params?: Record<string, unknown>) => invoke("events.list", params),
      emit: (eventName: string, data?: Record<string, unknown>) => invoke("events.emit", eventName, data),
    },
    transactions: {
      list: (params?: Record<string, unknown>) => invoke("transactions.list", params),
    },
    automation: {
      register: (
        taskName: string,
        taskType: string,
        payload?: Record<string, unknown>,
        schedule?: { intervalSeconds?: number; maxRuns?: number },
      ) => invoke("automation.register", taskName, taskType, payload, schedule),
      unregister: (taskName: string) => invoke("automation.unregister", taskName),
      status: (taskName: string) => invoke("automation.status", taskName),
      list: () => invoke("automation.list"),
      update: (
        taskId: string,
        payload?: Record<string, unknown>,
        schedule?: { intervalSeconds?: number; cron?: string; maxRuns?: number },
      ) => invoke("automation.update", taskId, payload, schedule),
      enable: (taskId: string) => invoke("automation.enable", taskId),
      disable: (taskId: string) => invoke("automation.disable", taskId),
      logs: (taskId?: string, limit?: number) => invoke("automation.logs", taskId, limit),
    },
    share: {
      openModal: (options?: { page?: string; params?: Record<string, string> }) =>
        invoke("share.openModal", options),
      getUrl: (options?: { page?: string; params?: Record<string, string> }) =>
        invoke("share.getUrl", options) as Promise<string>,
      copy: (options?: { page?: string; params?: Record<string, string> }) =>
        invoke("share.copy", options) as Promise<boolean>,
    },
  } as MiniAppSDK;
}

/**
 * Wait for SDK to be ready
 */
export function waitForSDK(timeout = SDK_TIMEOUTS.SDK_INIT): Promise<MiniAppSDK> {
  return new Promise((resolve, reject) => {
    // SSR guard
    if (typeof window === "undefined") {
      reject(new Error("SDK not available in SSR"));
      return;
    }

    // Check if SDK is already injected
    if (window.MiniAppSDK) {
      if (!validateSDK(window.MiniAppSDK)) {
        reject(new Error("SDK validation failed"));
        return;
      }
      resolve(window.MiniAppSDK);
      return;
    }

    const timer = setTimeout(() => {
      window.removeEventListener("miniapp-sdk-ready", handler);
      // Fallback to postMessage-based SDK for cross-origin iframes
      if (window.parent !== window) {
        const proxySDK = createPostMessageSDK();
        window.MiniAppSDK = proxySDK;
        proxySDK
          .invoke("getConfig")
          .then((config) => {
            if (config && typeof config === "object") {
              cachedConfig = config as MiniAppSDKConfig;
            }
          })
          .catch(() => {
            // Ignore config fetch errors (host may not be ready)
          });
        resolve(proxySDK);
      } else {
        reject(new Error("SDK timeout"));
      }
    }, timeout);

    const handler = () => {
      clearTimeout(timer);
      window.removeEventListener("miniapp-sdk-ready", handler);
      if (window.MiniAppSDK) {
        if (!validateSDK(window.MiniAppSDK)) {
          reject(new Error("SDK validation failed"));
          return;
        }
        resolve(window.MiniAppSDK);
      } else {
        reject(new Error("SDK not found"));
      }
    };

    window.addEventListener("miniapp-sdk-ready", handler);
  });
}

/**
 * Create SDK bridge for H5 platform
 */
export function createH5Bridge(config: MiniAppSDKConfig): Promise<MiniAppSDK> {
  void config;
  return waitForSDK();
}

/**
 * Get SDK instance (sync, may be null)
 */
export function getSDKSync(): MiniAppSDK | null {
  if (typeof window === "undefined") return null;
  return window.MiniAppSDK ?? null;
}

/**
 * Wallet state from host app
 */
export interface HostWalletState {
  connected: boolean;
  address: string | null;
  chainId?: ChainId | null;
  chainType?: ChainType;
  balance?: {
    native: string;
    nativeSymbol?: string;
    governance?: string;
    governanceSymbol?: string;
  } | null;
  balances?: Record<string, string>;
}

type WalletStateListener = (state: HostWalletState) => void;
const walletStateListeners: Set<WalletStateListener> = new Set();
let currentWalletState: HostWalletState = { connected: false, address: null, balance: null };
let walletStateHandler: ((event: MessageEvent) => void) | null = null;
let walletStateInitialized = false;

/**
 * Subscribe to wallet state changes from host
 */
export function subscribeToWalletState(listener: WalletStateListener): () => void {
  walletStateListeners.add(listener);
  // Immediately call with current state
  listener(currentWalletState);
  return () => walletStateListeners.delete(listener);
}

/**
 * Get current wallet state
 */
export function getWalletState(): HostWalletState {
  return currentWalletState;
}

/**
 * Initialize wallet state listener (call once on app startup)
 * Returns cleanup function to remove the listener
 */
export function initWalletStateListener(): (() => void) | null {
  if (typeof window === "undefined") return null;

  // Prevent duplicate initialization
  if (walletStateInitialized && walletStateHandler) {
    return () => cleanupWalletStateListener();
  }

  walletStateHandler = (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    // Use centralized origin validation
    if (!originValidator.isValid(event.origin)) return;

    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "miniapp_config") {
      if (data.config && typeof data.config === "object") {
        cachedConfig = data.config as MiniAppSDKConfig;
      }
      return;
    }
    if (data.type !== "miniapp_wallet_state_change") return;

    currentWalletState = {
      connected: Boolean(data.connected),
      address: data.address || null,
      chainId: data.chainId ?? null,
      chainType: data.chainType ?? null,
      balance: data.balance || data.multiChainBalance || null,
      balances: data.balances || undefined,
    };

    // Notify all listeners
    walletStateListeners.forEach((listener) => {
      try {
        listener(currentWalletState);
      } catch (e) {
        console.error("[MiniApp SDK] Wallet state listener error:", e);
      }
    });
  };

  window.addEventListener("message", walletStateHandler);
  walletStateInitialized = true;

  return () => cleanupWalletStateListener();
}

/**
 * Cleanup wallet state listener (for testing/HMR)
 */
export function cleanupWalletStateListener(): void {
  if (typeof window === "undefined") return;
  if (walletStateHandler) {
    window.removeEventListener("message", walletStateHandler);
    walletStateHandler = null;
  }
  walletStateInitialized = false;
}

/**
 * Notify host that MiniApp is ready to receive messages
 */
function notifyHostReady(): void {
  if (typeof window === "undefined") return;
  const safeTargetOrigin = originValidator.getSafeTargetOrigin();
  try {
    window.parent.postMessage({ type: "miniapp_ready" }, safeTargetOrigin);
  } catch {
    // Ignore if not in iframe
  }
}

// Auto-initialize on module load
if (typeof window !== "undefined") {
  initWalletStateListener();
  // Notify host that MiniApp is ready after a short delay
  // to ensure all listeners are set up
  setTimeout(notifyHostReady, SDK_TIMEOUTS.READY_NOTIFY);
}

/**
 * Call SDK bridge method
 * @deprecated Use `waitForSDK().then(sdk => sdk.invoke(method, ...args))` instead
 */
export async function callBridge(method: string, ...args: unknown[]): Promise<unknown> {
  const sdk = await waitForSDK().catch(() => null);
  if (!sdk) {
    throw new Error("SDK not available");
  }
  return sdk.invoke(method, ...args);
}
