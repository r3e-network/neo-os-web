import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://supabase.localhost";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

type RegistryRow = {
  app_id: string;
  name: string;
  name_zh?: string | null;
  description?: string | null;
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
  updated_at?: string | null;
};

type VersionRow = {
  id: string;
  app_id: string;
  version?: string | null;
  version_code?: number | null;
  entry_url?: string | null;
  status?: string | null;
  is_current?: boolean | null;
  supported_chains?: string[] | null;
  contracts?: Record<string, unknown> | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_at?: string | null;
  published_at?: string | null;
};

type BuildRow = {
  id: string;
  version_id: string;
  build_number?: number | null;
  storage_path?: string | null;
  storage_provider?: string | null;
  status?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
};

const DEFAULT_STATUSES = ["pending_review", "approved", "published"];

function pickLatestVersion(list: VersionRow[]): VersionRow | null {
  if (!list.length) return null;
  const pending = list.find((v) => v.status === "pending_review");
  if (pending) return pending;
  const approved = list.find((v) => v.status === "approved");
  if (approved) return approved;
  const current = list.find((v) => v.is_current);
  if (current) return current;
  return list[0] ?? null;
}

function pickLatestBuild(list: BuildRow[]): BuildRow | null {
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => (b.build_number ?? 0) - (a.build_number ?? 0));
  return sorted[0] ?? null;
}

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  if (!SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const statuses = statusParam && statusParam !== "all" ? [statusParam] : DEFAULT_STATUSES;

  const registryParams = new URLSearchParams();
  registryParams.set(
    "select",
    "app_id,name,name_zh,description,description_zh,short_description,icon_url,banner_url,category,permissions,supported_chains,contracts,status,visibility,developer_name,developer_address,created_at,updated_at",
  );
  registryParams.set("order", "updated_at.desc");
  registryParams.set("status", `in.(${statuses.join(",")})`);

  const registryRes = await fetch(`${SUPABASE_URL}/rest/v1/miniapp_registry?${registryParams.toString()}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });

  if (!registryRes.ok) {
    const detail = await registryRes.text();
    return NextResponse.json({ error: "Failed to load registry", detail }, { status: registryRes.status });
  }

  const registryRows = (await registryRes.json()) as RegistryRow[];
  if (!registryRows.length) {
    return NextResponse.json({ apps: [] });
  }

  const appIds = registryRows.map((row) => row.app_id).filter(Boolean);
  const versionsParams = new URLSearchParams();
  versionsParams.set(
    "select",
    "id,app_id,version,version_code,entry_url,status,is_current,supported_chains,contracts,reviewed_by,reviewed_at,review_notes,created_at,published_at",
  );
  versionsParams.set("order", "version_code.desc");
  versionsParams.set("app_id", `in.(${appIds.join(",")})`);

  const versionsRes = await fetch(`${SUPABASE_URL}/rest/v1/miniapp_versions?${versionsParams.toString()}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });

  if (!versionsRes.ok) {
    const detail = await versionsRes.text();
    return NextResponse.json({ error: "Failed to load versions", detail }, { status: versionsRes.status });
  }

  const versionRows = (await versionsRes.json()) as VersionRow[];
  const versionsByApp = new Map<string, VersionRow[]>();
  for (const row of versionRows) {
    const list = versionsByApp.get(row.app_id) || [];
    list.push(row);
    versionsByApp.set(row.app_id, list);
  }

  const versionIds = versionRows.map((row) => row.id).filter(Boolean);
  let buildsByVersion = new Map<string, BuildRow[]>();
  if (versionIds.length) {
    const buildsParams = new URLSearchParams();
    buildsParams.set(
      "select",
      "id,version_id,build_number,storage_path,storage_provider,status,created_at,completed_at",
    );
    buildsParams.set("order", "build_number.desc");
    buildsParams.set("version_id", `in.(${versionIds.join(",")})`);

    const buildsRes = await fetch(`${SUPABASE_URL}/rest/v1/miniapp_builds?${buildsParams.toString()}`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });

    if (buildsRes.ok) {
      const buildRows = (await buildsRes.json()) as BuildRow[];
      buildsByVersion = new Map();
      for (const row of buildRows) {
        const list = buildsByVersion.get(row.version_id) || [];
        list.push(row);
        buildsByVersion.set(row.version_id, list);
      }
    }
  }

  const apps = registryRows.map((app) => {
    const versions = versionsByApp.get(app.app_id) || [];
    const latestVersion = pickLatestVersion(versions);
    const builds = latestVersion ? buildsByVersion.get(latestVersion.id) || [] : [];
    return {
      ...app,
      latest_version: latestVersion,
      latest_build: pickLatestBuild(builds),
    };
  });

  return NextResponse.json({ apps });
}
