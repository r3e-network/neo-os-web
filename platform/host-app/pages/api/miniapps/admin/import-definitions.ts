import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { normalizeMiniAppAdminPayload } from "@/lib/miniapp-admin";
import { recordMiniAppVersion } from "@/lib/miniapp-versioning";
import { loadMiniAppDefinitionPayloads } from "@/lib/miniapp-definitions";
import { validateMiniAppDefinitionAgainstSchema } from "@/lib/miniapp-schema-validator";
import { strictLimit } from "@/lib/rate-limit";
import { getServerSupabaseClient, hasServiceRoleSupabase } from "@/lib/server-supabase";
import schema from "@/public/miniapp-definitions/miniapp-config.schema.json";

const APP_ID_REGEX = /^[a-z0-9][a-z0-9._-]*$/;

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

type ImportItemResult = {
  file: string;
  app_id: string;
  status: "validated" | "imported" | "failed";
  mode?: "create" | "update";
  action?: string;
  blueprint?: string;
  error?: string;
};

type MiniAppConfigSchema = {
  required?: string[];
  properties?: Record<string, { type?: string; enum?: unknown[] }>;
};

const miniAppConfigSchema = schema as MiniAppConfigSchema;
const REQUIRED_TOP_LEVEL_FIELDS = Array.isArray(miniAppConfigSchema.required)
  ? miniAppConfigSchema.required.filter((field): field is string => typeof field === "string" && field.length > 0)
  : [];
const TEMPLATE_TYPE_ENUM = Array.isArray(miniAppConfigSchema.properties?.template_type?.enum)
  ? new Set(
      miniAppConfigSchema.properties?.template_type?.enum
        ?.filter((value): value is string => typeof value === "string")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    )
  : null;

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

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function validateDefinitionPayload(payload: unknown): string | null {
  const obj = asObject(payload);
  if (!Object.keys(obj).length) {
    return "Definition payload must be a JSON object";
  }

  for (const requiredField of REQUIRED_TOP_LEVEL_FIELDS) {
    const value = obj[requiredField];
    if (value === undefined || value === null || asTrimmedString(value).length === 0) {
      return `Missing required field: ${requiredField}`;
    }
  }

  if (TEMPLATE_TYPE_ENUM) {
    const rawTemplateType = asTrimmedString(obj.template_type).toLowerCase();
    if (!rawTemplateType) {
      return "Missing required field: template_type";
    }
    if (!TEMPLATE_TYPE_ENUM.has(rawTemplateType)) {
      return `Invalid template_type: ${rawTemplateType}`;
    }
  }

  const schemaValidation = validateMiniAppDefinitionAgainstSchema(payload);
  if (!schemaValidation.valid) {
    return schemaValidation.error || "Definition does not match miniapp schema";
  }

  return null;
}

function resolveDryRun(req: NextApiRequest, body: Record<string, unknown>): boolean {
  const rawQueryValue = Array.isArray(req.query.dry_run) ? req.query.dry_run[0] : req.query.dry_run;
  if (rawQueryValue !== undefined) return parseBoolean(rawQueryValue);
  return parseBoolean(body.dry_run);
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
  if (body !== undefined && (typeof body !== "object" || body === null || Array.isArray(body))) {
    return apiError.badRequest(res, "Invalid request body");
  }
  const bodyObj = (body as Record<string, unknown> | undefined) || {};
  const dryRun = resolveDryRun(req, bodyObj);

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(res, "Supabase service role client unavailable");
  }

  const loaded = await loadMiniAppDefinitionPayloads();
  const results: ImportItemResult[] = [];

  for (const parseError of loaded.errors) {
    results.push({
      file: parseError.fileName,
      app_id: "",
      status: "failed",
      error: parseError.error,
    });
  }

  for (const definition of loaded.definitions) {
    const rawAppId = asTrimmedString(definition.payload.app_id).toLowerCase();
    let existing: ExistingRow | null = null;

    const validationError = validateDefinitionPayload(definition.payload);
    if (validationError) {
      results.push({
        file: definition.fileName,
        app_id: rawAppId,
        status: "failed",
        error: validationError,
      });
      continue;
    }

    if (rawAppId && APP_ID_REGEX.test(rawAppId)) {
      const { data, error } = await supabase
        .from("miniapps")
        .select(
          "app_id,name,description,icon,category,entry_url,contract_hash,status,permissions,limits,logo_url,banner_url,docs_url,developer_user_id,developer_pubkey,assets_allowed,governance_assets_allowed,manifest",
        )
        .eq("app_id", rawAppId)
        .maybeSingle();

      if (error) {
        logger.error("miniapp import existing fetch error:", error.message);
        results.push({
          file: definition.fileName,
          app_id: rawAppId,
          status: "failed",
          error: `Failed to load existing app: ${error.message}`,
        });
        continue;
      }
      existing = (data as ExistingRow | null) || null;
    }

    const normalized = normalizeMiniAppAdminPayload(definition.payload, {
      existing,
      actor: admin.kind === "wallet" ? admin.value : "api_key",
      defaultDeveloperUserId: process.env.MINIAPP_ADMIN_DEFAULT_DEVELOPER_USER_ID,
    });

    const normalizedAppId = normalized.ok ? normalized.row.app_id : rawAppId;
    if (!normalized.ok) {
      results.push({
        file: definition.fileName,
        app_id: normalizedAppId,
        status: "failed",
        error: normalized.error,
      });
      continue;
    }

    if (dryRun) {
      results.push({
        file: definition.fileName,
        app_id: normalized.row.app_id,
        status: "validated",
        mode: existing ? "update" : "create",
        action: normalized.action,
        blueprint: normalized.blueprint,
      });
      continue;
    }

    const { error: upsertError } = await supabase.from("miniapps").upsert(normalized.row, { onConflict: "app_id" });
    if (upsertError) {
      logger.error("miniapp import upsert failed:", upsertError.message);
      results.push({
        file: definition.fileName,
        app_id: normalized.row.app_id,
        status: "failed",
        error: `Failed to save miniapp: ${upsertError.message}`,
      });
      continue;
    }

    try {
      await recordMiniAppVersion(supabase, {
        row: normalized.row,
        action: normalized.action,
        actor: admin.kind === "wallet" ? admin.value : "api_key",
      });
    } catch (versionError) {
      logger.error(
        "miniapp import version write failed:",
        versionError instanceof Error ? versionError.message : "unknown error",
      );
      results.push({
        file: definition.fileName,
        app_id: normalized.row.app_id,
        status: "failed",
        error: "Failed to write miniapp version snapshot",
      });
      continue;
    }

    results.push({
      file: definition.fileName,
      app_id: normalized.row.app_id,
      status: "imported",
      mode: existing ? "update" : "create",
      action: normalized.action,
      blueprint: normalized.blueprint,
    });
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

  res.setHeader("Cache-Control", "no-store, private");
  return res.status(200).json({
    success: summary.failed === 0,
    dry_run: dryRun,
    definitions_dir: loaded.definitionsDir,
    summary,
    results,
  });
}

export default withCsrfProtection(handler);
