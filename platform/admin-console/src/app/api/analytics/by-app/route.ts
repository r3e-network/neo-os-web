import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { getSupabaseServiceEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { usageByAppRowSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  let supabase: ReturnType<typeof getSupabaseServiceEnv>;
  try {
    supabase = getSupabaseServiceEnv({ strict: true });
  } catch (error) {
    logger.error("Usage by app environment error:", error instanceof Error ? error.message : "unknown error");
    return jsonError("Admin Supabase environment is not configured");
  }

  try {
    const usageByAppResponse = await fetch(`${supabase.url}/rest/v1/rpc/get_usage_by_app`, {
      method: "POST",
      headers: {
        apikey: supabase.serviceRoleKey,
        Authorization: `Bearer ${supabase.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10000),
    });

    if (!usageByAppResponse.ok) {
      return jsonError("Failed to fetch usage by app");
    }

    const usageByApp = await usageByAppResponse.json();
    const validated = z.array(usageByAppRowSchema).catch([]).parse(usageByApp);
    return NextResponse.json(validated);
  } catch (error) {
    logger.error("Usage by app error:", error instanceof Error ? error.message : "unknown error");
    return jsonError("Failed to fetch usage by app");
  }
}
