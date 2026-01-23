// =============================================================================
// Admin API - Internal MiniApps
// Lists internal (pre-built) miniapps and triggers sync
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { edgeClient } from "@/lib/api-client";

const EDGE_FUNCTION_URL = process.env.NEXT_PUBLIC_EDGE_URL || "https://edge.localhost";

/**
 * GET /api/admin/miniapps/internal
 * Lists all internal miniapps
 */
export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    const result = await edgeClient.get<{
      miniapps: Array<{
        id: string;
        app_id: string;
        git_url: string;
        subfolder: string;
        branch: string;
        manifest: Record<string, unknown>;
        entry_url: string;
        icon_url: string | null;
        banner_url: string | null;
        category: string;
        status: string;
        manifest_hash: string;
        current_version: string;
        created_at: string;
        updated_at: string;
      }>;
    }>(`${EDGE_FUNCTION_URL}/functions/v1/miniapp-internal`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Internal miniapps list error:", error);
    return NextResponse.json(
      { error: "Failed to load internal miniapps", details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/miniapps/internal
 * Triggers sync of internal miniapps from repository
 */
export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    // Proxy to Edge Function sync endpoint
    const result = await edgeClient.post<{
      synced: number;
      updated: number;
      failed: number;
      miniapps: Array<{
        app_id: string;
        status: string;
        action: "created" | "updated" | "skipped";
      }>;
    }>(`${EDGE_FUNCTION_URL}/functions/v1/miniapp-internal/sync`, {});

    return NextResponse.json(result);
  } catch (error) {
    console.error("Internal sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync internal miniapps", details: (error as Error).message },
      { status: 500 }
    );
  }
}
