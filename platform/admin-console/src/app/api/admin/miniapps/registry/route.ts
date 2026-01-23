// =============================================================================
// Admin API - Unified MiniApp Registry View
// Returns combined view of external and internal miniapps for host app
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseClient } from "@/lib/api-client";

/**
 * GET /api/admin/miniapps/registry
 * Query params:
 * - category: filter by category
 * - source_type: "external" | "internal"
 * - since: ISO timestamp for incremental updates
 */
export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const sourceType = url.searchParams.get("source_type");
  const since = url.searchParams.get("since");

  try {
    const params: Record<string, string> = {
      select: "*",
      order: "name",
    };

    if (category) {
      params.category = `eq.${category}`;
    }

    if (sourceType === "external" || sourceType === "internal") {
      params.source_type = `eq.${sourceType}`;
    }

    if (since) {
      params.updated_at = `gte.${since}`;
    }

    const result = await supabaseClient.queryWithServiceRole<
      Array<{
        source_type: "external" | "internal";
        app_id: string;
        name: string;
        name_zh: string | null;
        description: string;
        description_zh: string | null;
        icon_url: string;
        banner_url: string;
        entry_url: string;
        category: string;
        version: string;
        status: string;
        updated_at: string;
      }>
    >("miniapp_registry_view", params);

    // Get last updated timestamp
    const lastUpdatedParams: Record<string, string> = {
      select: "updated_at",
      order: "updated_at.desc",
      limit: "1",
    };

    const lastUpdated = await supabaseClient.queryWithServiceRole<Array<{ updated_at: string }>>(
      "miniapp_registry_view",
      lastUpdatedParams
    );

    return NextResponse.json({
      miniapps: result.map((app) => ({
        app_id: app.app_id,
        name: app.name || "",
        name_zh: app.name_zh,
        description: app.description || "",
        description_zh: app.description_zh,
        icon: app.icon_url || "",
        banner: app.banner_url || "",
        entry_url: app.entry_url,
        category: app.category || "uncategorized",
        version: app.version || "",
        source_type: app.source_type,
        status: app.status,
        updated_at: app.updated_at,
      })),
      meta: {
        total: result.length,
        last_updated: lastUpdated[0]?.updated_at || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Registry query error:", error);
    return NextResponse.json({ error: "Failed to load registry", details: (error as Error).message }, { status: 500 });
  }
}
