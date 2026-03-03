// =============================================================================
// API Route: Services Health Check
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { env } from "@/lib/env";

const EDGE_URL = env.NEXT_PUBLIC_EDGE_URL || "http://edge-gateway.platform.svc.cluster.local:8787";

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    const response = await fetch(`${EDGE_URL}/admin-services-health`, {
      signal: AbortSignal.timeout(10000),
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
      },
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const healthChecks = await response.json();
    return NextResponse.json(healthChecks);
  } catch (error) {
    return jsonError("Failed to check services health: " + (error instanceof Error ? error.message : String(error)));
  }
}
