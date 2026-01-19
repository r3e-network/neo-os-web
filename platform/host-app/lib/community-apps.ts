import type { MiniAppInfo } from "@/components/types";
import { supabase, supabaseAdmin, isSupabaseConfigured } from "./supabase";

export type RegistryStatusFilter = "published" | "approved" | "pending_review" | "draft" | "all" | "active" | "pending";

type RegistryRow = {
  app_id: string;
  name: string;
  name_zh?: string | null;
  description: string | null;
  description_zh?: string | null;
  short_description?: string | null;
  icon_url?: string | null;
  banner_url?: string | null;
  category?: string | null;
  permissions?: Record<string, unknown> | null;
  supported_chains?: string[] | null;
  contracts?: Record<string, unknown> | null;
  status?: string | null;
  visibility?: string | null;
  developer_name?: string | null;
  developer_address?: string | null;
  created_at?: string | null;
};

type VersionRow = {
  id: string;
  app_id: string;
  version?: string | null;
  version_code?: number | null;
  entry_url: string | null;
  status?: string | null;
  is_current?: boolean | null;
  supported_chains?: string[] | null;
  contracts?: Record<string, unknown> | null;
};

function mapRegistryStatus(raw?: string | null): MiniAppInfo["status"] {
  const status = String(raw ?? "").trim().toLowerCase();
  if (status === "published" || status === "approved") return "active";
  if (status === "pending_review" || status === "pending") return "pending";
  if (status === "draft" || status === "suspended" || status === "archived") return "disabled";
  return null;
}

function normalizeRegistryFilter(status?: RegistryStatusFilter): string[] {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (!normalized || normalized === "active" || normalized === "published") return ["published"];
  if (normalized === "approved") return ["approved"];
  if (normalized === "pending" || normalized === "pending_review") return ["pending_review"];
  if (normalized === "draft") return ["draft"];
  if (normalized === "all") return ["draft", "pending_review", "approved", "published", "suspended", "archived"];
  return ["published"];
}

function pickBestVersion(versions: VersionRow[]): VersionRow | null {
  if (!versions.length) return null;
  const published = versions.filter((version) => {
    const status = String(version.status ?? "").toLowerCase();
    return status === "published" || status === "approved";
  });
  const candidates = published.length ? published : versions;
  const byCode = [...candidates].sort((a, b) => (b.version_code ?? 0) - (a.version_code ?? 0));
  const current = byCode.find((v) => v.is_current);
  if (current) return current;
  return byCode[0] ?? null;
}

function toMiniAppInfo(app: RegistryRow, version: VersionRow | null): MiniAppInfo | null {
  const entryUrl = String(version?.entry_url ?? "").trim();
  if (!entryUrl) return null;

  const supportedChains = Array.isArray(version?.supported_chains)
    ? version?.supported_chains
    : Array.isArray(app.supported_chains)
      ? app.supported_chains
      : [];
  const contracts =
    version?.contracts && typeof version.contracts === "object" && !Array.isArray(version.contracts)
      ? version.contracts
      : app.contracts && typeof app.contracts === "object" && !Array.isArray(app.contracts)
        ? app.contracts
        : undefined;

  return {
    app_id: app.app_id,
    name: app.name,
    name_zh: app.name_zh || undefined,
    description: app.description || "",
    description_zh: app.description_zh || undefined,
    icon: app.icon_url || "",
    category: (app.category as MiniAppInfo["category"]) || "utility",
    entry_url: entryUrl,
    supportedChains: supportedChains || [],
    chainContracts: contracts as MiniAppInfo["chainContracts"],
    banner: app.banner_url || undefined,
    tagline: app.short_description || undefined,
    status: mapRegistryStatus(app.status),
    source: "community",
    permissions: (app.permissions as MiniAppInfo["permissions"]) || {},
    developer: {
      name: app.developer_name || "Community Developer",
      address: app.developer_address || "",
      verified: false,
    },
    created_at: app.created_at || undefined,
  };
}

export async function fetchCommunityApps(options?: {
  status?: RegistryStatusFilter;
  category?: string;
  appId?: string;
  limit?: number;
}): Promise<MiniAppInfo[]> {
  if (!isSupabaseConfigured) return [];

  const client = supabaseAdmin ?? supabase;
  const statusList = normalizeRegistryFilter(options?.status);

  let registryQuery = client
    .from("miniapp_registry")
    .select(
      "app_id,name,name_zh,description,description_zh,short_description,icon_url,banner_url,category,permissions,supported_chains,contracts,status,visibility,developer_name,developer_address,created_at",
    );

  if (options?.appId) {
    registryQuery = registryQuery.eq("app_id", options.appId);
    if (options.status && options.status !== "all") {
      registryQuery = registryQuery.in("status", statusList);
      registryQuery = registryQuery.eq("visibility", "public");
    }
  } else {
    registryQuery = registryQuery.in("status", statusList);
    registryQuery = registryQuery.eq("visibility", "public");
    if (options?.category && options.category !== "all") {
      registryQuery = registryQuery.eq("category", options.category);
    }
    if (options?.limit && options.limit > 0) {
      registryQuery = registryQuery.limit(options.limit);
    }
  }

  const { data: registryRows, error: registryError } = await registryQuery;
  if (registryError || !registryRows) {
    console.warn("Community registry query error:", registryError?.message || registryError);
    return [];
  }

  const apps = registryRows as RegistryRow[];
  if (!apps.length) return [];

  const appIds = apps.map((row) => row.app_id).filter(Boolean);
  const { data: versionRows, error: versionError } = await client
    .from("miniapp_versions")
    .select("id,app_id,version,version_code,entry_url,status,is_current,supported_chains,contracts")
    .in("app_id", appIds)
    .order("version_code", { ascending: false });

  if (versionError) {
    console.warn("Community versions query error:", versionError.message || versionError);
  }

  const versionsByApp = new Map<string, VersionRow[]>();
  for (const row of (versionRows || []) as VersionRow[]) {
    const list = versionsByApp.get(row.app_id) || [];
    list.push(row);
    versionsByApp.set(row.app_id, list);
  }

  const results: MiniAppInfo[] = [];
  for (const app of apps) {
    const versionList = versionsByApp.get(app.app_id) || [];
    const version = pickBestVersion(versionList);
    const info = toMiniAppInfo(app, version);
    if (info) results.push(info);
  }

  return results;
}

export async function fetchCommunityAppById(appId: string): Promise<MiniAppInfo | null> {
  if (!appId) return null;
  const apps = await fetchCommunityApps({ appId, status: "active" });
  if (!apps.length) return null;
  return apps[0] || null;
}
