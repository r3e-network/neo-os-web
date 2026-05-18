import type {
  MiniAppContentBlock,
  MiniAppDetailTab,
  MiniAppDetailTabType,
  MiniAppInfo,
  MiniAppNotification,
} from "../components";
import type {
  MiniAppLaunchContext,
  OperationEntry,
  OperationParam,
} from "../components/types";
import { addressToScriptHash, type SharedModeRuntimeInfo } from "./chain";
import type { CatalogNetwork } from "./miniapp-catalog";

// Sanitize object for JSON serialization (convert undefined to null)
export function sanitizeForJson<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as T;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForJson) as T;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = value === undefined ? null : sanitizeForJson(value);
  }
  return result as T;
}

export type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

export type ResolvedTab = {
  id: string;
  label: string;
  type: MiniAppDetailTabType;
  blocks: MiniAppContentBlock[];
};

export type MiniAppNavItem = Pick<
  MiniAppInfo,
  "app_id" | "name" | "category" | "entry_url" | "logo_url"
>;

export type AppDetailPageProps = {
  app: MiniAppInfo | null;
  miniAppNav: MiniAppNavItem[];
  notifications: MiniAppNotification[];
  sharedRuntime?: SharedModeRuntimeInfo | null;
  error?: string;
};

const MINIAPP_DETAIL_ROUTE_ALIASES: Record<string, string> = {
  "miniapp-factory": "miniapp-miniapp-factory",
  "miniapp-onegate-vault": "miniapp-gas-lucky-pool",
  "onegate-vault": "miniapp-gas-lucky-pool",
};

export const ONEGATE_VAULT_APP_ID = "miniapp-gas-lucky-pool";
export const ONEGATE_VAULT_DAPP_ID = "23";
const ONEGATE_STANDALONE_REDIRECTS: Record<string, string> = {
  [ONEGATE_VAULT_APP_ID]: "/miniapps/gas-lucky-pool/index.html",
};

export const TAB_PANEL_CLASSNAME =
  "min-h-[38rem] [overflow-anchor:none] [contain:layout]";

export function buildDetailTabs(
  templateTabs: MiniAppDetailTab[],
  showNews: boolean,
  showSecrets: boolean,
): ResolvedTab[] {
  const mappedTemplateTabs = templateTabs
    .map((tab) => ({
      id:
        String(tab.id || "")
          .trim()
          .toLowerCase() || slugifyTabLabel(tab.label || ""),
      label: String(tab.label || "").trim() || "Overview",
      type: tab.type,
      blocks: Array.isArray(tab.blocks) ? tab.blocks : [],
    }))
    .filter((tab) => Boolean(tab.id) && tab.type)
    .filter((tab) => (tab.type === "news" ? showNews : true))
    .filter((tab) => (tab.type === "secrets" ? showSecrets : true));

  if (mappedTemplateTabs.length > 0) {
    return dedupeTabs(mappedTemplateTabs);
  }

  const defaults: ResolvedTab[] = [
    { id: "overview", label: "Overview", type: "content", blocks: [] },
    { id: "reviews", label: "Reviews", type: "reviews", blocks: [] },
    { id: "forum", label: "Forum", type: "forum", blocks: [] },
  ];

  if (showNews) {
    defaults.push({ id: "news", label: "News", type: "news", blocks: [] });
  }
  if (showSecrets) {
    defaults.push({
      id: "secrets",
      label: "Secrets",
      type: "secrets",
      blocks: [],
    });
  }

  return defaults;
}

function dedupeTabs(tabs: ResolvedTab[]): ResolvedTab[] {
  const seen = new Set<string>();
  const deduped: ResolvedTab[] = [];

  for (const tab of tabs) {
    if (seen.has(tab.id)) continue;
    seen.add(tab.id);
    deduped.push(tab);
  }

  return deduped;
}

function slugifyTabLabel(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "overview";
}

