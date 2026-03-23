import type { MiniAppCategory, MiniAppInfo } from "../components/types";
import { resolveMiniAppEntryUrlOrManifest } from "./miniapp-entry-url";
import { withMiniAppCardAssets } from "./miniapp-media";
import { canonicalizeMiniAppId } from "./miniapp-id";
import { resolveMiniAppDetailConfig } from "./miniapp-template";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toString(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function normalizeNetworkKey(value: unknown): string {
  const raw = toString(value).trim().toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "neo-n3-mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet") return "neo-n3-testnet";
  return raw;
}

function resolveManifestTargetNetwork(manifest: Record<string, unknown>): string {
  const override = normalizeNetworkKey(
    process.env.NEO_TARGET_NETWORK
      ?? process.env.FLAGSHIP_NETWORK
      ?? process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK
      ?? process.env.NEXT_PUBLIC_FLAGSHIP_NETWORK,
  );
  if (override) return override;

  const defaultNetwork = normalizeNetworkKey(manifest.default_network);
  if (defaultNetwork) return defaultNetwork;

  if (Array.isArray(manifest.supported_networks)) {
    const firstSupported = manifest.supported_networks
      .map((entry) => normalizeNetworkKey(entry))
      .find(Boolean);
    if (firstSupported) return firstSupported;
  }

  const contracts = asObject(manifest.contracts);
  const firstContractNetwork = Object.keys(contracts)
    .map((entry) => normalizeNetworkKey(entry))
    .find(Boolean);
  return firstContractNetwork || "";
}

function resolveManifestContractHash(manifest: Record<string, unknown>): string {
  const contracts = asObject(manifest.contracts);
  const targetNetwork = resolveManifestTargetNetwork(manifest);
  if (targetNetwork) {
    const direct = toString(contracts[targetNetwork]).trim();
    if (direct) return direct;
  }

  const alternateKey = targetNetwork === "neo-n3-testnet"
    ? "testnet"
    : targetNetwork === "neo-n3-mainnet"
      ? "mainnet"
      : "";
  if (alternateKey) {
    const alternate = toString(contracts[alternateKey]).trim();
    if (alternate) return alternate;
  }

  return "";
}

function normalizeEntryUrl(raw: unknown, appId: string): string {
  return resolveMiniAppEntryUrlOrManifest(raw, appId);
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
  const aa = has("aa") || has("abstract_account") ? (raw.aa ?? raw.abstract_account) : fallback?.aa;

  return {
    payments: Boolean(payments),
    governance: Boolean(governance),
    randomness: Boolean(randomness),
    datafeed: Boolean(datafeed),
    confidential: Boolean(confidential),
    aa: Boolean(aa),
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
  if (raw === "active" || raw === "disabled" || raw === "pending" || raw === "beta") {
    return raw as MiniAppInfo["status"];
  }
  return fallback;
}

function normalizeSource(value: unknown, fallback?: MiniAppInfo["source"]): MiniAppInfo["source"] | undefined {
  const raw = toString(value).trim().toLowerCase();
  if (raw === "miniapp" || raw === "community" || raw === "verified") {
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
  const rawAppId = toString(obj.app_id ?? obj.appid ?? fallback?.app_id).trim();
  const appId = canonicalizeMiniAppId(rawAppId) || rawAppId;
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
  const manifestContractHash = resolveManifestContractHash(manifestCandidate);
  const contractHash = toString(
    manifestContractHash || (obj.contract_hash ?? manifestCandidate.contract_hash ?? fallback?.contract_hash ?? ""),
  ).trim();
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
    // Fall back to default when URL parsing fails (e.g., raw app-id string passed)
    if (!fallbackAppId) return null;
    return { remote: "miniapp", appId: fallbackAppId };
  }
}
