// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, notFoundError } from "../_shared/error-codes.ts";
import { supabaseClient, supabaseServiceClient } from "../_shared/supabase.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";

type MiniAppMetaRow = {
  app_id: string;
  entry_url?: string;
  supported_chains?: string[];
  contracts?: Record<string, unknown>;
  name?: string;
  description?: string;
  icon?: string;
  banner?: string;
  category?: string;
  permissions?: Record<string, unknown>;
  limits?: Record<string, unknown>;
  manifest?: Record<string, unknown>;
  status?: string;
};

type MiniAppStatsRow = Record<string, unknown> & { app_id: string };

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeCategory(value: unknown): string {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
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

function normalizePermissions(value: unknown): Record<string, boolean> {
  const raw = asObject(value);
  return {
    payments: Boolean(raw.payments),
    governance: Boolean(raw.governance),
    rng: Boolean(raw.rng),
    datafeed: Boolean(raw.datafeed),
  };
}

function normalizeLimits(value: unknown): Record<string, string> | undefined {
  const raw = asObject(value);
  const out: Record<string, string> = {};
  if (raw.max_gas_per_tx !== undefined) out.max_gas_per_tx = String(raw.max_gas_per_tx);
  if (raw.daily_gas_cap_per_user !== undefined) out.daily_gas_cap_per_user = String(raw.daily_gas_cap_per_user);
  if (raw.governance_cap !== undefined) out.governance_cap = String(raw.governance_cap);
  return Object.keys(out).length > 0 ? out : undefined;
}

function resolveContractAddress(
  meta: MiniAppMetaRow | undefined,
  manifest: Record<string, unknown>,
  chainId: string
): string {
  const normalize = (value: unknown) => String(value ?? "").trim();
  const contracts = (meta?.contracts ?? manifest.contracts ?? {}) as Record<string, unknown>;
  if (chainId && contracts && typeof contracts === "object") {
    const entry = contracts[chainId] as Record<string, unknown> | undefined;
    if (entry && typeof entry === "object") {
      const address = normalize(entry.address);
      if (address) return address;
    }
  }
  return "";
}

function mergeStatsWithMeta(stats: MiniAppStatsRow, meta?: MiniAppMetaRow): Record<string, unknown> {
  const fallback = {
    name: String(stats.app_id ?? "").trim(),
    description: "",
    icon: "",
    banner: "",
    category: "utility",
    entry_url: "",
    contract_address: "",
    supported_chains: [],
    contracts: {},
    permissions: {},
    limits: undefined,
    news_integration: undefined,
    stats_display: undefined,
    status: undefined,
  };

  if (!meta) return { ...stats, ...fallback };

  const manifest = asObject(meta.manifest);
  const name = String(meta.name ?? manifest.name ?? meta.app_id ?? stats.app_id ?? "").trim();
  const description = String(meta.description ?? manifest.description ?? "").trim();
  const icon = String(meta.icon ?? manifest.icon ?? "").trim();
  const banner = String(meta.banner ?? manifest.banner ?? "").trim();
  const entryUrl = String(meta.entry_url ?? manifest.entry_url ?? "").trim();
  const chainId = String((stats as Record<string, unknown>).chain_id ?? "").trim();
  const contractAddress = resolveContractAddress(meta, manifest, chainId);
  const category = String(meta.category ?? manifest.category ?? "").trim();
  const permissions = normalizePermissions(meta.permissions ?? manifest.permissions);
  const limits = normalizeLimits(meta.limits ?? manifest.limits);
  const supportedChains =
    (meta.supported_chains as string[] | undefined) ?? (manifest.supported_chains as string[] | undefined) ?? [];
  const contracts = (meta.contracts ?? manifest.contracts ?? {}) as Record<string, unknown>;
  const newsIntegration =
    typeof manifest.news_integration === "boolean" ? (manifest.news_integration as boolean) : undefined;
  const statsDisplay = Array.isArray(manifest.stats_display)
    ? (manifest.stats_display as unknown[]).map((v) => String(v ?? "").trim()).filter(Boolean)
    : undefined;
  const statusRaw = String(meta.status ?? "")
    .trim()
    .toLowerCase();
  const status =
    statusRaw === "disabled" || statusRaw === "pending" ? statusRaw : statusRaw === "active" ? "active" : undefined;

  return {
    ...stats,
    name,
    description,
    icon,
    banner,
    category: normalizeCategory(category),
    entry_url: entryUrl,
    contract_address: contractAddress,
    supported_chains: supportedChains,
    contracts,
    permissions,
    limits,
    news_integration: newsIntegration,
    stats_display: statsDisplay,
    status,
  };
}

async function loadMiniAppMeta(appIds: string[]): Promise<Record<string, MiniAppMetaRow>> {
  if (appIds.length === 0) return {};
  let supabase;
  try {
    supabase = supabaseServiceClient();
  } catch (err) {
    console.warn("miniapp-stats: service client unavailable, skipping manifest merge", err);
    return {};
  }

  const { data, error: err } = await supabase
    .from("miniapps")
    .select(
      "app_id, entry_url, supported_chains, contracts, name, description, icon, banner, category, permissions, limits, manifest, status"
    )
    .in("app_id", appIds);

  if (err || !data) {
    console.warn("miniapp-stats: failed to load miniapp metadata", err?.message ?? err);
    return {};
  }

  const map: Record<string, MiniAppMetaRow> = {};
  for (const row of data as MiniAppMetaRow[]) {
    map[row.app_id] = row;
  }
  return map;
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  // Rate limiting for public endpoint
  const rateLimited = await requireRateLimit(req, "miniapp-stats");
  if (rateLimited) return rateLimited;

  const url = new URL(req.url);
  const appId = url.searchParams.get("app_id");
  const chainId = url.searchParams.get("chain_id");

  const supabase = supabaseClient();

  if (appId) {
    let query = supabase.from("miniapp_stats").select("*").eq("app_id", appId);
    if (chainId) {
      const { data, error: err } = await query.eq("chain_id", chainId).single();
      if (err) return notFoundError("app", req);
      const metaMap = await loadMiniAppMeta([appId]);
      const merged = mergeStatsWithMeta(data as MiniAppStatsRow, metaMap[appId]);
      return json(merged, req);
    }
    const { data, error: err } = await query.order("chain_id", { ascending: true });
    if (err) return notFoundError("app", req);
    const rows = (data ?? []) as MiniAppStatsRow[];
    const metaMap = await loadMiniAppMeta([appId]);
    const merged = rows.map((row) => mergeStatsWithMeta(row, metaMap[appId]));
    return json({ stats: merged }, req);
  }

  // All apps stats
  let allQuery = supabase.from("miniapp_stats").select("*");
  if (chainId) {
    allQuery = allQuery.eq("chain_id", chainId);
  }
  const { data, error: err } = await allQuery.order("total_transactions", { ascending: false }).limit(50);

  if (err) return errorResponse("SERVER_002", { message: err.message }, req);
  const statsRows = (data ?? []) as MiniAppStatsRow[];
  const appIds = Array.from(new Set(statsRows.map((row) => row.app_id).filter(Boolean)));
  const metaMap = await loadMiniAppMeta(appIds);
  const merged = statsRows.map((row) => mergeStatsWithMeta(row, metaMap[row.app_id]));
  const filtered = merged.filter((row) => {
    const status = String((row as Record<string, unknown>).status ?? "").toLowerCase();
    return status === "" || status === "active";
  });
  return json({ stats: filtered }, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
