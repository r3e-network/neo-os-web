import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

type ReviewQueueItem = {
  app_id: string;
  app: {
    name: string;
    name_zh?: string | null;
    description?: string | null;
    description_zh?: string | null;
    category?: string | null;
    icon_url?: string | null;
    banner_url?: string | null;
    developer_address?: string | null;
    developer_name?: string | null;
    status?: string | null;
    visibility?: string | null;
  } | null;
  version: {
    id: string;
    version?: string | null;
    version_code?: number | null;
    entry_url?: string | null;
    status?: string | null;
    supported_chains?: string[] | null;
    contracts?: Record<string, unknown> | null;
    release_notes?: string | null;
    release_notes_zh?: string | null;
    created_at?: string | null;
  };
  build?: {
    build_number?: number | null;
    platform?: string | null;
    storage_path?: string | null;
    storage_provider?: string | null;
    status?: string | null;
    completed_at?: string | null;
  } | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ items: ReviewQueueItem[] } | { error: string }>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = requireAdmin(req.headers);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Database not configured" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("miniapp_versions")
      .select(
        "id,app_id,version,version_code,entry_url,status,supported_chains,contracts,release_notes,release_notes_zh,created_at,miniapp_registry(name,name_zh,description,description_zh,category,icon_url,banner_url,developer_address,developer_name,status,visibility)",
      )
      .eq("status", "pending_review")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Review queue query error:", error);
      return res.status(500).json({ error: "Failed to load review queue" });
    }

    const versionRows = data || [];
    const versionIds = versionRows.map((row) => row.id).filter(Boolean);

    const buildsByVersion = new Map<string, ReviewQueueItem["build"]>();
    if (versionIds.length) {
      const { data: builds, error: buildError } = await supabaseAdmin
        .from("miniapp_builds")
        .select("version_id,build_number,platform,storage_path,storage_provider,status,completed_at")
        .in("version_id", versionIds)
        .order("build_number", { ascending: false });

      if (buildError) {
        console.warn("Miniapp builds query error:", buildError.message || buildError);
      } else {
        for (const build of builds || []) {
          if (!build?.version_id) continue;
          if (!buildsByVersion.has(build.version_id)) {
            buildsByVersion.set(build.version_id, {
              build_number: build.build_number ?? null,
              platform: build.platform ?? null,
              storage_path: build.storage_path ?? null,
              storage_provider: build.storage_provider ?? null,
              status: build.status ?? null,
              completed_at: build.completed_at ?? null,
            });
          }
        }
      }
    }

    const items: ReviewQueueItem[] = versionRows.map((row) => {
      const registryRaw = row.miniapp_registry;
      const registry = Array.isArray(registryRaw) ? registryRaw[0] : registryRaw;
      return {
        app_id: row.app_id,
        app: registry
          ? {
              name: registry.name,
              name_zh: registry.name_zh ?? null,
              description: registry.description ?? null,
              description_zh: registry.description_zh ?? null,
              category: registry.category ?? null,
              icon_url: registry.icon_url ?? null,
              banner_url: registry.banner_url ?? null,
              developer_address: registry.developer_address ?? null,
              developer_name: registry.developer_name ?? null,
              status: registry.status ?? null,
              visibility: registry.visibility ?? null,
            }
          : null,
        version: {
          id: row.id,
          version: row.version ?? null,
          version_code: row.version_code ?? null,
          entry_url: row.entry_url ?? null,
          status: row.status ?? null,
          supported_chains: row.supported_chains ?? null,
          contracts: (row.contracts as Record<string, unknown>) ?? null,
          release_notes: row.release_notes ?? null,
          release_notes_zh: row.release_notes_zh ?? null,
          created_at: row.created_at ?? null,
        },
        build: buildsByVersion.get(row.id) ?? null,
      };
    });

    return res.status(200).json({ items });
  } catch (err) {
    console.error("Review queue error:", err);
    return res.status(500).json({ error: "Failed to load review queue" });
  }
}
