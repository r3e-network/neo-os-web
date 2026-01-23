// =============================================================================
// Admin API - MiniApp Approval
// Approve, reject, or request changes for submissions
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { edgeClient } from "@/lib/api-client";

const EDGE_FUNCTION_URL = process.env.NEXT_PUBLIC_EDGE_URL || "https://edge.localhost";

/**
 * POST /api/admin/miniapps/approve
 * Body:
 * - submission_id: string
 * - action: "approve" | "reject" | "request_changes"
 * - trigger_build?: boolean (for approve action)
 * - review_notes?: string
 */
export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();

    // Proxy to Edge Function
    const result = await edgeClient.post<{
      success: boolean;
      submission_id: string;
      status: string;
      message: string;
    }>(`${EDGE_FUNCTION_URL}/functions/v1/miniapp-approve`, body);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Approval error:", error);
    return NextResponse.json(
      { error: "Failed to process approval", details: (error as Error).message },
      { status: 500 }
    );
  }
}
