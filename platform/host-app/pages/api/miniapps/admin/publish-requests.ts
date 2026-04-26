import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import {
  classifyPublishRequestTiming,
  getPublishRequestEscalationMinutes,
  getPublishRequestSlaMinutes,
  isReviewer,
  listPublishRequests,
  updatePublishRequestStatus,
  type PublishRequestStatus,
} from "@/lib/miniapp-publish-approval";
import { normalizeMiniAppAdminPayload } from "@/lib/miniapp-admin";
import { appendPublishApprovalAuditEvent } from "@/lib/publish-approval-audit";
import { recordMiniAppVersion } from "@/lib/miniapp-versioning";
import { strictLimit } from "@/lib/rate-limit";
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

function parseStatus(value: unknown): PublishRequestStatus | "all" {
  const normalized = asTrimmed(value).toLowerCase();
  if (
    normalized === "pending" ||
    normalized === "approved" ||
    normalized === "rejected" ||
    normalized === "applied" ||
    normalized === "cancelled"
  ) {
    return normalized;
  }
  return "all";
}

async function handleList(req: NextApiRequest, res: NextApiResponse) {
  const appId = asTrimmed(req.query.app_id).toLowerCase();
  if (appId && !APP_ID_REGEX.test(appId)) {
    return apiError.badRequest(res, "Invalid app_id format");
  }

  const status = parseStatus(req.query.status);
  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(
      res,
      "Supabase service role client unavailable",
    );
  }

  try {
    const requests = await listPublishRequests(supabase, {
      appId: appId || undefined,
      status,
      limit: 100,
    });

    const withTiming = requests.map((request) => ({
      ...request,
      timing: classifyPublishRequestTiming(request.requested_at),
    }));

    const pending = withTiming.filter(
      (request) => request.status === "pending",
    );
    const slaBreached = pending.filter(
      (request) => request.timing.isSlaBreached,
    ).length;
    const escalated = pending.filter(
      (request) => request.timing.isEscalated,
    ).length;

    res.setHeader("Cache-Control", "no-store, private");
    res.status(200).json({
      requests: withTiming,
      status,
      sla: {
        minutes: getPublishRequestSlaMinutes(),
        escalation_minutes: getPublishRequestEscalationMinutes(),
        pending: pending.length,
        sla_breached: slaBreached,
        escalated,
      },
    });
    return;
  } catch (error) {
    logger.error(
      "miniapp publish request list failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return apiError.internal(res, "Failed to load publish requests");
  }
}

