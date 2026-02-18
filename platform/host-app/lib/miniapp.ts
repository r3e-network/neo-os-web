import type { MiniAppCategory, MiniAppInfo, MiniAppChainContracts } from "../components/types";
import type { ChainId } from "./chains/types";
import { getChainRegistry } from "./chains/registry";
import type { MiniAppDisplayConfig, MiniAppRuntimeConfig } from "@neo/shared/types/miniapp-runtime";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toString(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function isSafeEntryUrl(entryUrl: string): boolean {
  if (!entryUrl) return false;
  if (entryUrl.startsWith("mf://")) return true;
  if (entryUrl.startsWith("/") || entryUrl.startsWith("./")) return true;
  if (entryUrl.startsWith("//")) return false;
  try {
    const url = new URL(entryUrl);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeCategory(value: unknown): MiniAppCategory {
  const raw = toString(value).trim().toLowerCase();
  if (
    raw === "gaming" ||
    raw === "defi" ||
    raw === "governance" ||
    raw === "utility" ||
    raw === "social" ||
    raw === "nft"
  ) {
    return raw;
  }
  return "utility";
}

const PERMISSION_KEYS = ["payments", "governance", "rng", "datafeed", "confidential", "automation"] as const;

export function normalizePermissions(
  value: unknown,
  fallback?: MiniAppInfo["permissions"],
): MiniAppInfo["permissions"] {
  const raw = asObject(value);
  
  return PERMISSION_KEYS.reduce((acc, key) => {
    const val = Object.prototype.hasOwnProperty.call(raw, key) ? raw[key] : fallback?.[key];
    acc[key] = Boolean(val);
    return acc;
  }, {} as MiniAppInfo["permissions"]);
}

const LIMIT_KEYS = ["max_gas_per_tx", "daily_gas_cap_per_user", "governance_cap"] as const;

export function normalizeLimits(value: unknown, fallback?: MiniAppInfo["limits"]): MiniAppInfo["limits"] | undefined {
  const raw = asObject(value);
  const out: MiniAppInfo["limits"] = {};
  
  for (const key of LIMIT_KEYS) {
    if (raw[key] !== undefined) out[key] = toString(raw[key]);
  }

  return Object.keys(out).length > 0 ? out : 
    fallback && Object.keys(fallback).length > 0 ? fallback : undefined;
}

export function normalizeStatsDisplay(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value.map((v) => toString(v).trim()).filter(Boolean);
  return list;
}

export function normalizeStatus(value: unknown, fallback?: MiniAppInfo["status"]): MiniAppInfo["status"] | undefined {
  const raw = toString(value).trim().toLowerCase();
  if (raw === "active" || raw === "disabled" || raw === "pending") return raw as MiniAppInfo["status"];
  return fallback;
}

export function normalizeDisplayConfig(
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

export function normalizeRuntimeConfig(
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

// ============================================================================
// Multi-Chain Normalization
// ============================================================================

/** Valid chain ID pattern */
const CHAIN_ID_PATTERN = /^[a-z0-9]+-[a-z0-9]+(-[a-z0-9]+)?$/;

function isValidChainId(value: unknown): value is ChainId {
  if (typeof value !== "string") return false;
  if (!CHAIN_ID_PATTERN.test(value)) return false;
  return Boolean(getChainRegistry().getChain(value as ChainId));
}

/**
 * Normalize supportedChains array from raw data
 */
export function normalizeSupportedChains(value: unknown): ChainId[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const chains = value.map((v) => toString(v).trim().toLowerCase()).filter(isValidChainId);
  return chains.length > 0 ? chains : undefined;
}

/**
 * Normalize chainContracts mapping from raw data
 * Supports both "contracts" (manifest format) and "chainContracts" (host format)
 */
export function normalizeChainContracts(value: unknown): MiniAppChainContracts | undefined {
  const obj = asObject(value);
  if (Object.keys(obj).length === 0) return undefined;

  const result: Partial<MiniAppChainContracts> = {};
  for (const [chainId, config] of Object.entries(obj)) {
    if (!isValidChainId(chainId)) continue;
    const configObj = asObject(config);
    const address = toString(configObj.address ?? "").trim() || null;
    result[chainId] = {
      address,
      active: configObj.active !== false,
      entryUrl: toString(configObj.entryUrl ?? configObj.entry_url ?? "").trim() || undefined,
    };
  }
  return Object.keys(result).length > 0 ? (result as MiniAppChainContracts) : undefined;
}

/**
 * Get contract address for a specific chain
 * Apps must use chainContracts for multi-chain support
 * Returns null if chainId is null or no contract configured for the chain
 */
export function getContractForChain(app: MiniAppInfo, chainId: ChainId | null): string | null {
  if (!chainId) return null;
  const contract = app.chainContracts?.[chainId];
  if (contract && contract.active !== false && contract.address) {
    return contract.address;
  }
  return null;
}

/**
 * Check if app supports a specific chain
 * Apps must explicitly declare supported chains via supportedChains or chainContracts
 */
export function isChainSupported(app: MiniAppInfo, chainId: ChainId): boolean {
  if (app.supportedChains?.includes(chainId)) return true;
  const contract = app.chainContracts?.[chainId];
  if (contract && contract.active !== false) return true;
  return false;
}

/**
 * Get all supported chains for an app
 * Returns chains from supportedChains array and chainContracts keys
 */
export function getAllSupportedChains(app: MiniAppInfo): ChainId[] {
  const chains = new Set<ChainId>();

  // Add from supportedChains array
  if (app.supportedChains) {
    app.supportedChains.forEach((c) => chains.add(c));
  }

  // Add from chainContracts keys
  if (app.chainContracts) {
    Object.entries(app.chainContracts).forEach(([chainId, contract]) => {
      if (contract?.active === false) return;
      chains.add(chainId as ChainId);
    });
  }

  return Array.from(chains);
}

/**
 * Resolve the effective chain ID for a MiniApp.
 * Falls back to the first supported chain if the requested chain is not supported.
 */
export function resolveChainIdForApp(app: MiniAppInfo, requested?: ChainId | null): ChainId | null {
  const supported = getAllSupportedChains(app);
  if (requested && supported.includes(requested)) return requested;
  return supported[0] ?? null;
}

/**
 * Get chain-specific entry URL if provided in chainContracts; fall back to app entry_url.
 */
export function getEntryUrlForChain(app: MiniAppInfo, chainId?: ChainId | null): string {
  if (chainId) {
    const contract = app.chainContracts?.[chainId];
    if (contract && contract.active !== false && contract.entryUrl) {
      return contract.entryUrl;
    }
  }
  return app.entry_url;
}

export function coerceMiniAppInfo(raw: unknown, fallback?: MiniAppInfo): MiniAppInfo | null {
  const obj = asObject(raw);
  const appId = toString(obj.app_id ?? obj.appid ?? fallback?.app_id).trim();
  if (!appId) return null;

  const entryUrl = toString(obj.entry_url ?? fallback?.entry_url).trim();
  if (!entryUrl || !isSafeEntryUrl(entryUrl)) return null;

  const name = toString(obj.name ?? fallback?.name ?? appId).trim() || appId;
  const description = toString(obj.description ?? fallback?.description ?? "").trim();
  const icon = toString(obj.icon ?? fallback?.icon ?? "🧩").trim() || "🧩";
  const category = normalizeCategory(obj.category ?? fallback?.category);
  const permissions = normalizePermissions(obj.permissions ?? fallback?.permissions, fallback?.permissions);
  const limits = normalizeLimits(obj.limits ?? fallback?.limits, fallback?.limits);

  // Multi-chain support: normalize supportedChains and chainContracts
  const supportedChains =
    normalizeSupportedChains(obj.supportedChains ?? obj.supported_chains ?? fallback?.supportedChains) ?? [];
  // Support both "contracts" (manifest format) and "chainContracts" (host format)
  const chainContracts = normalizeChainContracts(obj.chainContracts ?? obj.contracts ?? fallback?.chainContracts);

  const newsIntegration =
    typeof obj.news_integration === "boolean" ? (obj.news_integration as boolean) : fallback?.news_integration;
  const statsDisplay = normalizeStatsDisplay(obj.stats_display) ?? fallback?.stats_display;
  const status = normalizeStatus(obj.status, fallback?.status);
  const metadata = asObject(obj.metadata ?? {});
  const runtimeConfig = normalizeRuntimeConfig(obj.ui_config ?? metadata.ui_config, fallback?.ui_config);
  const display = normalizeDisplayConfig(
    obj.display ?? metadata.display,
    fallback?.display ?? {
      name,
      description,
      icon,
      banner: toString(obj.banner ?? fallback?.banner ?? "").trim() || undefined,
    }
  );

  // Self-contained i18n fields
  const nameZh = toString(obj.name_zh ?? fallback?.name_zh ?? "").trim() || undefined;
  const descriptionZh = toString(obj.description_zh ?? fallback?.description_zh ?? "").trim() || undefined;
  const banner = toString(obj.banner ?? display?.banner ?? fallback?.banner ?? "").trim() || undefined;

  return {
    app_id: appId,
    name,
    name_zh: nameZh,
    description,
    description_zh: descriptionZh,
    icon,
    banner,
    category,
    entry_url: entryUrl,
    // Multi-chain fields - supportedChains is required
    supportedChains,
    chainContracts,
    status: status ?? null,
    permissions,
    limits: limits ?? null,
    news_integration: newsIntegration ?? null,
    stats_display: statsDisplay ?? null,
    ui_config: runtimeConfig ?? null,
    display: display ?? null,
  };
}

export type FederatedEntry = {
  remote: string;
  appId: string;
  view?: string;
};

export function parseFederatedEntryUrl(entryUrl: string, fallbackAppId: string): FederatedEntry | null {
  const raw = toString(entryUrl).trim();
  if (!raw.startsWith("mf://")) return null;

  const normalized = raw.replace(/^mf:\/\//, "https://");
  try {
    const url = new URL(normalized);
    const remote = url.host.trim();
    if (!remote) return null;
    const appId = url.searchParams.get("app")?.trim() || fallbackAppId;
    const view = url.searchParams.get("view")?.trim() || undefined;
    return { remote, appId, view };
  } catch {
    if (!fallbackAppId) return null;
    return { remote: "builtin", appId: fallbackAppId };
  }
}

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
