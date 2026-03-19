import crypto from "crypto";
import type { MiniAppCategory, MiniAppDetailTemplate, MiniAppInfo, OperationEntry } from "@/components/types";
import { normalizeCategory, normalizePermissions, normalizeStatus } from "./miniapp";
import { canonicalizeMiniAppId } from "./miniapp-id";
import { normalizeMiniAppEntryUrl } from "./miniapp-entry-url";
import { coerceOperationEntries, resolveMiniAppDetailConfig } from "./miniapp-template";
import { stableStringify } from "../../shared/manifest";

type Dict = Record<string, unknown>;

const APP_ID_REGEX = /^[a-z0-9][a-z0-9._-]*$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTRACT_HASH_REGEX = /^0x[0-9a-fA-F]{40}$/;
const PUBKEY_REGEX = /^(?:0x)?[0-9a-fA-F]+$/;
const ADMIN_SCHEMA_VERSION = "2026-02-21";

const STAT_KEY_ALIASES: Record<string, string> = {
  tx_count: "total_transactions",
  gas_burned: "total_gas_used",
  gas_consumed: "total_gas_used",
};

const MANIFEST_ENTRY_PREFIX = "mf://manifest?app=";

const ALLOWED_STAT_KEYS = new Set([
  "total_transactions",
  "total_users",
  "total_gas_used",
  "total_gas_earned",
  "daily_active_users",
  "weekly_active_users",
  "last_activity_at",
]);

export type MiniAppBlueprint = "default" | "prediction" | "gaming" | "defi" | "nft";
export type MiniAppAdminAction = "save_draft" | "publish" | "disable";

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
      blueprint: MiniAppBlueprint;
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

type MiniAppBlueprintMetadata = {
  id: MiniAppBlueprint;
  label: string;
  description: string;
  layout: MiniAppDetailTemplate["layout"];
  tab_types: string[];
  starter: Record<string, unknown>;
};

type MiniAppBlueprintStarter = {
  action: MiniAppAdminAction;
  permissions: MiniAppInfo["permissions"];
  limits: {
    max_gas_per_tx: string;
    daily_gas_cap_per_user: string;
  };
  operations: OperationEntry[];
};

type MiniAppBlueprintDefinition = {
  id: MiniAppBlueprint;
  aliases: string[];
  label: string;
  description: string;
  template: MiniAppDetailTemplate;
  tabTypes: string[];
  starter: MiniAppBlueprintStarter;
};

