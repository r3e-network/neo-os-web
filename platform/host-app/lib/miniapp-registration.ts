import crypto from "crypto";
import type { MiniAppCategory, MiniAppInfo } from "@/components/types";
import { normalizeCategory, normalizePermissions, normalizeStatus } from "./miniapp";
import { canonicalizeMiniAppId } from "./miniapp-id";
import { normalizeMiniAppEntryUrl } from "./miniapp-entry-url";
import { coerceOperationEntries, resolveMiniAppDetailConfig } from "./miniapp-template";
import { stableStringify } from "../../shared/manifest";
import type { MiniAppAdminAction } from "./miniapp-blueprints";
import { normalizeBlueprint, getBlueprintTemplate } from "./miniapp-blueprints";
import {
  type Dict,
  APP_ID_REGEX,
  UUID_REGEX,
  ADMIN_SCHEMA_VERSION,
  MANIFEST_ENTRY_PREFIX,
  asObject,
  asTrimmedString,
  asOptionalBoolean,
  toIsoNow,
  normalizeOptionalUrl,
  normalizeContractHash,
  normalizeDeveloperPubkey,
  normalizeAssetsAllowed,
  normalizeLimits,
  normalizeStatsDisplay,
  cleanForManifest,
  hasMeaningfulValue,
  mergeContentFields,
} from "./miniapp-permissions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExistingMiniAppRow = {
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

export type MiniAppUpsertRow = {
  app_id: string;
  name: string;
  description: string;
  icon: string;
  category: MiniAppCategory;
  entry_url: string;
  contract_hash: string | null;
  status: "active" | "pending" | "disabled";
  permissions: MiniAppInfo["permissions"];
  limits: MiniAppInfo["limits"];
  logo_url: string | null;
  banner_url: string | null;
  docs_url: string | null;
  developer_user_id: string;
  developer_pubkey: string;
  assets_allowed: string[];
  governance_assets_allowed: string[];
  manifest_hash: string;
  manifest: Record<string, unknown>;
};

export type NormalizeMiniAppAdminPayloadResult =
  | {
      ok: true;
      action: MiniAppAdminAction;
      blueprint: import("./miniapp-blueprints").MiniAppBlueprint;
      row: MiniAppUpsertRow;
    }
  | {
      ok: false;
      error: string;
    };