function formatPermission(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function buildInvokeArgs(
  params: OperationParam[],
  values: Record<string, string>,
  walletAddress: string,
): Array<{ type: string; value: unknown }> {
  return params.map((param) => {
    const rawValue = String(values[param.name] ?? "").trim();
    const value = rawValue || String(param.default_value ?? "").trim();

    if (!value && param.required) {
      throw new Error(`${param.label || param.name} is required.`);
    }

    if (param.type === "boolean") {
      return {
        type: "Boolean",
        value: value === "true",
      };
    }

    if (param.type === "integer") {
      if (!/^-?\d+$/.test(value)) {
        throw new Error(`${param.label || param.name} must be an integer.`);
      }
      return {
        type: "Integer",
        value,
      };
    }

    if (param.type === "amount") {
      if (!/^-?\d+(?:\.\d+)?$/.test(value)) {
        throw new Error(`${param.label || param.name} must be numeric.`);
      }
      const scaledValue =
        typeof param.scale === "number"
          ? parseScaledDecimal(value, param.scale, param.label || param.name)
          : value;
      return {
        type: "Integer",
        value: scaledValue,
      };
    }

    if (param.type === "hash160") {
      const source = value === "$wallet" ? walletAddress : value;
      const hash = source.startsWith("0x")
        ? source.toLowerCase()
        : addressToScriptHash(source);
      if (!/^0x[0-9a-f]{40}$/.test(hash)) {
        throw new Error(
          `${param.label || param.name} must be a Neo N3 address or 0x-prefixed Hash160.`,
        );
      }
      return { type: "Hash160", value: hash };
    }

    if (param.type === "hash256") {
      return {
        type: "Hash256",
        value,
      };
    }

    if (param.type === "publickey") {
      if (!/^(02|03)[0-9a-fA-F]{64}$/.test(value)) {
        throw new Error(
          `${param.label || param.name} must be a compressed public key.`,
        );
      }
      return {
        type: "PublicKey",
        value,
      };
    }

    if (param.type === "bytearray") {
      const normalized = value.startsWith("0x") ? value.slice(2) : value;
      if (!/^[0-9a-fA-F]*$/.test(normalized)) {
        throw new Error(
          `${param.label || param.name} must be a hex byte array.`,
        );
      }
      return {
        type: "ByteArray",
        value: normalized,
      };
    }

    if (param.type === "address") {
      return {
        type: "String",
        value: value === "$wallet" ? walletAddress : value,
      };
    }

    return {
      type: "String",
      value,
    };
  });
}

export function resolveAnchorOperationAppId(
  appId: string,
  values: Record<string, string>,
  launchContext: MiniAppLaunchContext | null,
): string {
  if (
    appId === "miniapp-profitanchor" ||
    appId === "miniapp-profitanchor-admin"
  ) {
    return "miniapp-profitanchor";
  }
  if (
    appId === "miniapp-trustanchor" ||
    appId === "miniapp-trustanchor-admin"
  ) {
    return "miniapp-trustanchor";
  }
  if (appId !== "miniapp-custom-anchor") return "";
  return String(
    values.anchorAppId ||
      values.appId ||
      launchContext?.params.anchorAppId ||
      launchContext?.params.appId ||
      launchContext?.params.anchor ||
      "",
  ).trim();
}

export function resolveNetworkOperationMethod(
  appId: string,
  method: string,
  network: string,
): string {
  if (
    appId === "miniapp-self-loan" &&
    (network === "mainnet" || network === "neo-n3-mainnet") &&
    method === "repayLoan"
  ) {
    return "repayDebt";
  }
  return method;
}

export function resolveCustomAnchorOperations(
  operations: OperationEntry[],
  launchContext: MiniAppLaunchContext | null,
): OperationEntry[] {
  const anchorAppId = String(
    launchContext?.params.anchorAppId ||
      launchContext?.params.anchor ||
      launchContext?.params.appId ||
      "",
  ).trim();
  const userScoped = Boolean(anchorAppId);
  const userOrder = new Map([
    ["stakeNeo", 0],
    ["withdrawNeo", 1],
    ["claimRewards", 2],
  ]);
  const registrationOrder = new Map([["registerCustomAnchor", 0]]);

  return operations
    .map((operation) => {
      if (userScoped) {
        if (userOrder.has(operation.method)) {
          return { ...operation, priority: "primary" as const };
        }
        if (operation.method === "registerCustomAnchor") {
          return { ...operation, priority: "secondary" as const };
        }
        return { ...operation, priority: "operator" as const };
      }

      if (operation.method === "registerCustomAnchor") {
        return { ...operation, priority: "primary" as const };
      }
      if (userOrder.has(operation.method)) {
        return { ...operation, priority: "secondary" as const };
      }
      return operation;
    })
    .sort((left, right) => {
      if (userScoped) {
        const leftRank =
          userOrder.get(left.method) ??
          (left.method === "registerCustomAnchor" ? 10 : 20);
        const rightRank =
          userOrder.get(right.method) ??
          (right.method === "registerCustomAnchor" ? 10 : 20);
        return leftRank - rightRank;
      }
      const leftRank =
        registrationOrder.get(left.method) ??
        (userOrder.has(left.method) ? 10 : 20);
      const rightRank =
        registrationOrder.get(right.method) ??
        (userOrder.has(right.method) ? 10 : 20);
      return leftRank - rightRank;
    });
}

export function parseScaledDecimal(
  value: string,
  scale: number,
  label: string,
): string {
  if (!Number.isInteger(scale) || scale < 0 || scale > 18) {
    throw new Error(`${label} has an invalid scale.`);
  }
  const negative = value.startsWith("-");
  const raw = negative ? value.slice(1) : value;
  const [wholeRaw, fractionRaw = ""] = raw.split(".");
  if (!wholeRaw && !fractionRaw) throw new Error(`${label} must be numeric.`);
  if (fractionRaw.length > scale) {
    throw new Error(`${label} supports at most ${scale} decimal places.`);
  }
  const whole = wholeRaw || "0";
  const fraction = fractionRaw.padEnd(scale, "0");
  const scaled = `${whole}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
  return negative && scaled !== "0" ? `-${scaled}` : scaled;
}

export function toMiniAppNavItems(miniapps: MiniAppInfo[]): MiniAppNavItem[] {
  return miniapps.map((item) => ({
    app_id: item.app_id,
    name: item.name,
    category: item.category,
    entry_url: item.entry_url,
    logo_url: item.logo_url ?? null,
  }));
}

export function findCatalogAppById(
  miniapps: MiniAppInfo[],
  appId: string,
): MiniAppInfo | null {
  const target = appId.trim().toLowerCase();
  if (!target) return null;
  return miniapps.find((item) => item.app_id.toLowerCase() === target) ?? null;
}

export function resolveMiniAppDetailRouteId(appId: string): string {
  const target = appId.trim().toLowerCase();
  return MINIAPP_DETAIL_ROUTE_ALIASES[target] || appId;
}

function getRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getString(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

export function resolvePageCatalogNetwork(
  value: unknown,
): CatalogNetwork | null {
  const raw = getString(value).toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "neo-n3-mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet") return "neo-n3-testnet";
  return null;
}

export function oneGateNetworkParam(network: CatalogNetwork | null): string {
  if (network === "neo-n3-mainnet") return "mainnet";
  if (network === "neo-n3-testnet") return "testnet";
  return "";
}

const FRONTEND_LOCAL_OPERATION_METHODS = new Set([
  "explorerSearch",
  "sealPrivateTransfer",
  "buildOraclePackage",
  "sealOracleRequest",
  "drawTarotReading",
  "flipTarotReading",
  "bridgeAsset",
  "bridgeMessage",
  "trackBridgeOperation",
  "prepareMiniAppOperation",
]);

export function isFrontendLocalOperation(method?: string | null): boolean {
  return FRONTEND_LOCAL_OPERATION_METHODS.has(String(method || ""));
}

export function isOneGateVaultPayoutOperation(
  operation: OperationEntry,
): boolean {
  if (operation.method === "claimOneGateVault") return true;
  if (operation.method !== "claimPool") return false;
  return (operation.params ?? []).some((param) => {
    const text = `${param.name} ${param.label || ""}`.toLowerCase();
    return /claim\s*key|claimkey|(^|\W)key($|\W)/.test(text);
  });
}

export function buildFrontendOperationQuery(
  currentQuery: Record<string, unknown>,
  method: string,
  values: Record<string, string>,
  targetNetwork: CatalogNetwork | null,
): Record<string, string | string[]> {
  const next: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(currentQuery)) {
    if (key === "operation") continue;
    if (Array.isArray(value)) {
      next[key] = value.map((item) => String(item));
    } else if (value !== undefined && value !== null) {
      next[key] = String(value);
    }
  }

  next.operation = method;
  next.network = oneGateNetworkParam(targetNetwork);
  for (const [key, value] of Object.entries(values)) {
    const trimmed = String(value ?? "").trim();
    if (trimmed) next[key] = trimmed;
  }
  next._op = String(Date.now());
  return next;
}

export function frontendOperationFeedback(method: string): string {
  if (method === "explorerSearch") return "Explorer search parameters applied.";
  if (method === "sealPrivateTransfer")
    return "Private transfer sealing started in the playarea.";
  if (method === "sealOracleRequest")
    return "Oracle request sealing started in the playarea.";
  if (method === "buildOraclePackage") return "Oracle request package rebuilt.";
  if (method === "drawTarotReading") return "Tarot reading redrawn.";
  if (method === "flipTarotReading") return "Tarot reading flipped.";
  if (
    method === "bridgeAsset" ||
    method === "bridgeMessage" ||
    method === "trackBridgeOperation"
  ) {
    return "Bridge operation parameters applied.";
  }
  if (method === "prepareMiniAppOperation") {
    return "MiniApp operation parameters applied to the playarea preview.";
  }
  return "Operation parameters applied.";
}

export function resolveDirectMiniAppSlug(app: MiniAppInfo): string {
  const manifest = getRecord(app.manifest);
  const urls = getRecord(manifest.urls);
  const candidates = [app.dapp_url, app.entry_url, urls.dapp, urls.entry];

  for (const candidate of candidates) {
    const raw = getString(candidate);
    if (!raw) continue;
    try {
      const url = new URL(raw, "https://neomini.app");
      const parts = url.pathname.split("/").filter(Boolean);
      if (
        parts[0] === "miniapps" &&
        parts[1] &&
        !parts[1].startsWith("miniapp-")
      ) {
        return parts[1];
      }
    } catch {
      // Keep scanning candidate URLs.
    }
  }

  return "";
}

export function resolveOneGateDappId(app: MiniAppInfo): string {
  const manifest = getRecord(app.manifest);
  const onegate = getRecord(manifest.onegate);
  const raw = getString(onegate.id || onegate.app_id || onegate.dapp_id);
  return /^[A-Za-z0-9_.:-]{1,128}$/.test(raw) ? raw : "";
}

function firstQueryString(
  params: Record<string, string>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = getString(params[key]);
    if (value) return value;
  }
  return "";
}

export function buildOneGateVaultLaunchUrl(
  oneGateDappId: string,
  params: Record<string, string>,
  network: CatalogNetwork | null,
): string {
  const dappId = getString(oneGateDappId) || ONEGATE_VAULT_DAPP_ID;
  const url = new URL(
    `https://onegate.space/app/${encodeURIComponent(dappId)}`,
  );
  const key = firstQueryString(params, ["key", "claimKey", "code", "k"]);
  const pool = firstQueryString(params, ["pool", "poolId", "campaignId"]);
  const networkParam =
    firstQueryString(params, ["network", "chain"]) ||
    oneGateNetworkParam(network);

  if (key) url.searchParams.set("key", key);
  if (pool) url.searchParams.set("pool", pool);
  if (networkParam) url.searchParams.set("network", networkParam);
  return url.toString();
}

