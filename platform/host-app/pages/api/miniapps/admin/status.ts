import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { computeManifestHashHex } from "@/lib/miniapp-admin";
import { coerceMiniAppInfo } from "@/lib/miniapp";
import { strictLimit } from "@/lib/rate-limit";
import { getServerSupabaseClient, hasServiceRoleSupabase } from "@/lib/server-supabase";

const APP_ID_REGEX = /^[a-z0-9][a-z0-9._-]*$/;
const STATUS_VALUES = new Set(["pending", "active", "disabled"]);
const SELECT_COLUMNS =
  "app_id,name,description,icon,category,entry_url,contract_hash,status,permissions,limits,logo_url,banner_url,docs_url,manifest";

type StatusValue = "pending" | "active" | "disabled";

type MiniAppStatusRow = {
  app_id: string;
  manifest: Record<string, unknown> | null;
};

function asTrimmedString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }
  if (strictLimit(req, res)) return;

  if (!hasServiceRoleSupabase()) {
    return apiError.configError(res, "SUPABASE_SERVICE_ROLE_KEY is required for admin miniapp writes");
  }

  const admin = await requireMiniAppAdmin(req, res);
  if (!admin) return;

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return apiError.badRequest(res, "Missing request body");
  }
  const bodyObj = body as Record<string, unknown>;

  const appId = asTrimmedString(bodyObj.app_id).toLowerCase();
  if (!APP_ID_REGEX.test(appId)) {
    return apiError.badRequest(res, "Invalid app_id format");
  }

  const statusRaw = asTrimmedString(bodyObj.status).toLowerCase();
  if (!STATUS_VALUES.has(statusRaw)) {
    return apiError.badRequest(res, "Invalid status value");
  }
  const status = statusRaw as StatusValue;

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(res, "Supabase service role client unavailable");
  }

  const { data: existing, error: existingError } = await supabase
    .from("miniapps")
    .select("app_id,manifest")
    .eq("app_id", appId)
    .maybeSingle();

  if (existingError) {
    logger.error("miniapp status fetch failed:", existingError.message);
    return apiError.internal(res, "Failed to load miniapp");
  }
  if (!existing) {
    return apiError.notFound(res, "Miniapp not found");
  }

  const manifest = asObject((existing as MiniAppStatusRow).manifest);
  const manifestAdmin = asObject(manifest.admin);
  const nextManifest = {
    ...manifest,
    admin: {
      ...manifestAdmin,
      lifecycle_status: status,
      status_updated_at: new Date().toISOString(),
      status_updated_by: admin.kind === "wallet" ? admin.value : "api_key",
    },
  };
  const manifestHash = computeManifestHashHex(nextManifest);

  const { data: updated, error: updateError } = await supabase
    .from("miniapps")
    .update({
      status,
      manifest: nextManifest,
      manifest_hash: manifestHash,
    })
    .eq("app_id", appId)
    .select(SELECT_COLUMNS)
    .single();

  if (updateError || !updated) {
    logger.error("miniapp status update failed:", updateError?.message || "unknown error");
    return apiError.internal(res, "Failed to update miniapp status");
  }

  const app = coerceMiniAppInfo(updated);
  if (!app) {
    return apiError.internal(res, "Status updated but response normalization failed");
  }

  res.setHeader("Cache-Control", "no-store, private");
  return res.status(200).json({
    success: true,
    app,
  });
}

export default withCsrfProtection(handler);
