import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { normalizeMiniAppAdminPayload } from "@/lib/miniapp-admin";
import { coerceMiniAppInfo } from "@/lib/miniapp";
import { strictLimit } from "@/lib/rate-limit";
import { getServerSupabaseClient, hasServiceRoleSupabase } from "@/lib/server-supabase";

const APP_ID_REGEX = /^[a-z0-9][a-z0-9._-]*$/;
const SELECT_COLUMNS =
  "app_id,name,description,icon,category,entry_url,contract_hash,status,permissions,limits,logo_url,banner_url,docs_url,manifest";

type ExistingRow = {
  app_id?: string;
  name?: string | null;
  description?: string | null;
  icon?: string | null;
  category?: string | null;
  entry_url?: string | null;
  contract_hash?: string | null;
  status?: string | null;
  permissions?: Record<string, unknown> | null;
  limits?: Record<string, unknown> | null;
  logo_url?: string | null;
  banner_url?: string | null;
  docs_url?: string | null;
  developer_user_id?: string | null;
  developer_pubkey?: string | null;
  assets_allowed?: string[] | null;
  governance_assets_allowed?: string[] | null;
  manifest?: Record<string, unknown> | null;
};

function asTrimmedString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
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
  const candidateAppId = asTrimmedString(bodyObj.app_id).toLowerCase();

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(res, "Supabase service role client unavailable");
  }

  let existing: ExistingRow | null = null;
  if (candidateAppId && APP_ID_REGEX.test(candidateAppId)) {
    const { data, error } = await supabase
      .from("miniapps")
      .select(
        "app_id,name,description,icon,category,entry_url,contract_hash,status,permissions,limits,logo_url,banner_url,docs_url,developer_user_id,developer_pubkey,assets_allowed,governance_assets_allowed,manifest",
      )
      .eq("app_id", candidateAppId)
      .maybeSingle();

    if (error) {
      logger.error("miniapp admin upsert existing fetch error:", error.message);
      return apiError.internal(res, "Failed to load existing miniapp");
    }
    existing = (data as ExistingRow | null) || null;
  }

  const normalized = normalizeMiniAppAdminPayload(body, {
    existing,
    actor: admin.kind === "wallet" ? admin.value : "api_key",
    defaultDeveloperUserId: process.env.MINIAPP_ADMIN_DEFAULT_DEVELOPER_USER_ID,
  });

  if (!normalized.ok) {
    return apiError.badRequest(res, normalized.error);
  }

  const { data: upserted, error: upsertError } = await supabase
    .from("miniapps")
    .upsert(normalized.row, { onConflict: "app_id" })
    .select(SELECT_COLUMNS)
    .single();

  if (upsertError || !upserted) {
    logger.error("miniapp admin upsert failed:", upsertError?.message || "unknown error");
    return apiError.internal(res, "Failed to save miniapp");
  }

  const app = coerceMiniAppInfo(upserted);
  if (!app) {
    return apiError.internal(res, "Miniapp saved but response normalization failed");
  }

  res.setHeader("Cache-Control", "no-store, private");
  return res.status(existing ? 200 : 201).json({
    success: true,
    action: normalized.action,
    blueprint: normalized.blueprint,
    app,
  });
}

export default withCsrfProtection(handler);