function asObject(value: unknown): Dict {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Dict;
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

function asTrimmedString(value: unknown): string {
  return asString(value).trim();
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

function toIsoNow(): string {
  return new Date().toISOString();
}

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

function normalizeOptionalUrl(value: unknown): string | null {
  const raw = asTrimmedString(value);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeContractHash(value: unknown): string | null {
  const raw = asTrimmedString(value);
  if (!raw) return null;
  if (!CONTRACT_HASH_REGEX.test(raw)) return null;
  return raw.toLowerCase();
}

function normalizeDeveloperPubkey(value: unknown): string | null {
  const raw = asTrimmedString(value);
  if (!raw) return "";
  if (!PUBKEY_REGEX.test(raw)) return null;
  return raw.toLowerCase().replace(/^0x/, "");
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

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = value.map((item) => asTrimmedString(item)).filter(Boolean);
  return Array.from(new Set(out));
}

function normalizeAssetsAllowed(value: unknown, fallback: unknown, expected: string): string[] | null {
  const raw = normalizeStringArray(value);
  const fallbackRaw = normalizeStringArray(fallback);
  const candidate = raw.length > 0 ? raw : fallbackRaw.length > 0 ? fallbackRaw : [expected];
  const normalized = Array.from(new Set(candidate.map((item) => item.toUpperCase())));
  if (!normalized.length) return [expected];
  if (normalized.some((item) => item !== expected)) return null;
  return [expected];
}

function normalizeLimits(value: unknown, fallback?: MiniAppInfo["limits"] | null): MiniAppInfo["limits"] {
  const raw = asObject(value);
  const out: MiniAppInfo["limits"] = {};

  const maxGas = asTrimmedString(raw.max_gas_per_tx ?? fallback?.max_gas_per_tx);
  if (maxGas) out.max_gas_per_tx = maxGas;

  const dailyGas = asTrimmedString(raw.daily_gas_cap_per_user ?? fallback?.daily_gas_cap_per_user);
  if (dailyGas) out.daily_gas_cap_per_user = dailyGas;

  const governanceCap = asTrimmedString(raw.governance_cap ?? fallback?.governance_cap);
  if (governanceCap) out.governance_cap = governanceCap;

  return out;
}

function normalizeStatsDisplay(value: unknown, fallback?: unknown): string[] | null {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : Array.isArray(fallback)
        ? fallback
        : typeof fallback === "string"
          ? String(fallback).split(",")
          : [];

  const normalized = list
    .map((item) => asTrimmedString(item).toLowerCase())
    .filter(Boolean)
    .map((key) => STAT_KEY_ALIASES[key] ?? key)
    .filter((key) => ALLOWED_STAT_KEYS.has(key));

  if (!normalized.length) return null;
  return Array.from(new Set(normalized));
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const BLUEPRINT_DEFINITIONS: MiniAppBlueprintDefinition[] = [
  {
    id: "default",
    aliases: ["default", "general", "utility", "tools"],
    label: "Default",
    description: "General miniapp layout with overview/reviews/forum/news and operations panel.",
    template: {
      layout: "default",
      tabs: [
        { id: "overview", label: "Overview", type: "content" },
        { id: "reviews", label: "Reviews", type: "reviews" },
        { id: "forum", label: "Forum", type: "forum" },
        { id: "news", label: "News", type: "news" },
      ],
      operation_panel: {
        title: "Operations",
        subtitle: "Configure parameters and submit the transaction.",
        cta_label: "Launch App",
        operations: [],
      },
    },
    tabTypes: ["content", "reviews", "forum", "news"],
    starter: {
      action: "save_draft",
      permissions: {
        payments: true,
      },
      limits: {
        max_gas_per_tx: "10",
        daily_gas_cap_per_user: "100",
      },
      operations: [],
    },
  },
  {
    id: "prediction",
    aliases: ["prediction", "prediction_market", "market"],
    label: "Prediction",
    description: "Polymarket-style layout with market info/commentary on left and trade box on right.",
    template: {
      layout: "prediction",
      hero: {
        eyebrow: "Prediction Market",
        disclaimer: "Probabilities are market-implied and can change quickly.",
      },
      tabs: [
        { id: "market-info", label: "Market Info", type: "content" },
        { id: "reviews", label: "Reviews", type: "reviews" },
        { id: "forum", label: "Comments", type: "forum" },
        { id: "news", label: "Activity", type: "news" },
      ],
      operation_panel: {
        title: "Trade Position",
        subtitle: "Choose side, set amount, and submit on-chain.",
        cta_label: "Open Full Experience",
        operations: [],
      },
    },
    tabTypes: ["content", "reviews", "forum", "news"],
    starter: {
      action: "save_draft",
      permissions: {
        payments: true,
        datafeed: true,
      },
      limits: {
        max_gas_per_tx: "10",
        daily_gas_cap_per_user: "100",
      },
      operations: [
        {
          name: "Buy Position",
          method: "buyPosition",
          button_style: "primary",
          params: [
            {
              name: "side",
              type: "select",
              required: true,
              options: [
                { label: "YES", value: "yes" },
                { label: "NO", value: "no" },
              ],
            },
            { name: "amount", type: "amount", required: true, placeholder: "10" },
          ],
        },
      ],
    },
  },
  {
    id: "gaming",
    aliases: ["gaming", "game"],
    label: "Gaming",
    description: "Game-oriented layout with leaderboard and play operations.",
    template: {
      layout: "default",
      tabs: [
        { id: "overview", label: "Overview", type: "content" },
        { id: "leaderboard", label: "Leaderboard", type: "content" },
        { id: "reviews", label: "Reviews", type: "reviews" },
        { id: "news", label: "News", type: "news" },
      ],
      operation_panel: {
        title: "Play",
        subtitle: "Configure game parameters and start playing.",
        cta_label: "Launch Game",
        operations: [],
      },
    },
    tabTypes: ["content", "reviews", "news"],
    starter: {
      action: "save_draft",
      permissions: {
        payments: true,
      },
      limits: {
        max_gas_per_tx: "10",
        daily_gas_cap_per_user: "100",
      },
      operations: [
        {
          name: "Play Round",
          method: "play",
          button_style: "primary",
          params: [
            { name: "bet_amount", type: "amount", required: true, placeholder: "1" },
          ],
        },
      ],
    },
  },
  {
    id: "defi",
    aliases: ["defi", "finance"],
    label: "DeFi",
    description: "DeFi layout with pool info, positions, and deposit/withdraw operations.",
    template: {
      layout: "default",
      tabs: [
        { id: "pool-info", label: "Pool Info", type: "content" },
        { id: "positions", label: "Positions", type: "content" },
        { id: "reviews", label: "Reviews", type: "reviews" },
        { id: "news", label: "Activity", type: "news" },
      ],
      operation_panel: {
        title: "Manage Position",
        subtitle: "Deposit, withdraw, or claim rewards.",
        cta_label: "Open DeFi App",
        operations: [],
      },
    },
    tabTypes: ["content", "reviews", "news"],
    starter: {
      action: "save_draft",
      permissions: {
        payments: true,
      },
      limits: {
        max_gas_per_tx: "10",
        daily_gas_cap_per_user: "100",
      },
      operations: [
        {
          name: "Deposit",
          method: "deposit",
          button_style: "primary",
          params: [
            { name: "amount", type: "amount", required: true, placeholder: "10" },
          ],
        },
        {
          name: "Withdraw",
          method: "withdraw",
          button_style: "secondary",
          params: [
            { name: "amount", type: "amount", required: true, placeholder: "10" },
          ],
        },
      ],
    },
  },
  {
    id: "nft",
    aliases: ["nft", "collectible", "collectibles"],
    label: "NFT",
    description: "NFT collection layout with minting and transfer operations.",
    template: {
      layout: "default",
      tabs: [
        { id: "collection", label: "Collection", type: "content" },
        { id: "reviews", label: "Reviews", type: "reviews" },
        { id: "forum", label: "Forum", type: "forum" },
      ],
      operation_panel: {
        title: "NFT Actions",
        subtitle: "Mint or transfer NFTs.",
        cta_label: "Open Collection",
        operations: [],
      },
    },
    tabTypes: ["content", "reviews", "forum"],
    starter: {
      action: "save_draft",
      permissions: {
        payments: true,
      },
      limits: {
        max_gas_per_tx: "10",
        daily_gas_cap_per_user: "100",
      },
      operations: [
        {
          name: "Mint",
          method: "mint",
          button_style: "primary",
          params: [
            { name: "token_id", type: "string", required: true, placeholder: "Token ID" },
          ],
        },
      ],
    },
  },
];

const BLUEPRINT_DEFAULT_ID: MiniAppBlueprint = "default";

const BLUEPRINT_BY_ID = new Map<MiniAppBlueprint, MiniAppBlueprintDefinition>(
  BLUEPRINT_DEFINITIONS.map((definition) => [definition.id, definition]),
);

const BLUEPRINT_ALIAS_MAP = BLUEPRINT_DEFINITIONS.reduce<Record<string, MiniAppBlueprint>>((acc, definition) => {
  for (const alias of definition.aliases) {
    acc[alias] = definition.id;
  }
  acc[definition.id] = definition.id;
  return acc;
}, {});

function getBlueprintDefinition(blueprint: MiniAppBlueprint): MiniAppBlueprintDefinition {
  return BLUEPRINT_BY_ID.get(blueprint) || BLUEPRINT_BY_ID.get(BLUEPRINT_DEFAULT_ID)!;
}

function getBlueprintTemplate(blueprint: MiniAppBlueprint): MiniAppDetailTemplate {
  return deepClone(getBlueprintDefinition(blueprint).template);
}

function normalizeBlueprint(value: unknown): MiniAppBlueprint {
  const raw = asTrimmedString(value).toLowerCase().replace(/\s+/g, "_");
  return BLUEPRINT_ALIAS_MAP[raw] || BLUEPRINT_DEFAULT_ID;
}

function cleanForManifest(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => cleanForManifest(item)).filter((item) => item !== undefined);
  }

  const out: Dict = {};
  for (const [key, nestedValue] of Object.entries(value as Dict)) {
    const cleaned = cleanForManifest(nestedValue);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

export function computeManifestHashHex(manifest: Record<string, unknown>): string {
  return crypto.createHash("sha256").update(stableStringify(cleanForManifest(manifest))).digest("hex");
}

export function listMiniAppBlueprints(): MiniAppBlueprintMetadata[] {
  return BLUEPRINT_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    description: definition.description,
    layout: definition.template.layout,
    tab_types: [...definition.tabTypes],
    starter: {
      blueprint: definition.id,
      action: definition.starter.action,
      permissions: deepClone(definition.starter.permissions),
      limits: deepClone(definition.starter.limits),
      manifest: {
        page_template: deepClone(definition.template),
        operations: deepClone(definition.starter.operations),
      },
    },
  }));
}

function mergeContentFields(base: Dict, content: Dict): Dict {
  const next = { ...base };
  const mappings: Array<[string, string]> = [
    ["description", "description"],
    ["icon", "icon"],
    ["logo_url", "logo_url"],
    ["banner_url", "banner_url"],
    ["docs_url", "docs_url"],
    ["category", "category"],
  ];

  for (const [target, source] of mappings) {
    if (content[source] !== undefined) {
      next[target] = content[source];
    }
  }

  return next;
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Dict).length > 0;
  return true;
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
