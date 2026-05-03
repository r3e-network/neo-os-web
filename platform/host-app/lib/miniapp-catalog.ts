import type { MiniAppInfo } from "@/components/types";
import { coerceMiniAppInfo } from "./miniapp";
import { loadMiniAppDefinitions } from "./miniapp-definitions";
import { canonicalizeMiniAppId } from "./miniapp-id";
import { logger } from "./logger";
import { warnOnce } from "./log-once";
import { isMissingSupabaseSchemaObject, parsePostgrestErrorResponse } from "./supabase-errors";
import { getSupabaseEnv } from "./supabase-env";
import { applyMiniAppReleaseDefaults } from "./miniapp-builtins";
import { filterArchivedMiniApps, isArchivedMiniAppId } from "./archived-miniapps";

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
      const text = await response.text().catch((e: unknown) => { console.warn("[miniapp-catalog] failed to read response text:", e instanceof Error ? e.message : String(e)); return ""; });
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
    return filterArchivedMiniApps(rows
      .map((row) => coerceMiniAppInfo(row))
      .filter((app): app is MiniAppInfo => Boolean(app))
      .map((app) => applyMiniAppReleaseDefaults({ ...app, source: "verified" as const })));
  } catch (error) {
    logger.warn("miniapp catalog fetch error:", error);
    return [];
  }
}

export async function loadMiniAppCatalog(
  status: MiniAppStatus = "active",
  options: LoadMiniAppCatalogOptions = {},
): Promise<MiniAppInfo[]> {
  const definitionApps = filterArchivedMiniApps(await loadMiniAppDefinitions());
  const miniAppById = new Map(definitionApps.map((app) => [canonicalizeMiniAppId(app.app_id) || app.app_id, app]));
  const dbApps = await fetchMiniAppsFromSupabase(status, options);

  const merged: MiniAppInfo[] = [];
  const seen = new Set<string>();

  for (const app of dbApps) {
    const appId = canonicalizeMiniAppId(app.app_id) || app.app_id;
    const fallback = miniAppById.get(appId);
    // DB carries live status / stats / metadata; local definition is the source of
    // truth for the operation schema (method names, params, hidden $wallet hints)
    // since those must match the deployed contract ABI which Supabase doesn't track.
    const merged_ops = fallback?.operations ?? app.operations;
    const merged_detail = fallback?.detail_template ?? app.detail_template;
    merged.push(applyMiniAppReleaseDefaults({
      ...(fallback || {}),
      ...app,
      app_id: appId,
      source: app.source || "verified",
      operations: merged_ops,
      detail_template: merged_detail,
    }));
    seen.add(appId);
  }

  // Static miniapps represent the active catalog and should not leak into
  // pending/disabled status views.
  if (status === "active") {
    for (const miniapp of definitionApps) {
      if (seen.has(miniapp.app_id)) continue;
      merged.push(applyMiniAppReleaseDefaults({ ...miniapp, source: "miniapp" }));
    }
  }

  return merged;
}

export function filterCatalogByAppId(catalog: MiniAppInfo[], appId: string): MiniAppInfo | null {
  const normalized = canonicalizeMiniAppId(appId) || String(appId || "").trim();
  if (!normalized) return null;
  if (isArchivedMiniAppId(normalized)) return null;
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
      const text = await response.text().catch((e: unknown) => { console.warn("[miniapp-catalog] failed to read stats response text:", e instanceof Error ? e.message : String(e)); return ""; });
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
