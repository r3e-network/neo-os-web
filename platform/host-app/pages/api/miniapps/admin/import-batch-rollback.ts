import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { normalizeMiniAppAdminPayload } from "@/lib/miniapp-admin";
import {
  recordMiniAppVersion,
  rollbackMiniAppVersion,
} from "@/lib/miniapp-versioning";
import { strictLimit } from "@/lib/rate-limit";
import {
  getServerSupabaseClient,
  hasServiceRoleSupabase,
} from "@/lib/server-supabase";

type Dict = Record<string, unknown>;

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

type RollbackTargetInput = {
  app_id: string;
  mode?: "create" | "update";
  rollback_version_id?: string | null;
  rollback_release_channel?: "draft" | "published" | null;
};

const APP_ID_REGEX = /^[a-z0-9][a-z0-9._-]*$/;
const VERSION_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asObject(value: unknown): Dict {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Dict;
}

function asTrimmedString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function parseTargets(value: unknown): RollbackTargetInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asObject(item))
    .map((item) => ({
      app_id: asTrimmedString(item.app_id).toLowerCase(),
      mode:
        asTrimmedString(item.mode).toLowerCase() === "create"
          ? "create"
          : "update",
      rollback_version_id:
        asTrimmedString(item.rollback_version_id).toLowerCase() || null,
      rollback_release_channel:
        asTrimmedString(item.rollback_release_channel).toLowerCase() === "draft"
          ? "draft"
          : "published",
    }));
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

  const body = asObject(req.body);
  const targets = parseTargets(body.targets);
  if (!targets.length) {
    return apiError.badRequest(
      res,
      "targets is required and must be a non-empty array",
    );
  }
  if (targets.length > 200) {
    return apiError.badRequest(
      res,
      "targets allows at most 200 items per rollback batch",
    );
  }

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(
      res,
      "Supabase service role client unavailable",
    );
  }

  const actor = admin.kind === "wallet" ? admin.value : "api_key";
  const results: Array<{
    app_id: string;
    status: "rolled_back" | "disabled_created_app" | "noop" | "failed";
    detail?: string;
  }> = [];

  for (const target of targets) {
    try {
      if (!APP_ID_REGEX.test(target.app_id)) {
        throw new Error("Invalid app_id format");
      }

      if (target.rollback_version_id) {
        if (!VERSION_ID_REGEX.test(target.rollback_version_id)) {
          throw new Error("Invalid rollback_version_id format");
        }

        const rolled = await rollbackMiniAppVersion(supabase, {
          appId: target.app_id,
          versionId: target.rollback_version_id,
          releaseChannel: target.rollback_release_channel || "published",
          actor,
          note: "import_batch_rollback",
        });

        const { error: upsertError } = await supabase
          .from("miniapps")
          .upsert(rolled.row, { onConflict: "app_id" });
        if (upsertError) {
          throw new Error(
            `Rollback applied but failed to update miniapp row: ${upsertError.message}`,
          );
        }

        results.push({
          app_id: target.app_id,
          status: "rolled_back",
          detail: `reverted to version ${rolled.targetVersion.version_no}`,
        });
        continue;
      }

      if (target.mode !== "create") {
        throw new Error("rollback_version_id is required for update rollback");
      }

      const { data: existingRow, error: existingError } = await supabase
        .from("miniapps")
        .select(
          "app_id,name,description,icon,category,entry_url,contract_hash,status,permissions,limits,logo_url,banner_url,docs_url,developer_user_id,developer_pubkey,assets_allowed,governance_assets_allowed,manifest",
        )
        .eq("app_id", target.app_id)
        .maybeSingle();

      if (existingError) {
        throw new Error(
          `Failed to load created app for rollback: ${existingError.message}`,
        );
      }
      if (!existingRow) {
        results.push({
          app_id: target.app_id,
          status: "noop",
          detail: "app not found",
        });
        continue;
      }

      const normalized = normalizeMiniAppAdminPayload(
        {
          ...asObject((existingRow as ExistingRow).manifest),
          app_id: target.app_id,
          action: "disable",
        },
        {
          existing: existingRow as ExistingRow,
          actor,
          defaultDeveloperUserId:
            process.env.MINIAPP_ADMIN_DEFAULT_DEVELOPER_USER_ID,
        },
      );
      if (!normalized.ok) {
        throw new Error(normalized.error);
      }

      const { error: disableUpsertError } = await supabase
        .from("miniapps")
        .upsert(normalized.row, { onConflict: "app_id" });
      if (disableUpsertError) {
        throw new Error(
          `Failed to disable created app: ${disableUpsertError.message}`,
        );
      }

      await recordMiniAppVersion(supabase, {
        row: normalized.row,
        action: normalized.action,
        actor,
        note: "import_batch_rollback_create_disable",
      });

      results.push({
        app_id: target.app_id,
        status: "disabled_created_app",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown rollback error";
      logger.error("import batch rollback item failed:", message);
      results.push({
        app_id: target.app_id,
        status: "failed",
        detail: message,
      });
    }
  }

  const summary = results.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.status === "failed") acc.failed += 1;
      if (item.status === "rolled_back") acc.rolled_back += 1;
      if (item.status === "disabled_created_app") acc.disabled_created_app += 1;
      if (item.status === "noop") acc.noop += 1;
      return acc;
    },
    { total: 0, failed: 0, rolled_back: 0, disabled_created_app: 0, noop: 0 },
  );

  res.setHeader("Cache-Control", "no-store, private");
  res.status(200).json({
    success: summary.failed === 0,
    summary,
    results,
  });
  return;
}

export default withCsrfProtection(handler);
