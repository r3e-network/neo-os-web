import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { SUPABASE_URL, SERVICE_ROLE_KEY } from "@/lib/constants";

const updateStatusSchema = z.object({
  appId: z.string().min(1, "appId is required").regex(/^[a-z0-9][a-z0-9._-]*$/, "invalid appId format"),
  status: z.enum(["active", "disabled"], { message: "status must be active or disabled" }),
});

export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    return jsonError("Supabase service role not configured");
  }

  let payload: z.infer<typeof updateStatusSchema>;
  try {
    const body = await req.json();
    payload = updateStatusSchema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.errors[0]?.message || "Invalid input", 400);
    }
    return jsonError("Invalid JSON body", 400);
  }

  const { appId, status } = payload;
  const appRegistryHash = String(process.env.CONTRACT_APPREGISTRY_HASH || "").trim();
  const directPatchEnabled = String(process.env.ADMIN_STATUS_DIRECT_PATCH || "").toLowerCase() === "true";

  if (!/^0x[0-9a-fA-F]{40}$/.test(appRegistryHash)) {
    return jsonError("CONTRACT_APPREGISTRY_HASH is not configured");
  }

  const statusCode = status === "active" ? 1 : 2; // AppRegistry.AppStatus: Approved=1, Disabled=2

  try {
    const existsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/miniapps?app_id=eq.${encodeURIComponent(appId)}&select=app_id&limit=1`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!existsRes.ok) {
      return jsonError("Failed to validate MiniApp status", existsRes.status);
    }
    const rows = await existsRes.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return jsonError("MiniApp not found", 404);
    }
  } catch {
    return jsonError("Failed to connect to database", 502);
  }

  if (directPatchEnabled) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/miniapps?app_id=eq.${encodeURIComponent(appId)}`, {
        method: "PATCH",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ status }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        return jsonError("Failed to update MiniApp status cache", response.status);
      }
    } catch {
      return jsonError("Failed to connect to database", 502);
    }
  }

  return NextResponse.json({
    success: true,
    requires_onchain_confirmation: true,
    direct_cache_patch_applied: directPatchEnabled,
    target_status: status,
    invocation: {
      contract_hash: appRegistryHash,
      method: "setStatus",
      params: [
        { type: "String", value: appId },
        { type: "Integer", value: statusCode },
      ],
    },
  });
}
