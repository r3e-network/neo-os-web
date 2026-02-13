// MiniApp List Endpoint
// Returns all published miniapps for host app discovery
// Combines both external submissions and internal miniapps

import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { mustGetEnv } from "../_shared/env.ts";
import { json } from "../_shared/response.ts";
import { errorResponse } from "../_shared/error-codes.ts";
import { createHandler } from "../_shared/handler.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface MiniappListResponse {
  miniapps: Array<{
    app_id: string;
    name: string;
    name_zh?: string;
    description: string;
    description_zh?: string;
    icon: string;
    banner: string;
    entry_url: string;
    category: string;
    version: string;
    source_type: "external" | "internal";
    status: string;
    updated_at: string;
  }>;
  meta: {
    total: number;
    last_updated: string;
  };
}

interface MiniappRegistryRow {
  app_id: string;
  name?: string;
  name_zh?: string;
  description?: string;
  description_zh?: string;
  icon_url?: string;
  icon?: string;
  banner_url?: string;
  banner?: string;
  entry_url: string;
  category?: string;
  version?: string;
  source_type: "external" | "internal";
  status: string;
  updated_at: string;
}

export const handler = createHandler({ method: "GET", auth: false }, async ({ req, url }) => {
  try {
    const supabase = createClient(mustGetEnv("SUPABASE_URL"), mustGetEnv("SUPABASE_ANON_KEY"));

    // Get query parameters
    const category = url.searchParams.get("category");
    const sourceType = url.searchParams.get("source_type"); // "external" or "internal"
    const since = url.searchParams.get("since");

    // Build query
    let query = supabase.from("miniapp_registry_view").select("*");

    if (category) {
      query = query.eq("category", category);
    }

    if (sourceType) {
      query = query.eq("source_type", sourceType);
    }

    if (since) {
      query = query.gte("updated_at", since);
    }

    // Order by name
    query = query.order("name");

    const { data: miniapps, error } = await query;

    if (error) {
      return errorResponse("SERVER_001", { message: error.message }, req);
    }

    // Transform to host app format
    const transformedMiniapps = (miniapps || []).map((app: MiniappRegistryRow) => ({
      app_id: app.app_id,
      name: app.name || "",
      name_zh: app.name_zh,
      description: app.description || "",
      description_zh: app.description_zh,
      icon: app.icon_url || app.icon || "",
      banner: app.banner_url || app.banner || "",
      entry_url: app.entry_url,
      category: app.category || "uncategorized",
      version: app.version || "",
      source_type: app.source_type,
      status: app.status,
      updated_at: app.updated_at,
    }));

    // Get last updated time
    const { data: lastApp } = await supabase
      .from("miniapp_registry_view")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    const response: MiniappListResponse = {
      miniapps: transformedMiniapps,
      meta: {
        total: transformedMiniapps.length,
        last_updated: lastApp?.updated_at || new Date().toISOString(),
      },
    };

    return json(response, {}, req);
  } catch (err) {
    console.error("Miniapp list error:", err);
    return errorResponse("SERVER_001", { message: (err as Error).message }, req);
  }
});

if (import.meta.main) {
  Deno.serve(handler);
}