type NormalizeMiniAppAdminPayloadOptions = {
  existing?: ExistingMiniAppRow | null;
  actor?: string;
  defaultDeveloperUserId?: string;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalizeAppId(value: unknown): string | null {
  const appId = canonicalizeMiniAppId(value, { coerceMiniappPrefix: true });
  if (!appId || !APP_ID_REGEX.test(appId)) return null;
  return appId;
}

function normalizeEntryUrl(value: unknown): string | null {
  return normalizeMiniAppEntryUrl(value);
}

function buildManifestEntryUrl(appId: string): string {
  return `${MANIFEST_ENTRY_PREFIX}${encodeURIComponent(appId)}`;
}

function normalizeLifecycleAction(value: unknown): MiniAppAdminAction | null {
  const raw = asTrimmedString(value).toLowerCase();
  if (raw === "publish") return "publish";
  if (raw === "disable") return "disable";
  if (raw === "draft" || raw === "save_draft") return "save_draft";
  return null;
}

function resolveStatus(action: MiniAppAdminAction | null, statusValue: unknown, fallback: unknown): {
  status: "active" | "pending" | "disabled";
  action: MiniAppAdminAction;
} {
  if (action === "publish") return { status: "active", action };
  if (action === "disable") return { status: "disabled", action };
  if (action === "save_draft") return { status: "pending", action };

  const normalized = normalizeStatus(statusValue, normalizeStatus(fallback));
  if (normalized === "active") return { status: "active", action: "publish" };
  if (normalized === "disabled") return { status: "disabled", action: "disable" };
  return { status: "pending", action: "save_draft" };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function computeManifestHashHex(manifest: Record<string, unknown>): string {
  return crypto.createHash("sha256").update(stableStringify(cleanForManifest(manifest))).digest("hex");
}

export function normalizeMiniAppAdminPayload(
  raw: unknown,
  options: NormalizeMiniAppAdminPayloadOptions = {},
): NormalizeMiniAppAdminPayloadResult {
  const obj = asObject(raw);
  const existing = options.existing || null;
  const existingManifest = asObject(existing?.manifest);
  const incomingManifest = asObject(obj.manifest);
  const content = asObject(obj.content);
  const mergedInput = mergeContentFields({ ...existingManifest, ...incomingManifest, ...obj }, content);
  const contractInput = asObject(mergedInput.contract ?? incomingManifest.contract ?? existingManifest.contract);
  const mediaInput = asObject(mergedInput.media ?? incomingManifest.media ?? existingManifest.media);
  const integrationInput = asObject(mergedInput.integration ?? incomingManifest.integration ?? existingManifest.integration);

  const preparedInput: Dict = {
    ...mergedInput,
    contract: contractInput,
    media: mediaInput,
    integration: integrationInput,
    contract_hash: mergedInput.contract_hash ?? contractInput.contract_hash,
    template_id: mergedInput.template_id ?? contractInput.template_id,
    init_params: mergedInput.init_params ?? contractInput.init_params,
    icon: mergedInput.icon ?? mediaInput.icon,
    logo_url: mergedInput.logo_url ?? mediaInput.logo_url ?? mediaInput.logo,
    banner_url: mergedInput.banner_url ?? mediaInput.banner_url ?? mediaInput.banner,
    news_integration: mergedInput.news_integration ?? integrationInput.news_integration,
    stats_display: mergedInput.stats_display ?? integrationInput.stats_display,
    blueprint: mergedInput.blueprint ?? mergedInput.template ?? mergedInput.template_type,
  };

  const appId = normalizeAppId(preparedInput.app_id ?? existing?.app_id);
  if (!appId) {
    return { ok: false, error: "Invalid app_id format" };
  }

  const name = asTrimmedString(preparedInput.name ?? existing?.name ?? appId);
  if (!name) {
    return { ok: false, error: "name is required" };
  }

  const entryUrlCandidate =
    normalizeEntryUrl(preparedInput.entry_url ?? existing?.entry_url) ??
    normalizeEntryUrl(existingManifest.entry_url) ??
    buildManifestEntryUrl(appId);
  const entryUrl = entryUrlCandidate;

  const contractHashInput = preparedInput.contract_hash ?? existing?.contract_hash;
  const contractHash = normalizeContractHash(contractHashInput);
  if (asTrimmedString(contractHashInput) && !contractHash) {
    return { ok: false, error: "Invalid contract_hash format" };
  }

  const category = normalizeCategory(preparedInput.category ?? existing?.category);
  const icon = asTrimmedString(preparedInput.icon ?? existing?.icon ?? "🧩") || "🧩";
  const description = asTrimmedString(preparedInput.description ?? existing?.description ?? "");

  const logoUrlValue = preparedInput.logo_url ?? existing?.logo_url;
  const bannerUrlValue = preparedInput.banner_url ?? existing?.banner_url;
  const docsUrlValue = preparedInput.docs_url ?? existing?.docs_url;

  const logoUrl = normalizeOptionalUrl(logoUrlValue);
  if (asTrimmedString(logoUrlValue) && !logoUrl) {
    return { ok: false, error: "Invalid logo_url" };
  }
  const bannerUrl = normalizeOptionalUrl(bannerUrlValue);
  if (asTrimmedString(bannerUrlValue) && !bannerUrl) {
    return { ok: false, error: "Invalid banner_url" };
  }
  const docsUrl = normalizeOptionalUrl(docsUrlValue);
  if (asTrimmedString(docsUrlValue) && !docsUrl) {
    return { ok: false, error: "Invalid docs_url" };
  }

  const actionInput = normalizeLifecycleAction(preparedInput.action);
  const resolvedLifecycle = resolveStatus(actionInput, preparedInput.status, existing?.status);

  const assetsAllowed = normalizeAssetsAllowed(
    preparedInput.assets_allowed,
    existing?.assets_allowed ?? existingManifest.assets_allowed,
    "GAS",
  );
  if (!assetsAllowed) {
    return { ok: false, error: "assets_allowed must contain only GAS" };
  }

  const governanceAssetsAllowed = normalizeAssetsAllowed(
    preparedInput.governance_assets_allowed,
    existing?.governance_assets_allowed ?? existingManifest.governance_assets_allowed,
    "BNEO",
  );
  if (!governanceAssetsAllowed) {
    return { ok: false, error: "governance_assets_allowed must contain only BNEO" };
  }

  const fallbackPermissions = normalizePermissions(existing?.permissions ?? existingManifest.permissions);
  const permissions = normalizePermissions(preparedInput.permissions ?? existingManifest.permissions, fallbackPermissions);
  const limits = normalizeLimits(preparedInput.limits ?? existingManifest.limits, existing?.limits ?? null);

  const developerUserId = asTrimmedString(
    preparedInput.developer_user_id ?? existing?.developer_user_id ?? options.defaultDeveloperUserId,
  );
  if (!UUID_REGEX.test(developerUserId)) {
    return { ok: false, error: "developer_user_id is required and must be a UUID" };
  }

  const developerPubkey = normalizeDeveloperPubkey(preparedInput.developer_pubkey ?? existing?.developer_pubkey ?? "");
  if (developerPubkey === null) {
    return { ok: false, error: "Invalid developer_pubkey format" };
  }

  const blueprint = normalizeBlueprint(preparedInput.blueprint ?? preparedInput.template ?? existingManifest.blueprint);
  const blueprintTemplate = getBlueprintTemplate(blueprint);

  const detailConfig = resolveMiniAppDetailConfig(
    {
      manifest: {
        ...existingManifest,
        ...incomingManifest,
      },
      detail_template: preparedInput.detail_template ?? preparedInput.page_template ?? preparedInput.page_config,
      operations: preparedInput.operations,
      operation_schema: preparedInput.operation_schema,
      operation_panel: preparedInput.operation_panel,
      frontend_spec:
        preparedInput.frontend_spec ??
        preparedInput.ui_spec ??
        preparedInput.frontend_definition ??
        preparedInput.page_definition ??
        incomingManifest.frontend_spec ??
        existingManifest.frontend_spec,
    },
    {
      detailTemplate: blueprintTemplate,
      operations: coerceOperationEntries(existingManifest.operations),
      manifest: existingManifest,
    },
  );

  const detailTemplate = detailConfig.detailTemplate || blueprintTemplate;
  const operations = detailConfig.operations.length > 0
    ? detailConfig.operations
    : coerceOperationEntries(preparedInput.operations ?? preparedInput.operation_schema);

  const statsDisplay = normalizeStatsDisplay(
    preparedInput.stats_display,
    existingManifest.stats_display,
  );
  const newsIntegration = asOptionalBoolean(preparedInput.news_integration ?? existingManifest.news_integration);
  const frontendSpec =
    preparedInput.frontend_spec ??
    preparedInput.ui_spec ??
    preparedInput.frontend_definition ??
    preparedInput.page_definition ??
    incomingManifest.frontend_spec ??
    existingManifest.frontend_spec;

  const contractTemplateInput = asObject(mergedInput.contract_template ?? incomingManifest.contract_template ?? existingManifest.contract_template);
  const normalizedContractTemplate = hasMeaningfulValue(contractTemplateInput) ? contractTemplateInput : undefined;
  const contractCompositionInput = asObject(
    mergedInput.contract_composition ??
    incomingManifest.contract_composition ??
    existingManifest.contract_composition,
  );
  const normalizedContractComposition = hasMeaningfulValue(contractCompositionInput)
    ? contractCompositionInput
    : undefined;

  const templateId = asTrimmedString(preparedInput.template_id ?? contractInput.template_id);
  const initParams = preparedInput.init_params ?? contractInput.init_params;
  const normalizedContract = cleanForManifest({
    ...asObject(existingManifest.contract),
    ...asObject(incomingManifest.contract),
    template_id: templateId || undefined,
    init_params: hasMeaningfulValue(initParams) ? initParams : undefined,
    contract_hash: contractHash || undefined,
  });

  const manifest = cleanForManifest({
    ...existingManifest,
    ...incomingManifest,
    app_id: appId,
    name,
    description,
    icon,
    category,
    entry_url: entryUrl,
    contract_hash: contractHash || undefined,
    permissions,
    limits,
    assets_allowed: assetsAllowed,
    governance_assets_allowed: governanceAssetsAllowed,
    news_integration: newsIntegration,
    stats_display: statsDisplay || undefined,
    template_id: templateId || undefined,
    init_params: hasMeaningfulValue(initParams) ? initParams : undefined,
    contract: hasMeaningfulValue(normalizedContract) ? normalizedContract : undefined,
    contract_template: normalizedContractTemplate,
    contract_composition: normalizedContractComposition,
    frontend_spec: hasMeaningfulValue(frontendSpec) ? frontendSpec : undefined,
    detail_template: detailTemplate,
    page_template: detailTemplate,
    operations,
    logo_url: logoUrl || undefined,
    banner_url: bannerUrl || undefined,
    docs_url: docsUrl || undefined,
    admin: {
      blueprint,
      action: resolvedLifecycle.action,
      updated_at: toIsoNow(),
      actor: options.actor || undefined,
      schema_version: ADMIN_SCHEMA_VERSION,
    },
  }) as Record<string, unknown>;

  const manifestHash = computeManifestHashHex(manifest);

  const row: MiniAppUpsertRow = {
    app_id: appId,
    name,
    description,
    icon,
    category,
    entry_url: entryUrl,
    contract_hash: contractHash,
    status: resolvedLifecycle.status,
    permissions,
    limits,
    logo_url: logoUrl,
    banner_url: bannerUrl,
    docs_url: docsUrl,
    developer_user_id: developerUserId,
    developer_pubkey: developerPubkey,
    assets_allowed: assetsAllowed,
    governance_assets_allowed: governanceAssetsAllowed,
    manifest_hash: manifestHash,
    manifest,
  };

  return {
    ok: true,
    action: resolvedLifecycle.action,
    blueprint,
    row,
  };
}
