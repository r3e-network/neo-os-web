import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { classifyPublishRequestTiming, listPublishRequests } from "@/lib/miniapp-publish-approval";
import { appendPublishApprovalAuditEvent } from "@/lib/publish-approval-audit";
import { sendPublishReminders } from "@/lib/publish-reminder";
import { strictLimit } from "@/lib/rate-limit";
import { getServerSupabaseClient, hasServiceRoleSupabase } from "@/lib/server-supabase";

function parseDryRun(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }
  if (strictLimit(req, res)) return;

  if (!hasServiceRoleSupabase()) {
    return apiError.configError(res, "SUPABASE_SERVICE_ROLE_KEY is required for publish reminder workflows");
  }

  const admin = await requireMiniAppAdmin(req, res);
  if (!admin) return;

  const body = req.body;
  const payload = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const dryRun = parseDryRun(payload.dry_run);

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(res, "Supabase service role client unavailable");
  }

  try {
    const requests = await listPublishRequests(supabase, {
      status: "pending",
      limit: 300,
    });

    const withTiming = requests.map((request) => ({
      ...request,
      timing: classifyPublishRequestTiming(request.requested_at),
    }));

    const result = await sendPublishReminders({
      requests: withTiming,
      dryRun,
    });

    if (result.success && !dryRun) {
      for (const reminder of result.reminders) {
        await appendPublishApprovalAuditEvent(supabase, {
          request_id: reminder.request_id,
          app_id: reminder.app_id,
          actor: admin.kind === "wallet" ? admin.value : "api_key",
          action: "reminder_sent",
          status: reminder.status,
          payload: {
            age_minutes: reminder.age_minutes,
            message: reminder.message,
            channel: result.channel,
          },
        });
      }
    }

    res.setHeader("Cache-Control", "no-store, private");
    return res.status(result.success ? 200 : 502).json(result);
  } catch (error) {
    logger.error("miniapp publish reminder trigger failed:", error instanceof Error ? error.message : "unknown error");
    return apiError.internal(res, "Failed to trigger publish reminders");
  }
}

export default withCsrfProtection(handler);
