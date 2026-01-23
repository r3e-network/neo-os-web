// Internal Miniapps Sync & Update
// Scans internal repository for pre-built miniapps and syncs to registry
// Also handles updates from GitHub Actions for auto-publish workflow

import "../_shared/init.ts";

declare const Deno: {
  serve(handler: (req: Request) => Promise<Response>): void;
  cwd(): string;
  readDirSync(path: string): Iterable<{ name: string; isDirectory: boolean; isSymlink: boolean }>;
  readTextFile(path: string): Promise<string>;
  env: {
    get(key: string): string | undefined;
  };
};

import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { json } from "../_shared/response.ts";
import { errorResponse } from "../_shared/error-codes.ts";
import { requireAuth } from "../_shared/supabase.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Internal miniapps location
const INTERNAL_REPO_URL = mustGetEnv("INTERNAL_MINIAPPS_REPO_URL");
const INTERNAL_REPO_PATH = mustGetEnv("INTERNAL_MINIAPPS_PATH"); // e.g., "miniapps-uniapp/apps"

// Default CDN URL for internal miniapps
const DEFAULT_CDN_URL = mustGetEnv("INTERNAL_CDN_BASE_URL");

interface InternalMiniapp {
  app_id: string;
  subfolder: string;
  manifest: any;
  manifest_hash: string;
  entry_url: string;
  icon_url: string;
  banner_url: string;
  category: string;
}

interface SyncResponse {
  synced: number;
  updated: number;
  failed: number;
  miniapps: Array<{
    app_id: string;
    status: string;
    action: "created" | "updated" | "skipped";
  }>;
}

interface UpdateRequest {
  app_id: string;
  name?: string;
  category: string;
  subfolder: string;
  manifest: any;
  entry_url: string;
  icon_url?: string;
  banner_url?: string;
  current_version: string;
  commit_sha: string;
}

interface UpdateResponse {
  success: boolean;
  app_id: string;
  action: "created" | "updated";
  entry_url: string;
  version: string;
}

// URL helper to parse path from request
function getUrlPath(req: Request): string {
  const url = new URL(req.url);
  return url.pathname;
}

// Scan internal miniapps directory
async function scanInternalMiniapps(): Promise<InternalMiniapp[]> {
  const miniapps: InternalMiniapp[] = [];

  // For this implementation, we'll scan the local file system
  // In production, this might clone the repo or use an existing clone

  const basePath = Deno.cwd().split("/service_layer")[0] + "/service_layer";
  const appsPath = join(basePath, INTERNAL_REPO_PATH);

  console.log(`Scanning internal miniapps at: ${appsPath}`);

  try {
    const entries = Array.from(Deno.readDirSync(appsPath));

    for (const entry of entries) {
      if (!entry.isDirectory) continue;

      const appPath = join(appsPath, entry.name);

      // Look for manifest
      const manifestFiles = ["neo-manifest.json", "manifest.json"];
      let manifest: any = null;
      let manifestFile = "";

      for (const mf of manifestFiles) {
        const manifestPath = join(appPath, mf);
        try {
          const content = await Deno.readTextFile(manifestPath);
          manifest = JSON.parse(content);
          manifestFile = mf;
          break;
        } catch {
          // File doesn't exist, try next
        }
      }

      if (!manifest) {
        console.warn(`No manifest found for ${entry.name}`);
        continue;
      }

      const appId = manifest.app_id || entry.name;

      // Determine entry URL (pre-built)
      // Assuming uni-app build structure: dist/build/h5/
      const entryUrl = `${DEFAULT_CDN_URL}/miniapps/${entry.name}/index.html`;

      // Determine icon URL
      const iconFile = join(appPath, "static/icon.png");
      const iconUrl = `${DEFAULT_CDN_URL}/miniapps/${entry.name}/static/icon.png`;

      // Determine banner URL
      const bannerFile = join(appPath, "static/banner.png");
      const bannerUrl = `${DEFAULT_CDN_URL}/miniapps/${entry.name}/static/banner.png`;

      miniapps.push({
        app_id: appId,
        subfolder: join(INTERNAL_REPO_PATH, entry.name),
        manifest,
        manifest_hash: "", // TODO: compute hash
        entry_url: entryUrl,
        icon_url: iconUrl,
        banner_url: bannerUrl,
        category: manifest.category || "uncategorized",
      });
    }
  } catch (error) {
    console.error("Error scanning miniapps:", error);
    throw new Error(`Failed to scan miniapps: ${error.message}`);
  }

  return miniapps;
}

