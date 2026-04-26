import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { normalizeMiniAppAdminPayload } from "@/lib/miniapp-admin";
import {
  createPublishRequest,
  getPendingPublishRequest,
  isApprovalRequired,
} from "@/lib/miniapp-publish-approval";
import { coerceMiniAppInfo } from "@/lib/miniapp";
import { appendPublishApprovalAuditEvent } from "@/lib/publish-approval-audit";
import { recordMiniAppVersion } from "@/lib/miniapp-versioning";
import { strictLimit } from "@/lib/rate-limit";
import {
  getServerSupabaseClient,
  hasServiceRoleSupabase,
} from "@/lib/server-supabase";

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
  const candidateAppId = asTrimmedString(bodyObj.app_id).toLowerCase();

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(
      res,
      "Supabase service role client unavailable",
    );
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
      logger.error(
        "miniapp admin upsert existing fetch error:",
        error instanceof Error ? error.message : String(error),
      );
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

  const approvalRequired = isApprovalRequired();
  const requestedPublish = normalized.action === "publish";
  const forcePublish =
    asTrimmedString(bodyObj.publish_override).toLowerCase() === "true";

  if (approvalRequired && requestedPublish && !forcePublish) {
    const pending = await getPendingPublishRequest(
      supabase,
      normalized.row.app_id,
    );
    if (pending) {
      return apiError.badRequest(
        res,
        `Publish request already pending for ${normalized.row.app_id}`,
      );
    }

    let latestVersion: {
      id: string;
      version_no: number;
    } | null = null;
    try {
      const recorded = await recordMiniAppVersion(supabase, {
        row: {
          ...normalized.row,
          status: "pending",
        },
        action: "save_draft",
        actor: admin.kind === "wallet" ? admin.value : "api_key",
        note: "publish request draft snapshot",
      });
      latestVersion = {
        id: recorded.version.id,
        version_no: recorded.version.version_no,
      };
    } catch (error) {
      logger.error(
        "miniapp publish request version write failed:",
        error instanceof Error ? error.message : "unknown error",
      );
      return apiError.internal(res, "Failed to save publish request snapshot");
    }

    try {
      const request = await createPublishRequest(supabase, {
        appId: normalized.row.app_id,
        requestedVersionId: latestVersion?.id || null,
        requestedVersionNo: latestVersion?.version_no || null,
        requestedManifestHash: normalized.row.manifest_hash,
        requestedBy: admin.kind === "wallet" ? admin.value : "api_key",
        requestNote: asTrimmedString(bodyObj.publish_note) || null,
      });

      await appendPublishApprovalAuditEvent(supabase, {
        request_id: request.id,
        app_id: request.app_id,
        actor: admin.kind === "wallet" ? admin.value : "api_key",
        action: "request_created",
        status: request.status,
        payload: {
          requested_version_id: request.requested_version_id,
          requested_version_no: request.requested_version_no,
          requested_manifest_hash: request.requested_manifest_hash,
          request_note: request.request_note,
        },
      });

      res.status(202).json({
        success: true,
        action: "publish_requested",
        blueprint: normalized.blueprint,
        approval_required: true,
        request,
      });
      return;
    } catch (error) {
      logger.error(
        "miniapp publish request creation failed:",
        error instanceof Error ? error.message : "unknown error",
      );
      return apiError.internal(res, "Failed to create publish request");
    }
  }

  const { data: upserted, error: upsertError } = await supabase
    .from("miniapps")
    .upsert(normalized.row, { onConflict: "app_id" })
    .select(SELECT_COLUMNS)
    .single();

  if (upsertError || !upserted) {
    logger.error(
      "miniapp admin upsert failed:",
      upsertError instanceof Error ? upsertError.message : "unknown error",
    );
    return apiError.internal(res, "Failed to save miniapp");
  }

  const app = coerceMiniAppInfo(upserted);
  if (!app) {
    return apiError.internal(
      res,
      "Miniapp saved but response normalization failed",
    );
  }

  let versionInfo: {
    id: string;
    app_id: string;
    version_no: number;
    release_channel: "draft" | "published";
    source_action: "save_draft" | "publish" | "disable" | "rollback";
  } | null = null;

  try {
    const version = await recordMiniAppVersion(supabase, {
      row: normalized.row,
      action: normalized.action,
      actor: admin.kind === "wallet" ? admin.value : "api_key",
    });
    versionInfo = {
      id: version.version.id,
      app_id: version.version.app_id,
      version_no: version.version.version_no,
      release_channel: version.version.release_channel,
      source_action: version.version.source_action,
    };
  } catch (versionError) {
    logger.error(
      "miniapp version write failed:",
      versionError instanceof Error ? versionError.message : "unknown error",
    );
    return apiError.internal(
      res,
      "Miniapp saved but failed to write version snapshot",
    );
  }

  res.setHeader("Cache-Control", "no-store, private");
  res.status(existing ? 200 : 201).json({
    success: true,
    action: normalized.action,
    blueprint: normalized.blueprint,
    version: versionInfo,
    app,
  });
  return;
}

export default withCsrfProtection(handler);
