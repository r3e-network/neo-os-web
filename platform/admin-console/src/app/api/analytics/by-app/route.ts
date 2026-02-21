import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { SUPABASE_URL, SERVICE_ROLE_KEY } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { usageByAppRowSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    const usageByAppResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_usage_by_app`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
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