// Sync miniapps to database
async function syncMiniapps(miniapps: InternalMiniapp[]): Promise<SyncResponse> {
  const supabase = createClient(mustGetEnv("SUPABASE_URL"), mustGetEnv("SUPABASE_SERVICE_ROLE_KEY"));

  const response: SyncResponse = {
    synced: 0,
    updated: 0,
    failed: 0,
    miniapps: [],
  };

  for (const miniapp of miniapps) {
    try {
      // Check if app already exists
      const { data: existing } = await supabase
        .from("miniapp_internal")
        .select("*")
        .eq("app_id", miniapp.app_id)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("miniapp_internal")
          .update({
            manifest: miniapp.manifest,
            manifest_hash: miniapp.manifest_hash,
            entry_url: miniapp.entry_url,
            icon_url: miniapp.icon_url,
            banner_url: miniapp.banner_url,
            category: miniapp.category,
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("app_id", miniapp.app_id);

        if (error) throw error;

        response.updated++;
        response.miniapps.push({
          app_id: miniapp.app_id,
          status: "updated",
          action: "updated",
        });
      } else {
        // Insert new
        const { error } = await supabase.from("miniapp_internal").insert({
          git_url: INTERNAL_REPO_URL,
          subfolder: miniapp.subfolder,
          branch: "master",
          app_id: miniapp.app_id,
          manifest: miniapp.manifest,
          manifest_hash: miniapp.manifest_hash,
          entry_url: miniapp.entry_url,
          icon_url: miniapp.icon_url,
          banner_url: miniapp.banner_url,
          category: miniapp.category,
          status: "active",
          current_version: Deno.env.get("GIT_COMMIT") || "unknown",
        });

        if (error) throw error;

        response.synced++;
        response.miniapps.push({
          app_id: miniapp.app_id,
          status: "created",
          action: "created",
        });
      }
    } catch (error) {
      console.error(`Failed to sync ${miniapp.app_id}:`, error);
      response.failed++;
      response.miniapps.push({
        app_id: miniapp.app_id,
        status: "failed",
        action: "skipped",
      });
    }
  }

  return response;
}

// Update single miniapp (called from GitHub Actions)
async function updateMiniapp(data: UpdateRequest): Promise<UpdateResponse> {
  const supabase = createClient(mustGetEnv("SUPABASE_URL"), mustGetEnv("SUPABASE_SERVICE_ROLE_KEY"));

  try {
    // Check if app already exists
    const { data: existing } = await supabase.from("miniapp_internal").select("*").eq("app_id", data.app_id).single();

    const updateData = {
      git_url: INTERNAL_REPO_URL,
      subfolder: data.subfolder,
      branch: "master",
      app_id: data.app_id,
      manifest: data.manifest,
      manifest_hash: data.commit_sha, // Use commit SHA as hash
      entry_url: data.entry_url,
      icon_url: data.icon_url || data.manifest.icon || "",
      banner_url: data.banner_url || data.manifest.banner || "",
      category: data.category,
      status: "active",
      current_version: data.current_version,
      previous_version: existing?.current_version,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      // Update existing
      const { error } = await supabase.from("miniapp_internal").update(updateData).eq("app_id", data.app_id);

      if (error) throw error;

      console.log(`Updated miniapp: ${data.app_id} -> ${data.entry_url}`);

      return {
        success: true,
        app_id: data.app_id,
        action: "updated",
        entry_url: data.entry_url,
        version: data.current_version,
      };
    } else {
      // Insert new
      const { error } = await supabase.from("miniapp_internal").insert({
        ...updateData,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      console.log(`Created miniapp: ${data.app_id} -> ${data.entry_url}`);

      return {
        success: true,
        app_id: data.app_id,
        action: "created",
        entry_url: data.entry_url,
        version: data.current_version,
      };
    }
  } catch (error) {
    console.error(`Failed to update ${data.app_id}:`, error);
    throw error;
  }
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const path = getUrlPath(req);

  // POST /functions/v1/miniapp-internal/update - Update single miniapp (from GitHub Actions)
  if (req.method === "POST" && path.endsWith("/update")) {
    // Service role only (bypass auth for GitHub Actions)
    const serviceRoleKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
      return errorResponse("AUTH_004", "Service role required", req);
    }

    try {
      const body = await req.json();
      const result = await updateMiniapp(body);
      return json(result, {}, req);
    } catch (error) {
      console.error("Update error:", error);
      return errorResponse("SERVER_001", { message: (error as Error).message }, req);
    }
  }

  // POST /functions/v1/miniapp-internal/sync - Trigger sync (admin)
  if (req.method === "POST" && path.endsWith("/sync")) {
    const auth = await requireAuth(req);
    if (auth instanceof Response) return auth;
    const rl = await requireRateLimit(req, "miniapp-sync", auth);
    if (rl) return rl;

    // Check if user is admin
    const { data: isAdmin } = await supabaseAdminCheck(auth.userId);
    if (!isAdmin) {
      return errorResponse("AUTH_004", "Admin access required", req);
    }

    try {
      // 1. Scan internal miniapps
      const miniapps = await scanInternalMiniapps();

      // 2. Sync to database
      const result = await syncMiniapps(miniapps);

      return json(result, {}, req);
    } catch (error) {
      console.error("Sync error:", error);
      return errorResponse("SERVER_001", { message: (error as Error).message }, req);
    }
  }

  // GET /functions/v1/miniapp-internal - List internal miniapps
  if (req.method === "GET") {
    const supabase = createClient(mustGetEnv("SUPABASE_URL"), mustGetEnv("SUPABASE_ANON_KEY"));

    const { data, error } = await supabase.from("miniapp_internal").select("*").eq("status", "active").order("app_id");

    if (error) {
      return errorResponse("SERVER_001", { message: error.message }, req);
    }

    return json({ miniapps: data || [] }, {}, req);
  }

  return errorResponse("METHOD_NOT_ALLOWED", undefined, req);
}

// Admin check helper
async function supabaseAdminCheck(userId: string): Promise<{
  data: boolean;
}> {
  const supabase = createClient(mustGetEnv("SUPABASE_URL"), mustGetEnv("SUPABASE_ANON_KEY"));

  const { data } = await supabase.from("admin_emails").select("user_id").eq("user_id", userId);

  return { data: !!data };
}

if (import.meta.main) {
  Deno.serve(handler);
}
