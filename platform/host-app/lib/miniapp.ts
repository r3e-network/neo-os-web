import type { MiniAppCategory, MiniAppInfo } from "../components/types";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toString(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

export function normalizeCategory(value: unknown): MiniAppCategory {
  const raw = toString(value).trim().toLowerCase();
  if (raw === "gaming" || raw === "defi" || raw === "governance" || raw === "utility" || raw === "social") {
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
  const randomness = has("randomness") || has("rng") ? (raw.randomness ?? raw.rng) : fallback?.randomness;
  const datafeed = has("datafeed") ? raw.datafeed : fallback?.datafeed;

  return {
    payments: Boolean(payments),
    governance: Boolean(governance),
    randomness: Boolean(randomness),
    datafeed: Boolean(datafeed),
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

export function coerceMiniAppInfo(raw: unknown, fallback?: MiniAppInfo): MiniAppInfo | null {
  const obj = asObject(raw);
  const appId = toString(obj.app_id ?? obj.appid ?? fallback?.app_id).trim();
  if (!appId) return null;

  const entryUrl = toString(obj.entry_url ?? fallback?.entry_url).trim();
  if (!entryUrl) return null;

  const name = toString(obj.name ?? fallback?.name ?? appId).trim() || appId;
  const description = toString(obj.description ?? fallback?.description ?? "").trim();
  const icon = toString(obj.icon ?? fallback?.icon ?? "🧩").trim() || "🧩";
  const category = normalizeCategory(obj.category ?? fallback?.category);
  const contractHash = toString(obj.contract_hash ?? fallback?.contract_hash ?? "").trim();
  const permissions = normalizePermissions(obj.permissions ?? fallback?.permissions, fallback?.permissions);
  const limits = normalizeLimits(obj.limits ?? fallback?.limits, fallback?.limits);
  const newsIntegration =
    typeof obj.news_integration === "boolean" ? (obj.news_integration as boolean) : fallback?.news_integration;
  const statsDisplay = normalizeStatsDisplay(obj.stats_display) ?? fallback?.stats_display;
  const status = normalizeStatus(obj.status, fallback?.status);

  return {
    app_id: appId,
    name,
    description,
    icon,
    category,
    entry_url: entryUrl,
    contract_hash: contractHash || null,
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
