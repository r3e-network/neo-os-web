import { createMiniAppSDK } from "./sdk/client.js";
import type { MiniAppSDK, MiniAppSDKConfig } from "./sdk/types.js";

type MiniAppPermissions = {
  payments?: boolean;
  governance?: boolean;
  randomness?: boolean;
  datafeed?: boolean;
  automation?: boolean;
};

type InstallOptions = {
  appId?: string;
  permissions?: MiniAppPermissions;
  authToken?: string;
  apiKey?: string;
  getAuthToken?: () => Promise<string | undefined>;
  getAPIKey?: () => Promise<string | undefined>;
};

type CacheEntry = {
  cacheKey: string;
  sdk: MiniAppSDK;
};

const AUTH_TOKEN_STORAGE_KEY = "neo_miniapp_auth_jwt";

let cached: CacheEntry | null = null;

export function resolveEdgeBaseUrl(): string {
  const supabase = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (supabase) {
    const base = supabase.replace(/\/$/, "");
    return base.endsWith("/functions/v1") ? base : `${base}/functions/v1`;
  }

  return "/api/rpc";
}

function readStorageValue(key: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = window.localStorage.getItem(key);
    return value ? value : undefined;
  } catch {
    return undefined;
  }
}

function resolveAuthToken(options?: InstallOptions): (() => Promise<string | undefined>) | undefined {
  if (options?.getAuthToken) return options.getAuthToken;
  if (options?.authToken) {
    return async () => options.authToken;
  }
  return async () => readStorageValue(AUTH_TOKEN_STORAGE_KEY);
}

function resolveAPIKey(options?: InstallOptions): (() => Promise<string | undefined>) | undefined {
  if (options?.getAPIKey) return options.getAPIKey;
  if (options?.apiKey) {
    return async () => options.apiKey;
  }
  return undefined;
}

function buildConfig(options?: InstallOptions): MiniAppSDKConfig {
  return {
    edgeBaseUrl: resolveEdgeBaseUrl(),
    appId: options?.appId,
    getAuthToken: resolveAuthToken(options),
    getAPIKey: resolveAPIKey(options),
  };
}

function configKey(config: MiniAppSDKConfig): string {
  return `${config.edgeBaseUrl}::${config.appId || ""}`;
}

function permissionsKey(permissions?: MiniAppPermissions): string {
  if (!permissions) return "none";
  return [
    `payments:${permissions.payments ? 1 : 0}`,
    `governance:${permissions.governance ? 1 : 0}`,
    `randomness:${permissions.randomness ? 1 : 0}`,
    `datafeed:${permissions.datafeed ? 1 : 0}`,
    `automation:${permissions.automation ? 1 : 0}`,
  ].join("|");
}

function cacheKeyFor(config: MiniAppSDKConfig, permissions?: MiniAppPermissions): string {
  return `${configKey(config)}::${permissionsKey(permissions)}`;
}

function resolveAppId(requested: string | undefined, appId?: string): string | undefined {
  const clean = String(requested ?? "").trim();
  const scoped = String(appId ?? "").trim();
  if (!scoped) return clean || undefined;
  if (clean && clean !== scoped) {
    throw new Error("app_id mismatch");
  }
  return scoped;
}

function requirePermission(permissions: MiniAppPermissions | undefined, key: keyof MiniAppPermissions) {
  if (!permissions) return;
  if (!permissions[key]) {
    throw new Error(`permission denied: ${key}`);
  }
}

