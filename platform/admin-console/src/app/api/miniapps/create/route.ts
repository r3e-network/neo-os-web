import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { SUPABASE_URL, SERVICE_ROLE_KEY } from "@/lib/constants";
import { computeManifestHashHex } from "@/lib/manifest-hash";
import { miniAppConfigSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    return jsonError("Supabase service role not configured");
  }

  let config: z.infer<typeof miniAppConfigSchema>;
  try {
    const body = await req.json();
    config = miniAppConfigSchema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.errors[0]?.message || "Invalid input", 400);
    }
    return jsonError("Invalid JSON body", 400);
  }

  if (!config.developer_user_id) {
    return jsonError("developer_user_id is required", 400);
  }

  const manifest = {
    ...config,
    developer_user_id: undefined,
  };
  const manifestHash = computeManifestHashHex(manifest);

  const row = {
    app_id: config.app_id,
    developer_user_id: config.developer_user_id,
    manifest_hash: manifestHash,
    entry_url: config.entry_url,
    developer_pubkey: config.developer_pubkey || "",
    permissions: config.permissions,
    limits: config.limits || {},
    assets_allowed: config.assets_allowed,
    governance_assets_allowed: config.governance_assets_allowed,
    manifest,
    name: config.name,
    category: config.content?.category || null,
    status: "pending",
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/miniapps`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text();
      return jsonError(text || "Failed to create MiniApp", response.status);
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data: Array.isArray(data) ? data[0] : data });
  } catch {
    return jsonError("Failed to connect to database", 502);
  }
}
