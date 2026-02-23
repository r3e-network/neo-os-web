import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { strictLimit } from "@/lib/rate-limit";
import { getServerSupabaseClient, hasServiceRoleSupabase } from "@/lib/server-supabase";
import {
  createTemplatePublishRequest,
  isTemplateApprovalRequired,
  isTemplateReviewer,
  listTemplateEntries,
  listTemplatePublishRequests,
  normalizeTemplateId,
  normalizeTemplateKind,
  normalizeTemplateSourceType,
  setTemplateEntryPublishState,
  updateTemplatePublishRequestStatus,
  upsertTemplateEntry,
  type TemplateKind,
  type TemplatePublishRequestStatus,
} from "@/lib/template-market";

type Dict = Record<string, unknown>;

function asObject(value: unknown): Dict {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Dict;
}

function asTrimmedString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") return false;
  }
  return fallback;
}

function parseStatus(value: unknown): TemplatePublishRequestStatus | "all" {
  const raw = asTrimmedString(value).toLowerCase();
  if (raw === "pending" || raw === "approved" || raw === "rejected" || raw === "cancelled") {
    return raw;
  }
  return "all";
}

function parseListLimit(value: unknown, fallback = 100): number {
  const parsed = Number.parseInt(asTrimmedString(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.min(parsed, 300));
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(res, "Supabase service role client unavailable");
  }

  const mode = asTrimmedString(req.query.mode).toLowerCase() || "templates";
  const kind = normalizeTemplateKind(req.query.kind) || (asTrimmedString(req.query.kind).toLowerCase() === "all" ? "all" : null);
  const templateId = normalizeTemplateId(req.query.template_id);
  const category = asTrimmedString(req.query.category);
  const sourceRaw = asTrimmedString(req.query.source).toLowerCase();
  const source = sourceRaw === "builtin" || sourceRaw === "community" || sourceRaw === "verified"
    ? sourceRaw
    : "all";
  const active = asTrimmedString(req.query.active).toLowerCase();
  const verified = asTrimmedString(req.query.verified).toLowerCase();
  const status = parseStatus(req.query.status);
  const search = asTrimmedString(req.query.search);
  const limit = parseListLimit(req.query.limit);

  try {
    if (mode === "requests") {
      const requests = await listTemplatePublishRequests(supabase, {
        kind: kind === "all" ? "all" : kind || "all",
        status,
        limit,
      });
      return res.status(200).json({
        mode,
        requests,
      });
    }

    const templates = await listTemplateEntries(supabase, {
      kind: kind === "all" ? "all" : kind || "all",
      template_id: templateId || undefined,
      category: category || undefined,
      source,
      active: active === "true" || active === "false" ? active : "all",
      verified: verified === "true" || verified === "false" ? verified : "all",
      search: search || undefined,
      limit,
    });

    return res.status(200).json({
      mode: "templates",
      templates,
      approval_required: isTemplateApprovalRequired(),
    });
  } catch (error) {
    logger.error("template market get failed:", error instanceof Error ? error.message : "unknown error");
    return apiError.internal(res, "Failed to load template market data");
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, actor: string) {
  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(res, "Supabase service role client unavailable");
  }

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return apiError.badRequest(res, "Missing request body");
  }

  const payload = body as Dict;
  const action = asTrimmedString(payload.action).toLowerCase();
  if (!action) {
    return apiError.badRequest(res, "action is required");
  }

  if (action === "upsert_template") {
    const kind = normalizeTemplateKind(payload.kind);
    if (!kind) return apiError.badRequest(res, "kind must be frontend or contract");

    const templateId = normalizeTemplateId(payload.template_id);
    if (!templateId) return apiError.badRequest(res, "Invalid template_id format");

    const version = asTrimmedString(payload.version) || "1.0.0";
    const name = asTrimmedString(payload.name) || templateId;
    const description = asTrimmedString(payload.description);
    const category = asTrimmedString(payload.category) || "utility";
    const sourceType = normalizeTemplateSourceType(payload.source_type);
    const tags = Array.isArray(payload.tags)
      ? Array.from(new Set(payload.tags.map((item) => asTrimmedString(item)).filter(Boolean)))
      : [];
    const schema = asObject(payload.schema);
    const uiSchema = asObject(payload.ui_schema);
    const manifest = asObject(payload.manifest);
    const ownerUserId = asTrimmedString(payload.owner_user_id) || null;
    const isActive = asBoolean(payload.is_active, true);
    const isVerified = asBoolean(payload.is_verified, false);
    const factoryTemplateRef = asTrimmedString(payload.factory_template_ref) || null;

    if (!manifest || !Object.keys(manifest).length) {
      return apiError.badRequest(res, "manifest is required");
    }

    try {
      const saved = await upsertTemplateEntry(supabase, {
        kind,
        template_id: templateId,
        version,
        owner_user_id: ownerUserId,
        name,
        description,
        category,
        schema,
        ui_schema: uiSchema,
        manifest,
        source_type: sourceType,
        tags,
        is_active: isActive,
        is_verified: isVerified,
        factory_template_ref: factoryTemplateRef,
      });

      if (!isTemplateApprovalRequired()) {
        return res.status(201).json({
          success: true,
          action,
          template: saved,
          approval_required: false,
        });
      }

      const request = await createTemplatePublishRequest(supabase, {
        templateKind: kind,
        templateRowId: saved.row_id,
        requestedBy: actor,
      });

      return res.status(202).json({
        success: true,
        action: "publish_requested",
        template: saved,
        request,
        approval_required: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upsert template";
      return apiError.badRequest(res, message);
    }
  }

  if (action === "review_request") {
    if (!isTemplateReviewer(actor)) {
      return apiError.forbidden(res, "Actor is not allowed to review template publish requests");
    }

    const requestId = asTrimmedString(payload.request_id).toLowerCase();
    if (!requestId) return apiError.badRequest(res, "request_id is required");

    const decision = asTrimmedString(payload.decision).toLowerCase();
    if (decision !== "approve" && decision !== "reject" && decision !== "cancel") {
      return apiError.badRequest(res, "decision must be approve/reject/cancel");
    }

    const existing = await (async () => {
      const { data, error } = await supabase
        .from("miniapp_template_publish_requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();
      if (error) throw error;
      return data as Dict | null;
    })();

    if (!existing) {
      return apiError.notFound(res, "Template publish request not found");
    }

    if (asTrimmedString(existing.status).toLowerCase() !== "pending") {
      return apiError.badRequest(res, "Template publish request is not pending");
    }

    const kind = normalizeTemplateKind(existing.template_kind);
    if (!kind) {
      return apiError.internal(res, "Template publish request has invalid kind");
    }

    const status = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "cancelled";
    try {
      const updatedRequest = await updateTemplatePublishRequestStatus(supabase, {
        requestId,
        status,
        reviewer: actor,
        reviewNote: asTrimmedString(payload.review_note) || null,
      });

      let template = null;
      if (decision === "approve") {
        template = await setTemplateEntryPublishState(supabase, {
          kind,
          rowId: asTrimmedString(existing.template_row_id),
          isActive: true,
          isVerified: true,
        });
      }

      return res.status(200).json({
        success: true,
        action,
        request: updatedRequest,
        template,
      });
    } catch (error) {
      logger.error("template market review failed:", error instanceof Error ? error.message : "unknown error");
      return apiError.internal(res, "Failed to review template publish request");
    }
  }

  return apiError.badRequest(res, "Unsupported action");
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }
  if (strictLimit(req, res)) return;

  if (!hasServiceRoleSupabase()) {
    return apiError.configError(res, "SUPABASE_SERVICE_ROLE_KEY is required for template market workflows");
  }

  const admin = await requireMiniAppAdmin(req, res);
  if (!admin) return;

  res.setHeader("Cache-Control", "no-store, private");

  if (req.method === "GET") {
    return handleGet(req, res);
  }

  return handlePost(req, res, admin.kind === "wallet" ? admin.value : "api_key");
}

export default withCsrfProtection(handler);
