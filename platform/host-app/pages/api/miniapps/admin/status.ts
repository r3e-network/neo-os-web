import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { computeManifestHashHex } from "@/lib/miniapp-admin";
import type { MiniAppUpsertRow } from "@/lib/miniapp-admin";
import { recordMiniAppVersion } from "@/lib/miniapp-versioning";
import { coerceMiniAppInfo } from "@/lib/miniapp";
import { strictLimit } from "@/lib/rate-limit";
import {
  getServerSupabaseClient,
  hasServiceRoleSupabase,
} from "@/lib/server-supabase";

const APP_ID_REGEX = /^[a-z0-9][a-z0-9._-]*$/;
const STATUS_VALUES = new Set(["pending", "active", "disabled"]);
const SELECT_COLUMNS =
  "app_id,name,description,icon,category,entry_url,contract_hash,status,permissions,limits,logo_url,banner_url,docs_url,developer_user_id,developer_pubkey,assets_allowed,governance_assets_allowed,manifest_hash,manifest";

type StatusValue = "pending" | "active" | "disabled";

type MiniAppStatusRow = {
  app_id: string;
  name?: string;
  description?: string | null;
  icon?: string | null;
  category?: string | null;
  entry_url?: string;
  contract_hash?: string | null;
  status?: string | null;
  permissions?: Record<string, unknown> | null;
  limits?: Record<string, unknown> | null;
  logo_url?: string | null;
  banner_url?: string | null;
  docs_url?: string | null;
  developer_user_id?: string;
  developer_pubkey?: string | null;
  assets_allowed?: string[] | null;
  governance_assets_allowed?: string[] | null;
  manifest_hash?: string;
  manifest: Record<string, unknown> | null;
};

function normalizeCategory(value: unknown): MiniAppUpsertRow["category"] {
  const normalized = asTrimmedString(value).toLowerCase();
  if (
    normalized === "gaming" ||
    normalized === "defi" ||
    normalized === "governance" ||
    normalized === "utility" ||
    normalized === "social" ||
    normalized === "nft" ||
    normalized === "data" ||
    normalized === "other"
  ) {
    return normalized;
  }
  return "utility";
}

function toArray(value: unknown, fallback: string): string[] {
  if (Array.isArray(value)) {
    const items = value.map((item) => asTrimmedString(item)).filter(Boolean);
    return items.length > 0 ? items : [fallback];
  }
  return [fallback];
}

function toMiniAppUpsertRow(row: MiniAppStatusRow): MiniAppUpsertRow | null {
  const appId = asTrimmedString(row.app_id).toLowerCase();
  const entryUrl = asTrimmedString(row.entry_url);
  const developerUserId = asTrimmedString(row.developer_user_id);
  const manifestHash = asTrimmedString(row.manifest_hash);
  const manifest = asObject(row.manifest);

  if (
    !appId ||
    !entryUrl ||
    !developerUserId ||
    !manifestHash ||
    !Object.keys(manifest).length
  ) {
    return null;
  }

  const rawStatus = asTrimmedString(row.status).toLowerCase();
  const status: MiniAppUpsertRow["status"] =
    rawStatus === "active"
      ? "active"
      : rawStatus === "disabled"
        ? "disabled"
        : "pending";

  return {
    app_id: appId,
    name: asTrimmedString(row.name) || appId,
    description: asTrimmedString(row.description),
    icon: asTrimmedString(row.icon) || "🧩",
    category: normalizeCategory(row.category),
    entry_url: entryUrl,
    contract_hash: asTrimmedString(row.contract_hash) || null,
    status,
    permissions: asObject(row.permissions) as MiniAppUpsertRow["permissions"],
    limits: asObject(row.limits) as MiniAppUpsertRow["limits"],
    logo_url: asTrimmedString(row.logo_url) || null,
    banner_url: asTrimmedString(row.banner_url) || null,
    docs_url: asTrimmedString(row.docs_url) || null,
    developer_user_id: developerUserId,
    developer_pubkey: asTrimmedString(row.developer_pubkey),
    assets_allowed: toArray(row.assets_allowed, "GAS"),
    governance_assets_allowed: toArray(row.governance_assets_allowed, "BNEO"),
    manifest_hash: manifestHash,
    manifest,
  };
}

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
    return apiError.configError(
      res,
      "SUPABASE_SERVICE_ROLE_KEY is required for admin miniapp writes",
    );
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
    return apiError.configError(
      res,
      "Supabase service role client unavailable",
    );
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
    logger.error(
      "miniapp status update failed:",
      updateError instanceof Error ? updateError.message : "unknown error",
    );
    return apiError.internal(res, "Failed to update miniapp status");
  }

  const app = coerceMiniAppInfo(updated);
  if (!app) {
    return apiError.internal(
      res,
      "Status updated but response normalization failed",
    );
  }

  const versionRow = toMiniAppUpsertRow(updated as MiniAppStatusRow);
  if (!versionRow) {
    return apiError.internal(
      res,
      "Status updated but failed to build version snapshot",
    );
  }

  const versionAction: "save_draft" | "publish" | "disable" =
    status === "active"
      ? "publish"
      : status === "disabled"
        ? "disable"
        : "save_draft";

  try {
    await recordMiniAppVersion(supabase, {
      row: versionRow,
      action: versionAction,
      actor: admin.kind === "wallet" ? admin.value : "api_key",
    });
  } catch (versionError) {
    logger.error(
      "miniapp status version write failed:",
      versionError instanceof Error ? versionError.message : "unknown error",
    );
    return apiError.internal(
      res,
      "Status updated but failed to write version snapshot",
    );
  }

  res.setHeader("Cache-Control", "no-store, private");
  res.status(200).json({
    success: true,
    app,
  });
  return;
}

export default withCsrfProtection(handler);
