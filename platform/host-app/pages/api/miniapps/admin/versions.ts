import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { listMiniAppVersions } from "@/lib/miniapp-versioning";
import { standardLimit } from "@/lib/rate-limit";
import {
  getServerSupabaseClient,
  hasServiceRoleSupabase,
} from "@/lib/server-supabase";
import {
  APP_ID_REGEX,
  asTrimmedString,
  getQueryString,
  parseReleaseChannel,
} from "@/pages/api/miniapps/admin/version-utils";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;

  if (!hasServiceRoleSupabase()) {
    return apiError.configError(
      res,
      "SUPABASE_SERVICE_ROLE_KEY is required for admin miniapp reads",
    );
  }

  const admin = await requireMiniAppAdmin(req, res);
  if (!admin) return;

  const appId = getQueryString(req, "app_id").toLowerCase();
  if (!APP_ID_REGEX.test(appId)) {
    return apiError.badRequest(res, "Invalid app_id format");
  }

  const releaseChannel = parseReleaseChannel(
    getQueryString(req, "release_channel"),
  );
  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(
      res,
      "Supabase service role client unavailable",
    );
  }

  try {
    const includePayload =
      asTrimmedString(req.query.include_payload).toLowerCase() === "true";
    const payload = await listMiniAppVersions(supabase, {
      appId,
      releaseChannel,
      limit: 100,
      includePayload,
    });

    res.setHeader("Cache-Control", "no-store, private");
    res.status(200).json(payload);
    return;
  } catch (error) {
    logger.error(
      "miniapp admin versions list failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return apiError.internal(res, "Failed to load miniapp versions");
  }
}

export default withCsrfProtection(handler);
