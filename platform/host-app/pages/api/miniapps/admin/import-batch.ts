import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { normalizeMiniAppAdminPayload } from "@/lib/miniapp-admin";
import { recordMiniAppVersion } from "@/lib/miniapp-versioning";
import { parseMiniAppDefinitionContent } from "@/lib/miniapp-definitions";
import { validateMiniAppDefinitionAgainstSchema } from "@/lib/miniapp-schema-validator";
import { strictLimit } from "@/lib/rate-limit";
import { getServerSupabaseClient, hasServiceRoleSupabase } from "@/lib/server-supabase";

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

type BatchDefinitionInput = {
  file_name?: string;
  content?: string;
  payload?: Dict;
};

type BatchImportResultItem = {
  index: number;
  file_name: string;
  app_id: string;
  status: "validated" | "imported" | "failed";
  mode?: "create" | "update";
  action?: string;
  blueprint?: string;
  error?: string;
  version?: {
    id: string;
    version_no: number;
    release_channel: "draft" | "published";
  };
};

type RollbackPlanTarget = {
  app_id: string;
  mode: "create" | "update";
  rollback_version_id: string | null;
  rollback_release_channel: "draft" | "published" | null;
};

const APP_ID_REGEX = /^[a-z0-9][a-z0-9._-]*$/;

function asObject(value: unknown): Dict {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Dict;
}

function asTrimmedString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function asDefinitionArray(value: unknown): BatchDefinitionInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asObject(item))
    .map((item) => ({
      file_name: asTrimmedString(item.file_name),
      content: asTrimmedString(item.content),
      payload: asObject(item.payload),
    }));
}

function pickRollbackTargetRelease(
  row: { draft_version_id?: string | null; published_version_id?: string | null } | null,
): { versionId: string | null; releaseChannel: "draft" | "published" | null } {
  if (row?.draft_version_id) {
    return { versionId: row.draft_version_id, releaseChannel: "draft" };
  }
  if (row?.published_version_id) {
    return { versionId: row.published_version_id, releaseChannel: "published" };
  }
  return { versionId: null, releaseChannel: null };
}

function parseDefinitionInput(input: BatchDefinitionInput): Dict {
  if (Object.keys(input.payload || {}).length > 0) {
    return input.payload as Dict;
  }
  const content = asTrimmedString(input.content);
  if (!content) {
    throw new Error("Either payload object or content text is required");
  }
  const parsed = parseMiniAppDefinitionContent(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Definition content must resolve to a JSON/YAML object");
  }
  return parsed as Dict;
}

