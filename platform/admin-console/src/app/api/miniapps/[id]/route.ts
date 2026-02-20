import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { SUPABASE_URL, SERVICE_ROLE_KEY } from "@/lib/constants";
import { computeManifestHashHex } from "@/lib/manifest-hash";
import { miniAppConfigSchema } from "@/lib/schemas";

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAdminAuth(_req);
  if (authError) return authError;

  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    return jsonError("Supabase service role not configured");
  }

  const { id } = await params;
  const appId = String(id || "").trim();
  if (!APP_ID_PATTERN.test(appId)) {
    return jsonError("Invalid app_id format", 400);
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/miniapps?app_id=eq.${encodeURIComponent(appId)}&limit=1`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) {
      return jsonError("Failed to fetch", response.status);
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return jsonError("Not found", 404);
    }
    return NextResponse.json(data[0]);
  } catch {
    return jsonError("Failed to connect to database", 502);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    return jsonError("Supabase service role not configured");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  // Validate partial config
  const partial = miniAppConfigSchema.partial().safeParse(body);
  if (!partial.success) {
    return jsonError(partial.error.errors[0]?.message || "Invalid input", 400);
  }

  const { id } = await params;
  const appId = String(id || "").trim();
  if (!APP_ID_PATTERN.test(appId)) {
    return jsonError("Invalid app_id format", 400);
  }

  try {
    const getExisting = await fetch(
      `${SUPABASE_URL}/rest/v1/miniapps?app_id=eq.${encodeURIComponent(appId)}&select=manifest,entry_url,developer_pubkey,permissions,limits,assets_allowed,governance_assets_allowed,name,category&limit=1`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!getExisting.ok) {
      return jsonError("Failed to fetch existing MiniApp", getExisting.status);
    }

    const existingRows = await getExisting.json();
    const existing = Array.isArray(existingRows) ? existingRows[0] : null;
    if (!existing) {
      return jsonError("Not found", 404);
    }

    const d = partial.data;
    const patch: Record<string, unknown> = {};

    if (d.entry_url !== undefined) patch.entry_url = d.entry_url;
    if (d.developer_pubkey !== undefined) patch.developer_pubkey = d.developer_pubkey;
    if (d.permissions !== undefined) patch.permissions = d.permissions;
    if (d.limits !== undefined) patch.limits = d.limits;
    if (d.assets_allowed !== undefined) patch.assets_allowed = d.assets_allowed;
    if (d.governance_assets_allowed !== undefined) patch.governance_assets_allowed = d.governance_assets_allowed;
    if (d.name !== undefined) patch.name = d.name;
    if (d.content?.category !== undefined) patch.category = d.content.category || null;

    const existingManifest =
      existing.manifest && typeof existing.manifest === "object" && !Array.isArray(existing.manifest)
        ? (existing.manifest as Record<string, unknown>)
        : {};

    const mergedManifest: Record<string, unknown> = { ...existingManifest };
    let manifestChanged = false;
    const setManifestField = (key: string, value: unknown) => {
      mergedManifest[key] = value;
      manifestChanged = true;
    };

    if (d.entry_url !== undefined) setManifestField("entry_url", d.entry_url);
    if (d.developer_pubkey !== undefined) setManifestField("developer_pubkey", d.developer_pubkey);
    if (d.permissions !== undefined) setManifestField("permissions", d.permissions);
    if (d.limits !== undefined) {
      const prevLimits =
        mergedManifest.limits && typeof mergedManifest.limits === "object" && !Array.isArray(mergedManifest.limits)
          ? (mergedManifest.limits as Record<string, unknown>)
          : {};
      setManifestField("limits", { ...prevLimits, ...d.limits });
    }
    if (d.assets_allowed !== undefined) setManifestField("assets_allowed", d.assets_allowed);
    if (d.governance_assets_allowed !== undefined) setManifestField("governance_assets_allowed", d.governance_assets_allowed);
    if (d.name !== undefined) setManifestField("name", d.name);
    if (d.version !== undefined) setManifestField("version", d.version);
    if (d.contracts !== undefined) setManifestField("contracts", d.contracts);
    if (d.operations !== undefined) setManifestField("operations", d.operations);
    if (d.components !== undefined) setManifestField("components", d.components);
    if (d.content !== undefined) {
      const prevContent =
        mergedManifest.content && typeof mergedManifest.content === "object" && !Array.isArray(mergedManifest.content)
          ? (mergedManifest.content as Record<string, unknown>)
          : {};
      setManifestField("content", { ...prevContent, ...d.content });
    }
    if (d.callback_contract !== undefined) setManifestField("callback_contract", d.callback_contract);
    if (d.callback_method !== undefined) setManifestField("callback_method", d.callback_method);
    if (d.attestation_required !== undefined) setManifestField("attestation_required", d.attestation_required);

    if (manifestChanged) {
      patch.manifest = mergedManifest;
      patch.manifest_hash = computeManifestHashHex(mergedManifest);
    }

    if (Object.keys(patch).length === 0) {
      return jsonError("No update fields provided", 400);
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/miniapps?app_id=eq.${encodeURIComponent(appId)}`,
      {
        method: "PATCH",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(patch),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) {
      return jsonError("Failed to update", response.status);
    }
    return NextResponse.json({ success: true });
  } catch {
    return jsonError("Failed to connect to database", 502);
  }
}
