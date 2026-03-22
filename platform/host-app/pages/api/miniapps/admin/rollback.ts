import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { rollbackMiniAppVersion } from "@/lib/miniapp-versioning";
import { coerceMiniAppInfo } from "@/lib/miniapp";
import { strictLimit } from "@/lib/rate-limit";
import { getServerSupabaseClient, hasServiceRoleSupabase } from "@/lib/server-supabase";
import {
  APP_ID_REGEX,
  VERSION_ID_REGEX,
  asTrimmedString,
  parseRollbackReleaseChannel,
  parseVersionNo,
} from "@/pages/api/miniapps/admin/version-utils";

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
  const payload = body as Record<string, unknown>;

  const appId = asTrimmedString(payload.app_id).toLowerCase();
  if (!APP_ID_REGEX.test(appId)) {
    return apiError.badRequest(res, "Invalid app_id format");
  }

  const versionId = asTrimmedString(payload.version_id).toLowerCase();
  const versionNo = parseVersionNo(payload.version_no);
  if (!versionId && versionNo === null) {
    return apiError.badRequest(res, "Either version_id or version_no is required");
  }
  if (versionId && !VERSION_ID_REGEX.test(versionId)) {
    return apiError.badRequest(res, "Invalid version_id format");
  }

  const releaseChannel = parseRollbackReleaseChannel(payload.release_channel);
  const note = asTrimmedString(payload.note);

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(res, "Supabase service role client unavailable");
  }

  try {
    const rolled = await rollbackMiniAppVersion(supabase, {
      appId,
      versionId: versionId || undefined,
      versionNo: versionNo ?? undefined,
      releaseChannel,
      actor: admin.kind === "wallet" ? admin.value : "api_key",
      note: note || undefined,
    });

    const { data: upserted, error: upsertError } = await supabase
      .from("miniapps")
      .upsert(rolled.row, { onConflict: "app_id" })
      .select("app_id,name,description,icon,category,entry_url,contract_hash,status,permissions,limits,logo_url,banner_url,docs_url,manifest")
      .single();

    if (upsertError || !upserted) {
      logger.error("miniapp rollback upsert failed:", upsertError instanceof Error ? upsertError.message : "unknown error");
      return apiError.internal(res, "Rollback snapshot applied but failed to update miniapp row");
    }

    const app = coerceMiniAppInfo(upserted);
    if (!app) {
      return apiError.internal(res, "Rollback applied but failed to normalize miniapp response");
    }

    res.setHeader("Cache-Control", "no-store, private");
    return res.status(200).json({
      success: true,
      app,
      rollback: {
        target_version_id: rolled.targetVersion.id,
        target_version_no: rolled.targetVersion.version_no,
        new_version_id: rolled.newVersion.id,
        new_version_no: rolled.newVersion.version_no,
        release_channel: releaseChannel,
      },
    });
  } catch (error) {
    logger.error("miniapp rollback failed:", error instanceof Error ? error.message : "unknown error");
    return apiError.internal(res, "Failed to rollback miniapp version");
  }
}

export default withCsrfProtection(handler);