export function supportsPageCatalogNetwork(
  app: MiniAppInfo,
  network: CatalogNetwork | null,
): boolean {
  if (!network) return true;
  const manifest = getRecord(app.manifest);
  const supported = Array.isArray(manifest.supported_networks)
    ? manifest.supported_networks
        .map(resolvePageCatalogNetwork)
        .filter((item): item is CatalogNetwork => Boolean(item))
    : [];
  if (supported.length > 0 && !supported.includes(network)) return false;

  const runtimeModules = Array.isArray(getRecord(manifest.runtime).modules)
    ? (getRecord(manifest.runtime).modules as unknown[])
    : [];
  const supportsPlatformRuntime = runtimeModules.some((rawModule) => {
    const networks = getRecord(getRecord(rawModule).networks);
    const networkConfig = getRecord(networks[network]);
    return Boolean(getString(networkConfig.contract_hash));
  });
  if (supportsPlatformRuntime) return true;

  const contracts = getRecord(manifest.contracts);
  const hasNetworkedContracts = Object.values(contracts).some((value) =>
    Boolean(getString(value)),
  );
  if (!hasNetworkedContracts) {
    return (
      Boolean(app.contract_hash) ||
      supported.length > 0 ||
      !manifest.supported_networks
    );
  }

  return Boolean(resolveNetworkContractHash(app, network));
}