async function handleReview(
  req: NextApiRequest,
  res: NextApiResponse,
  actor: string,
) {
  if (!isReviewer(actor)) {
    return apiError.forbidden(
      res,
      "Actor is not allowed to review publish requests",
    );
  }

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return apiError.badRequest(res, "Missing request body");
  }
  const payload = body as Record<string, unknown>;

  const requestId = asTrimmed(payload.request_id).toLowerCase();
  if (!REQUEST_ID_REGEX.test(requestId)) {
    return apiError.badRequest(res, "Invalid request_id format");
  }

  const decision = asTrimmed(payload.decision).toLowerCase();
  if (
    decision !== "approve" &&
    decision !== "reject" &&
    decision !== "cancel"
  ) {
    return apiError.badRequest(res, "decision must be approve/reject/cancel");
  }

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(
      res,
      "Supabase service role client unavailable",
    );
  }

  const { data: requestRow, error: requestError } = await supabase
    .from("miniapp_publish_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (requestError || !requestRow) {
    return apiError.notFound(res, "Publish request not found");
  }

  const requestStatus = asTrimmed(requestRow.status).toLowerCase();
  if (requestStatus !== "pending") {
    return apiError.badRequest(res, "Publish request is not pending");
  }

  const requestedBy = asTrimmed(requestRow.requested_by).toLowerCase();
  const normalizedActor = asTrimmed(actor).toLowerCase();
  if (
    requestedBy &&
    normalizedActor &&
    requestedBy !== "api_key" &&
    normalizedActor !== "api_key" &&
    requestedBy === normalizedActor
  ) {
    return apiError.forbidden(
      res,
      "Requester cannot approve their own publish request",
    );
  }

  if (decision === "reject") {
    try {
      const updated = await updatePublishRequestStatus(supabase, {
        requestId,
        status: "rejected",
        reviewer: actor,
        reviewNote: asTrimmed(payload.review_note) || null,
      });

      await appendPublishApprovalAuditEvent(supabase, {
        request_id: requestId,
        app_id: asTrimmed(requestRow.app_id),
        actor,
        action: "request_rejected",
        status: updated.status,
        payload: {
          review_note: asTrimmed(payload.review_note) || null,
        },
      });

      res.status(200).json({ success: true, request: updated });
      return;
    } catch (error) {
      logger.error(
        "miniapp publish request reject failed:",
        error instanceof Error ? error.message : "unknown error",
      );
      return apiError.internal(res, "Failed to reject publish request");
    }
  }

  if (decision === "cancel") {
    try {
      const updated = await updatePublishRequestStatus(supabase, {
        requestId,
        status: "cancelled",
        reviewer: actor,
        reviewNote: asTrimmed(payload.review_note) || null,
      });

      await appendPublishApprovalAuditEvent(supabase, {
        request_id: requestId,
        app_id: asTrimmed(requestRow.app_id),
        actor,
        action: "request_cancelled",
        status: updated.status,
        payload: {
          review_note: asTrimmed(payload.review_note) || null,
        },
      });

      res.status(200).json({ success: true, request: updated });
      return;
    } catch (error) {
      logger.error(
        "miniapp publish request cancel failed:",
        error instanceof Error ? error.message : "unknown error",
      );
      return apiError.internal(res, "Failed to cancel publish request");
    }
  }

  try {
    const updated = await updatePublishRequestStatus(supabase, {
      requestId,
      status: "approved",
      reviewer: actor,
      reviewNote: asTrimmed(payload.review_note) || null,
    });

    await appendPublishApprovalAuditEvent(supabase, {
      request_id: requestId,
      app_id: asTrimmed(requestRow.app_id),
      actor,
      action: "request_approved",
      status: updated.status,
      payload: {
        review_note: asTrimmed(payload.review_note) || null,
      },
    });

    const appId = asTrimmed(requestRow.app_id).toLowerCase();
    if (!APP_ID_REGEX.test(appId)) {
      return apiError.internal(res, "Publish request app_id is invalid");
    }

    const { data: appRow, error: appError } = await supabase
      .from("miniapps")
      .select(
        "app_id,name,description,icon,category,entry_url,contract_hash,status,permissions,limits,logo_url,banner_url,docs_url,developer_user_id,developer_pubkey,assets_allowed,governance_assets_allowed,manifest",
      )
      .eq("app_id", appId)
      .single();

    if (appError || !appRow) {
      return apiError.internal(
        res,
        "Failed to load app row for publish approval",
      );
    }

    const normalized = normalizeMiniAppAdminPayload(
      {
        ...(appRow as Record<string, unknown>),
        app_id: appId,
        action: "publish",
      },
      {
        existing: appRow as Record<string, unknown>,
        actor,
      },
    );

    if (!normalized.ok) {
      return apiError.internal(
        res,
        `Publish approval normalization failed: ${normalized.error}`,
      );
    }

    const { data: upserted, error: upsertError } = await supabase
      .from("miniapps")
      .upsert(normalized.row, { onConflict: "app_id" })
      .select(
        "app_id,name,description,icon,category,entry_url,contract_hash,status,permissions,limits,logo_url,banner_url,docs_url,manifest",
      )
      .single();

    if (upsertError || !upserted) {
      return apiError.internal(res, "Failed to apply approved publish request");
    }

    const version = await recordMiniAppVersion(supabase, {
      row: normalized.row,
      action: "publish",
      actor,
      note: `applied approved publish request ${requestId}`,
    });

    const applied = await updatePublishRequestStatus(supabase, {
      requestId,
      status: "applied",
      reviewer: actor,
      reviewNote: asTrimmed(payload.review_note) || null,
      appliedVersionId: version.version.id,
    });

    await appendPublishApprovalAuditEvent(supabase, {
      request_id: requestId,
      app_id: appId,
      actor,
      action: "request_applied",
      status: applied.status,
      payload: {
        applied_version_id: version.version.id,
        applied_version_no: version.version.version_no,
      },
    });

    res.status(200).json({
      success: true,
      request: applied,
      app: upserted,
      version: {
        id: version.version.id,
        version_no: version.version.version_no,
      },
    });
    return;
  } catch (error) {
    logger.error(
      "miniapp publish request approve failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return apiError.internal(res, "Failed to approve publish request");
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }
  if (strictLimit(req, res)) return;

  if (!hasServiceRoleSupabase()) {
    return apiError.configError(
      res,
      "SUPABASE_SERVICE_ROLE_KEY is required for publish request workflows",
    );
  }

  const admin = await requireMiniAppAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    return handleList(req, res);
  }

  return handleReview(
    req,
    res,
    admin.kind === "wallet" ? admin.value : "api_key",
  );
}

export default withCsrfProtection(handler);