function normalizeFileName(input: BatchDefinitionInput, index: number): string {
  const fileName = asTrimmedString(input.file_name);
  if (fileName) return fileName;
  return `definition-${index + 1}`;
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

  const body = asObject(req.body);
  const dryRun = parseBoolean(body.dry_run);
  const stopOnError = parseBoolean(body.stop_on_error);
  const definitions = asDefinitionArray(body.definitions);

  if (!definitions.length) {
    return apiError.badRequest(res, "definitions is required and must be a non-empty array");
  }
  if (definitions.length > 200) {
    return apiError.badRequest(res, "definitions allows at most 200 items per batch");
  }

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(res, "Supabase service role client unavailable");
  }

  const actor = admin.kind === "wallet" ? admin.value : "api_key";
  const results: BatchImportResultItem[] = [];
  const rollbackTargets: RollbackPlanTarget[] = [];

  for (let index = 0; index < definitions.length; index += 1) {
    const definitionInput = definitions[index];
    const fileName = normalizeFileName(definitionInput, index);
    let parsedPayload: Dict = {};
    let appId = "";

    try {
      parsedPayload = parseDefinitionInput(definitionInput);
      appId = asTrimmedString(parsedPayload.app_id).toLowerCase();

      const schemaValidation = validateMiniAppDefinitionAgainstSchema(parsedPayload);
      if (!schemaValidation.valid) {
        throw new Error(schemaValidation.error || "Definition does not match miniapp schema");
      }

      let existing: ExistingRow | null = null;
      let existingRelease: { draft_version_id?: string | null; published_version_id?: string | null } | null = null;
      if (APP_ID_REGEX.test(appId)) {
        const [{ data: existingRow, error: existingError }, { data: releaseRow, error: releaseError }] = await Promise.all([
          supabase
            .from("miniapps")
            .select(
              "app_id,name,description,icon,category,entry_url,contract_hash,status,permissions,limits,logo_url,banner_url,docs_url,developer_user_id,developer_pubkey,assets_allowed,governance_assets_allowed,manifest",
            )
            .eq("app_id", appId)
            .maybeSingle(),
          supabase
            .from("miniapp_releases")
            .select("draft_version_id,published_version_id")
            .eq("app_id", appId)
            .maybeSingle(),
        ]);

        if (existingError) {
          throw new Error(`Failed to load existing app: ${existingError.message}`);
        }
        if (releaseError) {
          throw new Error(`Failed to load release pointers: ${releaseError.message}`);
        }
        existing = (existingRow as ExistingRow | null) || null;
        existingRelease = (releaseRow as { draft_version_id?: string | null; published_version_id?: string | null } | null) || null;
      }

      const normalized = normalizeMiniAppAdminPayload(parsedPayload, {
        existing,
        actor,
        defaultDeveloperUserId: process.env.MINIAPP_ADMIN_DEFAULT_DEVELOPER_USER_ID,
      });
      if (!normalized.ok) {
        throw new Error(normalized.error);
      }

      const mode: "create" | "update" = existing ? "update" : "create";

      if (dryRun) {
        results.push({
          index,
          file_name: fileName,
          app_id: normalized.row.app_id,
          status: "validated",
          mode,
          action: normalized.action,
          blueprint: normalized.blueprint,
        });
        continue;
      }

      const { error: upsertError } = await supabase.from("miniapps").upsert(normalized.row, { onConflict: "app_id" });
      if (upsertError) {
        throw new Error(`Failed to save miniapp: ${upsertError.message}`);
      }

      const version = await recordMiniAppVersion(supabase, {
        row: normalized.row,
        action: normalized.action,
        actor,
        note: "import_batch",
      });

      const rollbackSeed = pickRollbackTargetRelease(existingRelease);
      rollbackTargets.push({
        app_id: normalized.row.app_id,
        mode,
        rollback_version_id: rollbackSeed.versionId,
        rollback_release_channel: rollbackSeed.releaseChannel,
      });

      results.push({
        index,
        file_name: fileName,
        app_id: normalized.row.app_id,
        status: "imported",
        mode,
        action: normalized.action,
        blueprint: normalized.blueprint,
        version: {
          id: version.version.id,
          version_no: version.version.version_no,
          release_channel: version.version.release_channel,
        },
      });
    } catch (error) {
      logger.error(`import-batch: failed to import ${fileName}:`, error instanceof Error ? error.message : "unknown error");
      const message = error instanceof Error ? error.message : "Unknown error";
      results.push({
        index,
        file_name: fileName,
        app_id: appId,
        status: "failed",
        error: message,
      });
      if (stopOnError) {
        break;
      }
    }
  }

  const summary = results.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.status === "failed") acc.failed += 1;
      if (item.status === "validated") acc.validated += 1;
      if (item.status === "imported") acc.imported += 1;
      return acc;
    },
    { total: 0, failed: 0, validated: 0, imported: 0 },
  );

  const importBatchId = `batch_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  res.setHeader("Cache-Control", "no-store, private");
  return res.status(200).json({
    success: summary.failed === 0,
    dry_run: dryRun,
    stop_on_error: stopOnError,
    summary,
    results,
    rollback_plan: dryRun
      ? null
      : {
          import_batch_id: importBatchId,
          generated_at: new Date().toISOString(),
          targets: rollbackTargets,
        },
  });
}

export default withCsrfProtection(handler);