export function resolveNetworkContractHash(
  app: MiniAppInfo,
  network: CatalogNetwork | null,
): string | null {
  if (!network) return app.contract_hash || null;
  const contracts = getRecord(getRecord(app.manifest).contracts);
  const shortKey = network === "neo-n3-mainnet" ? "mainnet" : "testnet";
  const networkHash = getString(contracts[network] ?? contracts[shortKey]);
  if (networkHash) return networkHash;
  const hasNetworkedContracts = Object.values(contracts).some((value) =>
    Boolean(getString(value)),
  );
  return hasNetworkedContracts ? null : app.contract_hash || null;
}

export function withBundledAuthoritativeFields(
  remote: MiniAppInfo | null,
  bundled: MiniAppInfo | null,
): MiniAppInfo | null {
  if (!remote) return bundled;
  if (!bundled) return remote;
  return {
    ...remote,
    name: bundled.name || remote.name,
    description: bundled.description || remote.description,
    category: bundled.category || remote.category,
    contract_hash: bundled.contract_hash ?? remote.contract_hash,
    entry_url: bundled.entry_url || remote.entry_url,
    permissions: bundled.permissions ?? remote.permissions,
    operations: bundled.operations ?? remote.operations,
    detail_template: bundled.detail_template ?? remote.detail_template,
    logo_url: bundled.logo_url ?? remote.logo_url,
    banner_url: bundled.banner_url ?? remote.banner_url,
    docs_url: bundled.docs_url ?? remote.docs_url,
    manifest: bundled.manifest ?? remote.manifest,
  };
}

export function appendNavItemIfMissing(
  items: MiniAppNavItem[],
  app: MiniAppInfo,
): MiniAppNavItem[] {
  if (items.some((item) => item.app_id === app.app_id)) return items;
  return [
    {
      app_id: app.app_id,
      name: app.name,
      category: app.category,
      entry_url: app.entry_url,
      logo_url: app.logo_url ?? null,
    },
    ...items,
  ];
}

export function resolveOneGateStandaloneRedirect(
  id: string,
  url: string | undefined,
): string | null {
  const destination = ONEGATE_STANDALONE_REDIRECTS[id];
  if (!destination) return null;

  const queryString = (url || "").split("?")[1] || "";
  const params = new URLSearchParams(queryString);
  const isOneGateLaunch =
    params.get("source") === "onegate" ||
    params.has("oneGateAppId") ||
    params.has("oneGateId") ||
    params.get("operation") === "claimOneGateVault" ||
    params.has("key") ||
    params.has("claimKey") ||
    params.has("code") ||
    params.has("k") ||
    params.has("pool") ||
    params.has("poolId");
  if (!isOneGateLaunch) return null;

  const query = params.toString();
  return query ? `${destination}?${query}` : destination;
}
