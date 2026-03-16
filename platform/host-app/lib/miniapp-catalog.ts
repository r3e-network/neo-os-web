import type { MiniAppInfo } from "@/components/types";
import { MINIAPP_REGISTRY } from "./miniapp-registry";
import { coerceMiniAppInfo } from "./miniapp";
import { loadMiniAppDefinitions } from "./miniapp-definitions";
import { canonicalizeMiniAppId } from "./miniapp-id";
import { logger } from "./logger";
import { warnOnce } from "./log-once";
import { isMissingSupabaseSchemaObject, parsePostgrestErrorResponse } from "./supabase-errors";
import { getSupabaseEnv } from "./supabase-env";

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

function useLocalCatalogOnly(): boolean {
  return process.env.NODE_ENV === "test"
    || process.env.PLAYWRIGHT === "1"
    || process.env.MINIAPP_CATALOG_SOURCE === "local";
}

async function fetchMiniAppsFromSupabase(status: MiniAppStatus, options: LoadMiniAppCatalogOptions = {}): Promise<MiniAppInfo[]> {
  if (useLocalCatalogOnly()) return [];
  const { url: supabaseURL, authHeaders } = getSupabaseEnv();
  if (!supabaseURL || !authHeaders) return [];

  const includeManifest = Boolean(options.includeManifest);
  const selectColumns = includeManifest
    ? "app_id,name,description,icon,category,entry_url,contract_hash,status,permissions,limits,logo_url,banner_url,docs_url,manifest"
    : "app_id,name,description,icon,category,entry_url,contract_hash,status,permissions,limits,logo_url,banner_url,docs_url";

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
      const parsedError = parsePostgrestErrorResponse(text);
      if (isMissingSupabaseSchemaObject(parsedError || text)) {
        warnOnce(
          "miniapps-table-missing",
          "miniapp catalog source table missing in Supabase; falling back to local miniapp definitions.",
        );
        return [];
      }
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
  const mergedMiniAppsMap = new Map(MINIAPP_REGISTRY.map((app) => [canonicalizeMiniAppId(app.app_id) || app.app_id, app]));
  for (const definitionApp of definitionApps) {
    const appId = canonicalizeMiniAppId(definitionApp.app_id) || definitionApp.app_id;
    const fallback = mergedMiniAppsMap.get(appId);
    mergedMiniAppsMap.set(appId, {
      ...(fallback || {}),
      ...definitionApp,
      app_id: appId,
      source: "miniapp",
    });
  }
  const mergedMiniApps = Array.from(mergedMiniAppsMap.values());
  const miniAppById = new Map(mergedMiniApps.map((app) => [canonicalizeMiniAppId(app.app_id) || app.app_id, app]));
  const dbApps = await fetchMiniAppsFromSupabase(status, options);

  const merged: MiniAppInfo[] = [];
  const seen = new Set<string>();

  for (const app of dbApps) {
    const appId = canonicalizeMiniAppId(app.app_id) || app.app_id;
    const fallback = miniAppById.get(appId);
    merged.push({ ...(fallback || {}), ...app, app_id: appId, source: app.source || "verified" });
    seen.add(appId);
  }

  // Static miniapps represent the active catalog and should not leak into
  // pending/disabled status views.
  if (status === "active") {
    for (const miniapp of mergedMiniApps) {
      if (seen.has(miniapp.app_id)) continue;
      merged.push({ ...miniapp, source: "miniapp" });
    }
  }

  return merged;
}

export function filterCatalogByAppId(catalog: MiniAppInfo[], appId: string): MiniAppInfo | null {
  const normalized = canonicalizeMiniAppId(appId) || String(appId || "").trim();
  if (!normalized) return null;
  return catalog.find((app) => {
    const appKey = canonicalizeMiniAppId(app.app_id) || app.app_id;
    return appKey === normalized;
  }) || null;
}

export async function loadMiniAppStatsMap(): Promise<Record<string, {
  users: number;
  transactions: number;
  volume: number;
  lastActivityAt: string | null;
}>> {
  if (useLocalCatalogOnly()) return {};
  const { url: supabaseURL, authHeaders } = getSupabaseEnv();
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
      const appId = canonicalizeMiniAppId(row.app_id) || String(row.app_id || "").trim();
      if (!appId) continue;
      const totalUsers = Number(row.total_users ?? row.daily_active_users ?? 0);
      const totalTransactions = Number(row.total_transactions ?? 0);
      const totalGasUsed = Number.parseFloat(String(row.total_gas_used ?? "0"));
      const next = {
        users: Number.isFinite(totalUsers) ? totalUsers : 0,
        transactions: Number.isFinite(totalTransactions) ? totalTransactions : 0,
        volume: Number.isFinite(totalGasUsed) ? totalGasUsed : 0,
        lastActivityAt: row.last_activity_at || null,
      };
      const existing = map[appId];
      if (!existing) {
        map[appId] = next;
        continue;
      }

      map[appId] = {
        users: existing.users + next.users,
        transactions: existing.transactions + next.transactions,
        volume: existing.volume + next.volume,
        lastActivityAt: existing.lastActivityAt && next.lastActivityAt
          ? (existing.lastActivityAt > next.lastActivityAt ? existing.lastActivityAt : next.lastActivityAt)
          : (existing.lastActivityAt || next.lastActivityAt || null),
      };
    }
    return map;
  } catch (error) {
    logger.warn("miniapp stats fetch error:", error);
    return {};
  }
}
