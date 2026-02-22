import type { MiniAppCategory, MiniAppInfo } from "../components/types";
import { withMiniAppCardAssets } from "./miniapp-media";
import { resolveMiniAppDetailConfig } from "./miniapp-template";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

const MANIFEST_ENTRY_PREFIX = "mf://manifest?app=";

function toString(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function normalizeEntryUrl(raw: unknown, appId: string): string {
  const input = toString(raw).trim();
  if (!input) return `${MANIFEST_ENTRY_PREFIX}${encodeURIComponent(appId)}`;
  if (input.startsWith("mf://manifest?")) return input;
  return `${MANIFEST_ENTRY_PREFIX}${encodeURIComponent(appId)}`;
}

export function normalizeCategory(value: unknown): MiniAppCategory {
  const raw = toString(value).trim().toLowerCase();
  if (
    raw === "gaming" ||
    raw === "defi" ||
    raw === "governance" ||
    raw === "utility" ||
    raw === "social" ||
    raw === "nft" ||
    raw === "data" ||
    raw === "other"
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
  const randomness = has("randomness") || has("rng") ? (raw.randomness ?? raw.rng) : fallback?.randomness;
  const datafeed = has("datafeed") ? raw.datafeed : fallback?.datafeed;
  const confidential = has("confidential") ? raw.confidential : fallback?.confidential;

  return {
    payments: Boolean(payments),
    governance: Boolean(governance),
    randomness: Boolean(randomness),
    datafeed: Boolean(datafeed),
    confidential: Boolean(confidential),
  };
}

function normalizeLimits(value: unknown, fallback?: MiniAppInfo["limits"]): MiniAppInfo["limits"] | undefined {
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

function normalizeStatsDisplay(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const aliasMap: Record<string, string> = {
    tx_count: "total_transactions",
    gas_burned: "total_gas_used",
    gas_consumed: "total_gas_used",
  };
  const list = value
    .map((v) => toString(v).trim().toLowerCase())
    .filter(Boolean)
    .map((key) => aliasMap[key] ?? key);
  return Array.from(new Set(list));
}

export function normalizeStatus(value: unknown, fallback?: MiniAppInfo["status"]): MiniAppInfo["status"] | undefined {
  const raw = toString(value).trim().toLowerCase();
  if (raw === "active" || raw === "disabled" || raw === "pending") return raw as MiniAppInfo["status"];
  return fallback;
}

function normalizeSource(value: unknown, fallback?: MiniAppInfo["source"]): MiniAppInfo["source"] | undefined {
  const raw = toString(value).trim().toLowerCase();
  if (raw === "builtin" || raw === "community" || raw === "verified") {
    return raw as MiniAppInfo["source"];
  }
  return fallback;
}

function normalizeDeveloper(
  value: unknown,
  fallback?: MiniAppInfo["developer"],
  row?: Record<string, unknown>,
): MiniAppInfo["developer"] | undefined {
  const raw = asObject(value);
  const name = toString(raw.name ?? row?.developer_name ?? fallback?.name).trim();
  const address = toString(raw.address ?? row?.developer_address ?? fallback?.address).trim();
  const verifiedValue = raw.verified ?? row?.developer_verified ?? fallback?.verified;
  const verified = typeof verifiedValue === "boolean" ? verifiedValue : fallback?.verified;

  if (!name && !address) return fallback;
  return {
    name: name || "Unknown Developer",
    address,
    verified,
  };
}

export function coerceMiniAppInfo(raw: unknown, fallback?: MiniAppInfo): MiniAppInfo | null {
  const obj = asObject(raw);
  const manifestCandidate = asObject(obj.manifest ?? fallback?.manifest);
  const appId = toString(obj.app_id ?? obj.appid ?? fallback?.app_id).trim();
  if (!appId) return null;

  const entryUrl = normalizeEntryUrl(
    obj.entry_url ?? manifestCandidate.entry_url ?? fallback?.entry_url,
    appId,
  );
  if (!entryUrl) return null;

  const name = toString(obj.name ?? manifestCandidate.name ?? fallback?.name ?? appId).trim() || appId;
  const description = toString(obj.description ?? manifestCandidate.description ?? fallback?.description ?? "").trim();
  const icon = toString(obj.icon ?? manifestCandidate.icon ?? fallback?.icon ?? "🧩").trim() || "🧩";
  const category = normalizeCategory(obj.category ?? manifestCandidate.category ?? fallback?.category);
  const contractHash = toString(obj.contract_hash ?? manifestCandidate.contract_hash ?? fallback?.contract_hash ?? "").trim();
  const permissions = normalizePermissions(
    obj.permissions ?? manifestCandidate.permissions ?? fallback?.permissions,
    fallback?.permissions,
  );
  const limits = normalizeLimits(obj.limits ?? manifestCandidate.limits ?? fallback?.limits, fallback?.limits);
  const newsIntegrationRaw = obj.news_integration ?? manifestCandidate.news_integration ?? fallback?.news_integration;
  const newsIntegration = typeof newsIntegrationRaw === "boolean" ? newsIntegrationRaw : undefined;
  const statsDisplay = normalizeStatsDisplay(obj.stats_display ?? manifestCandidate.stats_display) ?? fallback?.stats_display;
  const status = normalizeStatus(obj.status, fallback?.status);
  const source = normalizeSource(obj.source, fallback?.source);
  const developer = normalizeDeveloper(obj.developer, fallback?.developer, obj);

  const detailConfig = resolveMiniAppDetailConfig(obj, {
    detailTemplate: fallback?.detail_template ?? null,
    operations: fallback?.operations ?? null,
    manifest: fallback?.manifest ?? null,
  });

  const logoUrl = toString(obj.logo_url ?? manifestCandidate.logo_url ?? fallback?.logo_url ?? "").trim() || null;
  const bannerUrl = toString(obj.banner_url ?? manifestCandidate.banner_url ?? fallback?.banner_url ?? "").trim() || null;
  const docsUrl = toString(obj.docs_url ?? manifestCandidate.docs_url ?? fallback?.docs_url ?? "").trim() || null;

  const app: MiniAppInfo = {
    app_id: appId,
    name,
    description,
    icon,
    logo_url: logoUrl,
    banner_url: bannerUrl,
    docs_url: docsUrl,
    category,
    entry_url: entryUrl,
    contract_hash: contractHash || null,
    status: status ?? null,
    source,
    developer,
    permissions,
    limits: limits ?? null,
    news_integration: newsIntegration ?? null,
    stats_display: statsDisplay ?? null,
    operations: detailConfig.operations.length > 0 ? detailConfig.operations : null,
    detail_template: detailConfig.detailTemplate,
    manifest: detailConfig.manifest,
  };

  return withMiniAppCardAssets(app);
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
