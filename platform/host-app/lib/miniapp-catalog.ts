import type { MiniAppInfo } from "@/components/types";
import { BUILTIN_APPS } from "./builtin-apps";
import { coerceMiniAppInfo } from "./miniapp";
import { loadMiniAppDefinitions } from "./miniapp-definitions";
import { logger } from "./logger";

type MiniAppStatus = "active" | "pending" | "disabled";

type LoadMiniAppCatalogOptions = {
  includeManifest?: boolean;
};

type MiniAppRow = {
  app_id?: string;
  name?: string;
  description?: string;
  icon?: string;
  category?: string;
  entry_url?: string;
  contract_hash?: string | null;
  status?: string | null;
  permissions?: Record<string, unknown> | null;
  limits?: Record<string, unknown> | null;
  news_integration?: boolean | null;
  stats_display?: string[] | null;
  logo_url?: string | null;
  banner_url?: string | null;
  docs_url?: string | null;
  manifest?: Record<string, unknown> | null;
};

type MiniAppStatsRow = {
  app_id?: string;
  total_users?: number;
  total_transactions?: number;
  total_gas_used?: string;
  daily_active_users?: number;
  last_activity_at?: string | null;
};

function getSupabaseURL(): string {
  return String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
}

function getSupabaseAuth(): Record<string, string> | null {
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (serviceRoleKey) {
    return {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    };
  }

  const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (anonKey) {
    return {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    };
  }

  return null;
}

async function fetchMiniAppsFromSupabase(status: MiniAppStatus, options: LoadMiniAppCatalogOptions = {}): Promise<MiniAppInfo[]> {
  if (process.env.NODE_ENV === "test") return [];
  const supabaseURL = getSupabaseURL();
  const authHeaders = getSupabaseAuth();
  if (!supabaseURL || !authHeaders) return [];

  const includeManifest = Boolean(options.includeManifest);
  const selectColumns = includeManifest
    ? "app_id,name,description,icon,category,entry_url,contract_hash,status,permissions,limits,news_integration,stats_display,logo_url,banner_url,docs_url,manifest"
    : "app_id,name,description,icon,category,entry_url,contract_hash,status,permissions,limits,news_integration,stats_display,logo_url,banner_url,docs_url";

  const params = new URLSearchParams({
    select: selectColumns,
    status: `eq.${status}`,
    order: "updated_at.desc",
    limit: "500",
  });

  try {
    const response = await fetch(`${supabaseURL}/rest/v1/miniapps?${params.toString()}`, {
      headers: authHeaders,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.warn(`miniapp catalog fetch failed: ${response.status} ${text}`);
      return [];
    }
    const rows = (await response.json()) as MiniAppRow[];
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => coerceMiniAppInfo(row))
      .filter((app): app is MiniAppInfo => Boolean(app))
      .map((app) => ({ ...app, source: "verified" as const }));
  } catch (error) {
    logger.warn("miniapp catalog fetch error:", error);
    return [];
  }
}

export async function loadMiniAppCatalog(
  status: MiniAppStatus = "active",
  options: LoadMiniAppCatalogOptions = {},
): Promise<MiniAppInfo[]> {
  const definitionApps = await loadMiniAppDefinitions();
  const mergedBuiltinsMap = new Map(BUILTIN_APPS.map((app) => [app.app_id, app]));
  for (const definitionApp of definitionApps) {
    const fallback = mergedBuiltinsMap.get(definitionApp.app_id);
    mergedBuiltinsMap.set(definitionApp.app_id, {
      ...(fallback || {}),
      ...definitionApp,
      source: "builtin",
    });
  }
  const mergedBuiltins = Array.from(mergedBuiltinsMap.values());
  const builtinById = new Map(mergedBuiltins.map((app) => [app.app_id, app]));
  const dbApps = await fetchMiniAppsFromSupabase(status, options);

  const merged: MiniAppInfo[] = [];
  const seen = new Set<string>();

  for (const app of dbApps) {
    const fallback = builtinById.get(app.app_id);
    merged.push({ ...(fallback || {}), ...app, source: app.source || "verified" });
    seen.add(app.app_id);
  }

  // Built-ins represent the active static catalog and should not leak into
  // pending/disabled status views.
  if (status === "active") {
    for (const builtin of mergedBuiltins) {
      if (seen.has(builtin.app_id)) continue;
      merged.push({ ...builtin, source: "builtin" });
    }
  }

  return merged;
}

export function filterCatalogByAppId(catalog: MiniAppInfo[], appId: string): MiniAppInfo | null {
  const normalized = String(appId || "").trim();
  if (!normalized) return null;
  return catalog.find((app) => app.app_id === normalized) || null;
}

export async function loadMiniAppStatsMap(): Promise<Record<string, {
  users: number;
  transactions: number;
  volume: number;
  lastActivityAt: string | null;
}>> {
  if (process.env.NODE_ENV === "test") return {};
  const supabaseURL = getSupabaseURL();
  const authHeaders = getSupabaseAuth();
  if (!supabaseURL || !authHeaders) return {};

  const params = new URLSearchParams({
    select: "app_id,total_users,total_transactions,total_gas_used,daily_active_users,last_activity_at",
    order: "updated_at.desc",
    limit: "500",
  });

  try {
    const response = await fetch(`${supabaseURL}/rest/v1/miniapp_stats?${params.toString()}`, {
      headers: authHeaders,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.warn(`miniapp stats fetch failed: ${response.status} ${text}`);
      return {};
    }

    const rows = (await response.json()) as MiniAppStatsRow[];
    if (!Array.isArray(rows)) return {};

    const map: Record<string, { users: number; transactions: number; volume: number; lastActivityAt: string | null }> = {};
    for (const row of rows) {
      const appId = String(row.app_id || "").trim();
      if (!appId) continue;
      const totalUsers = Number(row.total_users ?? row.daily_active_users ?? 0);
      const totalTransactions = Number(row.total_transactions ?? 0);
      const totalGasUsed = Number.parseFloat(String(row.total_gas_used ?? "0"));
      map[appId] = {
        users: Number.isFinite(totalUsers) ? totalUsers : 0,
        transactions: Number.isFinite(totalTransactions) ? totalTransactions : 0,
        volume: Number.isFinite(totalGasUsed) ? totalGasUsed : 0,
        lastActivityAt: row.last_activity_at || null,
      };
    }
    return map;
  } catch (error) {
    logger.warn("miniapp stats fetch error:", error);
    return {};
  }
}
