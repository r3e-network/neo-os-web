// =============================================================================
// Admin API - External MiniApp Submissions
// Lists pending and processed submissions from external developers
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseClient } from "@/lib/api-client";

const EDGE_FUNCTION_URL = process.env.NEXT_PUBLIC_EDGE_URL || "https://edge.localhost";

/**
 * GET /api/admin/miniapps/submissions
 * Query params:
 * - status: filter by status (pending_review, approved, rejected, building, published, etc.)
 * - limit: max results (default 50)
 * - offset: pagination offset
 */
export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  try {
    // Query the miniapp_submissions table directly
    const params: Record<string, string> = {
      select: "*",
      order: "created_at.desc",
      limit: String(limit),
      offset: String(offset),
    };

    if (status && status !== "all") {
      params.status = `eq.${status}`;
    }

    const result = await supabaseClient.queryWithServiceRole<{
      apps: Array<{
        id: string;
        app_id: string;
        git_url: string;
        git_host: string;
        repo_owner: string;
        repo_name: string;
        subfolder: string | null;
        branch: string;
        git_commit_sha: string | null;
        git_commit_message: string | null;
        git_committer: string | null;
        git_committed_at: string | null;
        manifest: Record<string, unknown>;
        manifest_hash: string;
        assets_detected: Record<string, unknown>;
        build_config: Record<string, unknown>;
        status: string;
        submitted_by: string;
        submitted_at: string;
        reviewed_by: string | null;
        reviewed_at: string | null;
        review_notes: string | null;
        build_started_at: string | null;
        built_at: string | null;
        built_by: string | null;
        cdn_base_url: string | null;
        cdn_version_path: string | null;
        assets_selected: Record<string, unknown> | null;
        build_log: string | null;
        last_error: string | null;
        error_count: number;
        created_at: string;
        updated_at: string;
      }>;
      total: number;
    }>("miniapp_submissions", params);

    // Get total count for pagination
    const countParams: Record<string, string> = {
      select: "id",
      count: "exact",
    };
    if (status && status !== "all") {
      countParams.status = `eq.${status}`;
    }

    const countResult = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/miniapp_submissions?${new URLSearchParams(countParams).toString()}`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ""}`,
          Prefer: "count=exact",
        },
      }
    );
    const totalCount = parseInt(countResult.headers.get("content-range")?.split("/")[1] || "0");

    return NextResponse.json({
      apps: result.apps,
      total: totalCount,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Submissions list error:", error);
    return NextResponse.json(
      { error: "Failed to load submissions", details: (error as Error).message },
      { status: 500 }
    );
  }
}
