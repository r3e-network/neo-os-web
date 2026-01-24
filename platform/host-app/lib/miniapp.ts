import type { MiniAppCategory, MiniAppInfo, MiniAppChainContracts } from "../components/types";
import type { ChainId } from "./chains/types";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toString(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function isSafeEntryUrl(entryUrl: string): boolean {
  if (!entryUrl) return false;
  if (entryUrl.startsWith("mf://")) return true;
  if (entryUrl.startsWith("/") || entryUrl.startsWith("./")) return true;
  if (entryUrl.startsWith("//")) return false;
  try {
    const url = new URL(entryUrl);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeCategory(value: unknown): MiniAppCategory {
  const raw = toString(value).trim().toLowerCase();
  if (
    raw === "gaming" ||
    raw === "defi" ||
    raw === "governance" ||
    raw === "utility" ||
    raw === "social" ||
    raw === "nft"
  ) {
    return raw;
  }
  return "utility";
}

export function normalizePermissions(
  value: unknown,
  fallback?: MiniAppInfo["permissions"],
): MiniAppInfo["permissions"] {
  const raw = asObject(value);
  const has = (key: string) => Object.prototype.hasOwnProperty.call(raw, key);
  const payments = has("payments") ? raw.payments : fallback?.payments;
  const governance = has("governance") ? raw.governance : fallback?.governance;
  const rng = has("rng") ? raw.rng : fallback?.rng;
  const datafeed = has("datafeed") ? raw.datafeed : fallback?.datafeed;
  const confidential = has("confidential") ? raw.confidential : fallback?.confidential;
  const automation = has("automation") ? raw.automation : fallback?.automation;

  return {
    payments: Boolean(payments),
    governance: Boolean(governance),
    rng: Boolean(rng),
    datafeed: Boolean(datafeed),
    confidential: Boolean(confidential),
    automation: Boolean(automation),
  };
}

export function normalizeLimits(value: unknown, fallback?: MiniAppInfo["limits"]): MiniAppInfo["limits"] | undefined {
  const raw = asObject(value);
  const out: MiniAppInfo["limits"] = {};
  if (raw.max_gas_per_tx !== undefined) out.max_gas_per_tx = toString(raw.max_gas_per_tx);
  if (raw.daily_gas_cap_per_user !== undefined) out.daily_gas_cap_per_user = toString(raw.daily_gas_cap_per_user);
  if (raw.governance_cap !== undefined) out.governance_cap = toString(raw.governance_cap);

  if (Object.keys(out).length === 0) {
    return fallback && Object.keys(fallback).length > 0 ? fallback : undefined;
  }
  return out;
}

export function normalizeStatsDisplay(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value.map((v) => toString(v).trim()).filter(Boolean);
  return list;
}

export function normalizeStatus(value: unknown, fallback?: MiniAppInfo["status"]): MiniAppInfo["status"] | undefined {
  const raw = toString(value).trim().toLowerCase();
  if (raw === "active" || raw === "disabled" || raw === "pending") return raw as MiniAppInfo["status"];
  return fallback;
}

// ============================================================================
// Multi-Chain Normalization
// ============================================================================

/** Valid chain ID pattern */
const CHAIN_ID_PATTERN = /^[a-z0-9]+-[a-z0-9]+(-[a-z0-9]+)?$/;

function isValidChainId(value: unknown): value is ChainId {
  if (typeof value !== "string") return false;
  return CHAIN_ID_PATTERN.test(value);
}

/**
 * Normalize supportedChains array from raw data
 */
export function normalizeSupportedChains(value: unknown): ChainId[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const chains = value.map((v) => toString(v).trim().toLowerCase()).filter(isValidChainId);
  return chains.length > 0 ? chains : undefined;
}

/**
 * Normalize chainContracts mapping from raw data
 * Supports both "contracts" (manifest format) and "chainContracts" (host format)
 */
export function normalizeChainContracts(value: unknown): MiniAppChainContracts | undefined {
  const obj = asObject(value);
  if (Object.keys(obj).length === 0) return undefined;

  const result: MiniAppChainContracts = {};
  for (const [chainId, config] of Object.entries(obj)) {
    if (!isValidChainId(chainId)) continue;
    const configObj = asObject(config);
    const address = toString(configObj.address ?? "").trim() || null;
    result[chainId] = {
      address,
      active: configObj.active !== false,
      entryUrl: toString(configObj.entryUrl ?? configObj.entry_url ?? "").trim() || undefined,
    };
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Get contract address for a specific chain
 * Apps must use chainContracts for multi-chain support
 * Returns null if chainId is null or no contract configured for the chain
 */
export function getContractForChain(app: MiniAppInfo, chainId: ChainId | null): string | null {
  if (!chainId) return null;
  const contract = app.chainContracts?.[chainId];
  if (contract && contract.active !== false && contract.address) {
    return contract.address;
  }
  return null;
}

/**
 * Check if app supports a specific chain
 * Apps must explicitly declare supported chains via supportedChains or chainContracts
 */
export function isChainSupported(app: MiniAppInfo, chainId: ChainId): boolean {
  if (app.supportedChains?.includes(chainId)) return true;
  const contract = app.chainContracts?.[chainId];
  if (contract && contract.active !== false) return true;
  return false;
}

/**
 * Get all supported chains for an app
 * Returns chains from supportedChains array and chainContracts keys
 */
export function getAllSupportedChains(app: MiniAppInfo): ChainId[] {
  const chains = new Set<ChainId>();

  // Add from supportedChains array
  if (app.supportedChains) {
    app.supportedChains.forEach((c) => chains.add(c));
  }

  // Add from chainContracts keys
  if (app.chainContracts) {
    Object.entries(app.chainContracts).forEach(([chainId, contract]) => {
      if (contract?.active === false) return;
      chains.add(chainId as ChainId);
    });
  }

  return Array.from(chains);
}

/**
 * Resolve the effective chain ID for a MiniApp.
 * Falls back to the first supported chain if the requested chain is not supported.
 */
export function resolveChainIdForApp(app: MiniAppInfo, requested?: ChainId | null): ChainId | null {
  const supported = getAllSupportedChains(app);
  if (requested && supported.includes(requested)) return requested;
  return supported[0] ?? null;
}

/**
 * Get chain-specific entry URL if provided in chainContracts; fall back to app entry_url.
 */
export function getEntryUrlForChain(app: MiniAppInfo, chainId?: ChainId | null): string {
  if (chainId) {
    const contract = app.chainContracts?.[chainId];
    if (contract && contract.active !== false && contract.entryUrl) {
      return contract.entryUrl;
    }
  }
  return app.entry_url;
}

export function coerceMiniAppInfo(raw: unknown, fallback?: MiniAppInfo): MiniAppInfo | null {
  const obj = asObject(raw);
  const appId = toString(obj.app_id ?? obj.appid ?? fallback?.app_id).trim();
  if (!appId) return null;

  const entryUrl = toString(obj.entry_url ?? fallback?.entry_url).trim();
  if (!entryUrl || !isSafeEntryUrl(entryUrl)) return null;

  const name = toString(obj.name ?? fallback?.name ?? appId).trim() || appId;
  const description = toString(obj.description ?? fallback?.description ?? "").trim();
  const icon = toString(obj.icon ?? fallback?.icon ?? "🧩").trim() || "🧩";
  const category = normalizeCategory(obj.category ?? fallback?.category);
  const permissions = normalizePermissions(obj.permissions ?? fallback?.permissions, fallback?.permissions);
  const limits = normalizeLimits(obj.limits ?? fallback?.limits, fallback?.limits);

  // Multi-chain support: normalize supportedChains and chainContracts
  const supportedChains =
    normalizeSupportedChains(obj.supportedChains ?? obj.supported_chains ?? fallback?.supportedChains) ?? [];
  // Support both "contracts" (manifest format) and "chainContracts" (host format)
  const chainContracts = normalizeChainContracts(obj.chainContracts ?? obj.contracts ?? fallback?.chainContracts);

  const newsIntegration =
    typeof obj.news_integration === "boolean" ? (obj.news_integration as boolean) : fallback?.news_integration;
  const statsDisplay = normalizeStatsDisplay(obj.stats_display) ?? fallback?.stats_display;
  const status = normalizeStatus(obj.status, fallback?.status);

  // Self-contained i18n fields
  const nameZh = toString(obj.name_zh ?? fallback?.name_zh ?? "").trim() || undefined;
  const descriptionZh = toString(obj.description_zh ?? fallback?.description_zh ?? "").trim() || undefined;
  const banner = toString(obj.banner ?? fallback?.banner ?? "").trim() || undefined;

  return {
    app_id: appId,
    name,
    name_zh: nameZh,
    description,
    description_zh: descriptionZh,
    icon,
    banner,
    category,
    entry_url: entryUrl,
    // Multi-chain fields - supportedChains is required
    supportedChains,
    chainContracts,
    status: status ?? null,
    permissions,
    limits: limits ?? null,
    news_integration: newsIntegration ?? null,
    stats_display: statsDisplay ?? null,
  };
}

export type FederatedEntry = {
  remote: string;
  appId: string;
  view?: string;
};

export function parseFederatedEntryUrl(entryUrl: string, fallbackAppId: string): FederatedEntry | null {
  const raw = toString(entryUrl).trim();
  if (!raw.startsWith("mf://")) return null;

  const normalized = raw.replace(/^mf:\/\//, "https://");
  try {
    const url = new URL(normalized);
    const remote = url.host.trim();
    if (!remote) return null;
    const appId = url.searchParams.get("app")?.trim() || fallbackAppId;
    const view = url.searchParams.get("view")?.trim() || undefined;
    return { remote, appId, view };
  } catch {
    if (!fallbackAppId) return null;
    return { remote: "builtin", appId: fallbackAppId };
  }
}

export function buildMiniAppEntryUrl(entryUrl: string, params: Record<string, string>): string {
  const raw = toString(entryUrl).trim();
  if (!raw) return raw;

  const [base, hash] = raw.split("#");
  const [path, query] = base.split("?");
  const searchParams = new URLSearchParams(query ?? "");

  Object.entries(params).forEach(([key, value]) => {
    if (!key) return;
    searchParams.set(key, String(value));
  });

  const queryString = searchParams.toString();
  const assembled = queryString ? `${path}?${queryString}` : path;
  return hash ? `${assembled}#${hash}` : assembled;
}
