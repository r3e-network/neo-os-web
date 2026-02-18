/**
 * MiniApp Normalization Utilities
 * Validates and normalizes MiniApp data from various sources
 */

import type {
  MiniAppCategory,
  MiniAppInfo,
  MiniAppPermissions,
  MiniAppLimits,
  MiniAppChainContracts,
  ChainId,
} from "@/types/miniapp";
import type { MiniAppDisplayConfig, MiniAppRuntimeConfig } from "@neo/shared/types/miniapp-runtime";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toString(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

const CHAIN_ID_PATTERN = /^[a-z0-9]+-[a-z0-9]+(-[a-z0-9]+)*$/;

function isValidChainId(value: unknown): value is ChainId {
  if (typeof value !== "string") return false;
  return CHAIN_ID_PATTERN.test(value);
}

function normalizeSupportedChains(value: unknown): ChainId[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value.map((v) => toString(v).trim().toLowerCase()).filter(isValidChainId);
  return list.length > 0 ? Array.from(new Set(list)) : undefined;
}

function normalizeChainContracts(value: unknown): MiniAppChainContracts | undefined {
  const obj = asObject(value);
  if (Object.keys(obj).length === 0) return undefined;
  const out: MiniAppChainContracts = {};
  for (const [chainId, raw] of Object.entries(obj)) {
    if (!isValidChainId(chainId)) continue;
    const cfg = asObject(raw);
    const address = toString(cfg.address ?? "").trim();
    out[chainId] = {
      address: address || null,
      active: cfg.active !== false,
      entryUrl: toString(cfg.entryUrl ?? cfg.entry_url ?? "").trim() || undefined,
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function normalizeCategory(value: unknown): MiniAppCategory {
  const raw = toString(value).trim().toLowerCase();
  if (
    raw === "gaming" ||
    raw === "games" ||
    raw === "game" ||
    raw === "defi" ||
    raw === "governance" ||
    raw === "utility" ||
    raw === "social" ||
    raw === "nft"
  ) {
    return raw === "games" || raw === "game" ? "gaming" : raw;
  }
  return "utility";
}

export function normalizePermissions(
  value: unknown,
  fallback?: MiniAppPermissions
): MiniAppPermissions {
  if (Array.isArray(value)) {
    const set = new Set(value.map((entry) => String(entry).toLowerCase()));
    return {
      payments: set.has("payments"),
      governance: set.has("governance"),
      rng: set.has("rng"),
      datafeed: set.has("datafeed"),
      confidential: set.has("confidential") || set.has("wallet"),
      automation: set.has("automation"),
    };
  }
  const raw = asObject(value);
  const has = (key: string) => Object.prototype.hasOwnProperty.call(raw, key);

  const payments = has("payments") ? raw.payments : fallback?.payments;
  const governance = has("governance") ? raw.governance : fallback?.governance;
  const rng = has("rng") ? raw.rng : fallback?.rng;
  const datafeed = has("datafeed") ? raw.datafeed : fallback?.datafeed;
  const confidential = has("confidential") ? raw.confidential : fallback?.confidential;
  const automation = has("automation") ? raw.automation : fallback?.automation;

  return {
    payments: Boolean(payments),
    governance: Boolean(governance),
    rng: Boolean(rng),
    datafeed: Boolean(datafeed),
    confidential: Boolean(confidential),
    automation: Boolean(automation),
  };
}

export function normalizeLimits(
  value: unknown,
  fallback?: MiniAppLimits | null
): MiniAppLimits | null {
  const raw = asObject(value);
  const out: MiniAppLimits = {};

  if (raw.max_gas_per_tx !== undefined) {
    out.max_gas_per_tx = toString(raw.max_gas_per_tx);
  }
  if (raw.daily_gas_cap_per_user !== undefined) {
    out.daily_gas_cap_per_user = toString(raw.daily_gas_cap_per_user);
  }
  if (raw.governance_cap !== undefined) {
    out.governance_cap = toString(raw.governance_cap);
  }

  if (Object.keys(out).length === 0) {
    return fallback && Object.keys(fallback).length > 0 ? fallback : null;
  }
  return out;
}

export function normalizeStatus(
  value: unknown,
  fallback?: MiniAppInfo["status"]
): MiniAppInfo["status"] {
  const raw = toString(value).trim().toLowerCase();
  if (raw === "active" || raw === "disabled" || raw === "pending") {
    return raw;
  }
  return fallback ?? null;
}

function normalizeDisplayConfig(
  value: unknown,
  fallback?: MiniAppDisplayConfig | null
): MiniAppDisplayConfig | undefined {
  const raw = asObject(value);
  const normalized: MiniAppDisplayConfig = {
    name: toString(raw.name ?? fallback?.name ?? "").trim() || undefined,
    description: toString(raw.description ?? fallback?.description ?? "").trim() || undefined,
    icon: toString(raw.icon ?? fallback?.icon ?? "").trim() || undefined,
    banner: toString(raw.banner ?? fallback?.banner ?? "").trim() || undefined,
  };

  return Object.values(normalized).some(Boolean) ? normalized : undefined;
}

function normalizeRuntimeConfig(
  value: unknown,
  fallback?: MiniAppRuntimeConfig | null
): MiniAppRuntimeConfig | undefined {
  const raw = asObject(value);
  const docsRaw = asObject(raw.docs ?? fallback?.docs);
  const operationRaw = asObject(raw.operation ?? fallback?.operation);
  const buttonsRaw = Array.isArray(raw.buttons) ? raw.buttons : Array.isArray(fallback?.buttons) ? fallback?.buttons : [];

  const docs = docsRaw.title
    ? {
        title: toString(docsRaw.title).trim(),
        subtitle: toString(docsRaw.subtitle ?? "").trim() || undefined,
        steps: Array.isArray(docsRaw.steps)
          ? docsRaw.steps.map((step) => toString(step).trim()).filter(Boolean)
          : undefined,
        features: Array.isArray(docsRaw.features)
          ? docsRaw.features
              .map((feature) => {
                const item = asObject(feature);
                const name = toString(item.name ?? "").trim();
                const description = toString(item.description ?? item.desc ?? "").trim();
                return name ? { name, description } : null;
              })
              .filter((item): item is { name: string; description: string } => Boolean(item))
          : undefined,
      }
    : undefined;

  const isValidFieldType = (fieldType: string): fieldType is "amount" | "address" | "select" | "toggle" | "number" | "text" =>
    ["amount", "address", "select", "toggle", "number", "text"].includes(fieldType);
  const isValidArgType = (argType: string): argType is "String" | "Integer" | "Boolean" | "Hash160" | "Any" =>
    ["String", "Integer", "Boolean", "Hash160", "Any"].includes(argType);
  const isValidSummaryFormat = (
    format: string
  ): format is "number" | "currency" | "percent" | "duration" => ["number", "currency", "percent", "duration"].includes(format);
  const isValidButtonActionType = (actionType: string): actionType is "invoke" | "link" | "copy" =>
    ["invoke", "link", "copy"].includes(actionType);
  const isValidButtonVariant = (variant: string): variant is "primary" | "secondary" | "danger" =>
    ["primary", "secondary", "danger"].includes(variant);

  const operation = operationRaw.title
    ? {
        title: toString(operationRaw.title).trim(),
        description: toString(operationRaw.description ?? "").trim() || undefined,
        actionLabel: toString(operationRaw.actionLabel ?? "").trim() || undefined,
        actionMethod: toString(operationRaw.actionMethod ?? "").trim() || undefined,
        fields: Array.isArray(operationRaw.fields)
          ? operationRaw.fields
              .map((field) => {
                const item = asObject(field);
                const key = toString(item.key).trim();
                const label = toString(item.label).trim();
                if (!key || !label) return null;
                const parsedFieldType = toString(item.type || "text");
                const fieldType = isValidFieldType(parsedFieldType) ? parsedFieldType : "text";
                const parsedArgType = toString(item.argType ?? "").trim();
                const validationRaw = asObject(item.validation);
                const validation = {
                  ...(typeof validationRaw.min === "number" ? { min: validationRaw.min } : {}),
                  ...(typeof validationRaw.max === "number" ? { max: validationRaw.max } : {}),
                  ...(typeof validationRaw.pattern === "string" && validationRaw.pattern
                    ? { pattern: validationRaw.pattern }
                    : {}),
                };
                return {
                  key,
                  type: fieldType,
                  label,
                  placeholder: toString(item.placeholder ?? "").trim() || undefined,
                  required: item.required === true,
                  default: item.default as string | number | boolean | undefined,
                  validation: Object.keys(validation).length > 0 ? validation : undefined,
                  argType: isValidArgType(parsedArgType) ? parsedArgType : undefined,
                  options: Array.isArray(item.options)
                    ? item.options
                        .map((option) => {
                          const value = asObject(option);
                          const optionValue = toString(value.value).trim();
                          const optionLabel = toString(value.label).trim();
                          if (!optionValue || !optionLabel) return null;
                          return { value: optionValue, label: optionLabel };
                        })
                        .filter((option): option is { value: string; label: string } => Boolean(option))
                    : undefined,
                };
              })
              .filter((field): field is NonNullable<typeof field> => Boolean(field))
          : [],
        summary: Array.isArray(operationRaw.summary)
          ? operationRaw.summary
              .map((summary) => {
                const item = asObject(summary);
                const label = toString(item.label).trim();
                const valueKey = toString(item.valueKey).trim();
                if (!label || !valueKey) return null;
                const parsedFormat = toString(item.format ?? "").trim();
                return {
                  label,
                  valueKey,
                  format: isValidSummaryFormat(parsedFormat) ? parsedFormat : undefined,
                };
              })
              .filter((summary): summary is NonNullable<typeof summary> => Boolean(summary))
          : undefined,
      }
    : undefined;

  const buttons = buttonsRaw
    .map((button) => {
      const item = asObject(button);
      const id = toString(item.id).trim();
      const label = toString(item.label).trim();
      const action = asObject(item.action);
      const type = toString(action.type).trim();
      if (!id || !label || !isValidButtonActionType(type)) return null;
      const variant = toString(item.variant ?? "").trim();
      return {
        id,
        label,
        variant: isValidButtonVariant(variant) ? variant : undefined,
        action: {
          type,
          method: toString(action.method ?? "").trim() || undefined,
          href: toString(action.href ?? "").trim() || undefined,
          copyText: toString(action.copyText ?? "").trim() || undefined,
          openInNewTab: action.openInNewTab === true,
          args: Array.isArray(action.args) ? action.args : undefined,
        },
      };
    })
    .filter((button): button is NonNullable<typeof button> => Boolean(button));

  const runtime: MiniAppRuntimeConfig = {
    ...(docs ? { docs } : {}),
    ...(operation ? { operation } : {}),
    ...(buttons.length > 0 ? { buttons } : {}),
  };

  return Object.keys(runtime).length > 0 ? runtime : undefined;
}

/**
 * Coerce raw data into a valid MiniAppInfo object
 * Returns null if required fields are missing
 */
export function coerceMiniAppInfo(raw: unknown, fallback?: MiniAppInfo): MiniAppInfo | null {
  const obj = asObject(raw);
  const appId = toString(obj.app_id ?? obj.appid ?? fallback?.app_id).trim();
  if (!appId) return null;

  const entryUrl = toString(obj.entry_url ?? fallback?.entry_url).trim();
  if (!entryUrl) return null;

  const name = toString(obj.name ?? fallback?.name ?? appId).trim() || appId;
  const description = toString(obj.description ?? fallback?.description ?? "").trim();
  const icon = toString(obj.icon ?? fallback?.icon ?? "🧩").trim() || "🧩";
  const banner =
    toString(obj.banner ?? obj.banner_url ?? fallback?.banner ?? "").trim() || undefined;
  const category = normalizeCategory(obj.category ?? fallback?.category);
  const supportedChains =
    normalizeSupportedChains(
      obj.supportedChains ?? obj.supported_chains ?? fallback?.supportedChains
    ) ?? [];
  const chainContracts = normalizeChainContracts(
    obj.chainContracts ?? obj.contracts ?? fallback?.chainContracts
  );
  const permissions = normalizePermissions(
    obj.permissions ?? fallback?.permissions,
    fallback?.permissions
  );
  const limits = normalizeLimits(obj.limits ?? fallback?.limits, fallback?.limits);
  const status = normalizeStatus(obj.status, fallback?.status);
  const metadata = asObject(obj.metadata ?? {});
  const uiConfig = normalizeRuntimeConfig(obj.ui_config ?? metadata.ui_config, fallback?.ui_config);
  const display = normalizeDisplayConfig(
    obj.display ?? metadata.display,
    {
      name,
      description,
      icon,
      banner: toString(obj.banner ?? obj.banner_url ?? fallback?.banner ?? "").trim() || undefined,
    }
  );
  const resolvedBanner = banner || display?.banner;

  // Self-contained i18n fields
  const nameZh = toString(obj.name_zh ?? fallback?.name_zh ?? "").trim() || undefined;
  const descriptionZh =
    toString(obj.description_zh ?? fallback?.description_zh ?? "").trim() || undefined;

  return {
    app_id: appId,
    name,
    name_zh: nameZh,
    description,
    description_zh: descriptionZh,
    icon,
    banner: resolvedBanner,
    category,
    entry_url: entryUrl,
    supportedChains,
    chainContracts,
    status: status ?? null,
    permissions,
    limits,
    ui_config: uiConfig ?? null,
    display: display ?? null,
  };
}

/**
 * Build MiniApp entry URL with query parameters
 */
export function buildMiniAppEntryUrl(entryUrl: string, params: Record<string, string>): string {
  const raw = toString(entryUrl).trim();
  if (!raw) return raw;

  const [base, hash] = raw.split("#");
  const [path, query] = base.split("?");
  const searchParams = new URLSearchParams(query ?? "");

  Object.entries(params).forEach(([key, value]) => {
    if (!key) return;
    searchParams.set(key, String(value));
  });

  const queryString = searchParams.toString();
  const assembled = queryString ? `${path}?${queryString}` : path;
  return hash ? `${assembled}#${hash}` : assembled;
}

// ============================================================================
// Multi-chain helpers
// ============================================================================

export function getContractForChain(app: MiniAppInfo, chainId: ChainId | null): string | null {
  if (!chainId) return null;
  const contract = app.chainContracts?.[chainId];
  if (contract && contract.active !== false && contract.address) {
    return contract.address;
  }
  return null;
}

export function isChainSupported(app: MiniAppInfo, chainId: ChainId): boolean {
  if (app.supportedChains?.includes(chainId)) return true;
  const contract = app.chainContracts?.[chainId];
  if (contract && contract.active !== false) return true;
  return false;
}

export function getAllSupportedChains(app: MiniAppInfo): ChainId[] {
  const out = new Set<ChainId>();
  if (app.supportedChains) {
    app.supportedChains.forEach((c) => out.add(c));
  }
  if (app.chainContracts) {
    Object.entries(app.chainContracts).forEach(([chainId, contract]) => {
      if (contract?.active === false) return;
      out.add(chainId as ChainId);
    });
  }
  return Array.from(out);
}

export function resolveChainIdForApp(app: MiniAppInfo, requested?: ChainId | null): ChainId | null {
  const supported = getAllSupportedChains(app);
  if (requested && supported.includes(requested)) return requested;
  return supported[0] ?? null;
}

export function getEntryUrlForChain(app: MiniAppInfo, chainId?: ChainId | null): string {
  if (chainId) {
    const contract = app.chainContracts?.[chainId];
    if (contract && contract.active !== false && contract.entryUrl) {
      return contract.entryUrl;
    }
  }
  return app.entry_url;
}
