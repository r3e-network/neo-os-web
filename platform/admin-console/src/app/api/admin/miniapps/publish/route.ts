// =============================================================================
// Admin API - MiniApp Manual Publish
// Publishes a reviewed submission with CDN entry URL and assets
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { edgeClient } from "@/lib/api-client";

/**
 * POST /api/admin/miniapps/publish
 * Body:
 * - submission_id: string
 * - entry_url: string
 * - cdn_base_url?: string
 * - cdn_version_path?: string
 * - assets_selected?: { icon?: string; banner?: string }
 */
export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();

    if (!body.submission_id || !body.entry_url) {
      return NextResponse.json({ error: "submission_id and entry_url required" }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is required" }, { status: 500 });
    }

    const result = await edgeClient.post("/functions/v1/miniapp-publish", body, {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Publish error:", error);
    return NextResponse.json({ error: "Failed to publish MiniApp", details: (error as Error).message }, { status: 500 });
  }
}