function scopeMiniAppSDK(sdk: MiniAppSDK, options?: InstallOptions): MiniAppSDK {
  const permissions = options?.permissions;
  const appId = options?.appId;
  if (!permissions && !appId) return sdk;

  const scoped: MiniAppSDK = {
    ...sdk,
    wallet: {
      ...sdk.wallet,
    },
    payments: {
      ...sdk.payments,
      payGAS: async (requestedAppId: string, amount: string, memo?: string) => {
        requirePermission(permissions, "payments");
        const resolved = resolveAppId(requestedAppId, appId);
        if (!resolved) throw new Error("app_id required");
        return sdk.payments!.payGAS!(resolved, amount, memo);
      },
      payGASAndInvoke: sdk.payments?.payGASAndInvoke
        ? async (requestedAppId: string, amount: string, memo?: string) => {
            requirePermission(permissions, "payments");
            const resolved = resolveAppId(requestedAppId, appId);
            if (!resolved) throw new Error("app_id required");
            return sdk.payments!.payGASAndInvoke!(resolved, amount, memo);
          }
        : undefined,
    },
    governance: {
      ...sdk.governance,
      vote: async (requestedAppId: string, proposalId: string, neoAmount: string, support?: boolean) => {
        requirePermission(permissions, "governance");
        const resolved = resolveAppId(requestedAppId, appId);
        if (!resolved) throw new Error("app_id required");
        return sdk.governance!.vote!(resolved, proposalId, neoAmount, support);
      },
      voteAndInvoke: sdk.governance?.voteAndInvoke
        ? async (requestedAppId: string, proposalId: string, neoAmount: string, support?: boolean) => {
            requirePermission(permissions, "governance");
            const resolved = resolveAppId(requestedAppId, appId);
            if (!resolved) throw new Error("app_id required");
            return sdk.governance!.voteAndInvoke!(resolved, proposalId, neoAmount, support);
          }
        : undefined,
    },
    rng: {
      ...sdk.rng,
      requestRandom: async (requestedAppId: string) => {
        requirePermission(permissions, "randomness");
        const resolved = resolveAppId(requestedAppId, appId);
        if (!resolved) throw new Error("app_id required");
        return sdk.rng!.requestRandom!(resolved);
      },
    },
    datafeed: {
      ...sdk.datafeed,
      getPrice: async (symbol: string) => {
        requirePermission(permissions, "datafeed");
        return sdk.datafeed!.getPrice!(symbol);
      },
    },
    stats: {
      ...sdk.stats,
      getMyUsage: async (requestedAppId?: string, date?: string) => {
        const resolved = resolveAppId(requestedAppId, appId) || appId || "";
        return sdk.stats!.getMyUsage!(resolved, date);
      },
    },
    events: {
      ...sdk.events,
      list: async (params: Record<string, unknown>) => {
        const resolved = resolveAppId(params?.app_id as string | undefined, appId);
        return sdk.events!.list!({ ...params, app_id: resolved });
      },
    },
    transactions: {
      ...sdk.transactions,
      list: async (params: Record<string, unknown>) => {
        const resolved = resolveAppId(params?.app_id as string | undefined, appId);
        return sdk.transactions!.list!({ ...params, app_id: resolved });
      },
    },
    automation: {
      register: async (
        taskName: string,
        taskType: string,
        payload?: Record<string, unknown>,
        schedule?: { intervalSeconds?: number; maxRuns?: number },
      ) => {
        requirePermission(permissions, "automation");
        const resolved = appId;
        if (!resolved) throw new Error("app_id required");
        const res = await fetch("/api/automation/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appId: resolved, taskName, taskType, payload, schedule }),
        });
        return res.json();
      },
      unregister: async (taskName: string) => {
        requirePermission(permissions, "automation");
        const resolved = appId;
        if (!resolved) throw new Error("app_id required");
        const res = await fetch("/api/automation/unregister", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appId: resolved, taskName }),
        });
        return res.json();
      },
      status: async (taskName: string) => {
        const resolved = appId;
        if (!resolved) throw new Error("app_id required");
        const res = await fetch(`/api/automation/status?appId=${resolved}&taskName=${taskName}`);
        return res.json();
      },
      list: async () => {
        const resolved = appId;
        const url = resolved ? `/api/automation/list?appId=${resolved}` : "/api/automation/list";
        const res = await fetch(url);
        return res.json();
      },
      update: async (
        taskId: string,
        payload?: Record<string, unknown>,
        schedule?: { intervalSeconds?: number; cron?: string; maxRuns?: number },
      ) => {
        requirePermission(permissions, "automation");
        const res = await fetch("/api/automation/update", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, payload, schedule }),
        });
        return res.json();
      },
      enable: async (taskId: string) => {
        requirePermission(permissions, "automation");
        const res = await fetch("/api/automation/enable", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId }),
        });
        return res.json();
      },
      disable: async (taskId: string) => {
        requirePermission(permissions, "automation");
        const res = await fetch("/api/automation/disable", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId }),
        });
        return res.json();
      },
      logs: async (taskId?: string, limit = 50) => {
        const params = new URLSearchParams();
        if (taskId) params.set("taskId", taskId);
        if (appId) params.set("appId", appId);
        params.set("limit", String(limit));
        const res = await fetch(`/api/automation/logs?${params}`);
        return res.json();
      },
    },
  };

  if (sdk.getAddress) {
    scoped.getAddress = sdk.getAddress.bind(sdk);
  }

  return scoped;
}

export function getMiniAppSDK(options?: InstallOptions): MiniAppSDK | null {
  if (typeof window === "undefined") return null;

  const config = buildConfig(options);
  const key = cacheKeyFor(config, options?.permissions);

  if (!cached || cached.cacheKey !== key) {
    const base = createMiniAppSDK(config);
    cached = { cacheKey: key, sdk: scopeMiniAppSDK(base, options) };
  }

  return cached.sdk;
}

export function installMiniAppSDK(options?: InstallOptions): MiniAppSDK | null {
  if (typeof window === "undefined") return null;

  const sdk = getMiniAppSDK(options);
  if (!sdk) return null;

  (window as any).MiniAppSDK = sdk;
  window.dispatchEvent(new Event("miniapp-sdk-ready"));
  return sdk;
}

export type { MiniAppSDK };
