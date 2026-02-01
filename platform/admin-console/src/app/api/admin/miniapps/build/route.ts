// =============================================================================
// Admin API - Trigger MiniApp Build
// Manually triggers build pipeline for an approved submission
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { edgeClient } from "@/lib/api-client";

const EDGE_FUNCTION_URL = process.env.NEXT_PUBLIC_EDGE_URL || "https://edge.localhost";

/**
 * POST /api/admin/miniapps/build
 * Body:
 * - submission_id: string
 */
export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();

    if (!body.submission_id) {
      return NextResponse.json({ error: "submission_id is required" }, { status: 400 });
    }

    // Proxy to Edge Function
    const result = await edgeClient.post<{
      success: boolean;
      build_id: string;
      status: string;
      cdn_url?: string;
      error?: string;
    }>(`${EDGE_FUNCTION_URL}/functions/v1/miniapp-build`, body);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Build trigger error:", error);
    return NextResponse.json({ error: "Failed to trigger build", details: (error as Error).message }, { status: 500 });
  }
}
