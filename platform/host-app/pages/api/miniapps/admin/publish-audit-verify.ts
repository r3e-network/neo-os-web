import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { withCsrfProtection } from "@/lib/csrf";
import { verifyPublishApprovalAuditChain } from "@/lib/publish-approval-audit-verify";
import { standardLimit } from "@/lib/rate-limit";
import {
  getServerSupabaseClient,
  hasServiceRoleSupabase,
} from "@/lib/server-supabase";

const APP_ID_REGEX = /^[a-z0-9][a-z0-9._-]*$/;
const REQUEST_ID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

function asTrimmed(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function getQueryString(req: NextApiRequest, key: string): string {
  const value = req.query[key];
  if (Array.isArray(value)) return asTrimmed(value[0]);
  return asTrimmed(value);
}

function parseLimit(value: string): number {
  if (!value) return 1000;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1000;
  return parsed;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;

  if (!hasServiceRoleSupabase()) {
    return apiError.configError(
      res,
      "SUPABASE_SERVICE_ROLE_KEY is required for audit verification",
    );
  }

  const admin = await requireMiniAppAdmin(req, res);
  if (!admin) return;

  const appId = getQueryString(req, "app_id").toLowerCase();
  const requestId = getQueryString(req, "request_id").toLowerCase();
  const limit = parseLimit(getQueryString(req, "limit"));

  if (appId && !APP_ID_REGEX.test(appId)) {
    return apiError.badRequest(res, "Invalid app_id format");
  }
  if (requestId && !REQUEST_ID_REGEX.test(requestId)) {
    return apiError.badRequest(res, "Invalid request_id format");
  }

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(
      res,
      "Supabase service role client unavailable",
    );
  }

  const result = await verifyPublishApprovalAuditChain(supabase, {
    appId: appId || undefined,
    requestId: requestId || undefined,
    limit,
  });

  res.setHeader("Cache-Control", "no-store, private");
  res.status(result.ok ? 200 : 409).json(result);
  return;
}

export default withCsrfProtection(handler);
