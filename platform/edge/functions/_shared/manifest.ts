import { getChainConfig } from "./chains.ts";
import { isProductionEnv } from "./env.ts";
import { normalizeHex, normalizeHexBytes, sha256Hex } from "./hex.ts";

export type MiniAppChainContract = {
  address: string | null;
  abi?: unknown;
  entry_url?: string;
  active?: boolean;
  callback?: {
    address: string;
    method: string;
  };
};

export type MiniAppManifestCore = {
  appId: string;
  entryUrl: string;
  developerPubKeyHex: string; // hex (no 0x)
  manifestHashHex: string; // sha256, hex (no 0x)
  name: string;
  description: string;
  icon: string;
  banner: string;
  category: string;
  supportedChains: string[];
  contracts: Record<string, MiniAppChainContract>;
};

const SUPPORTED_PERMISSION_KEYS = new Set([
  "wallet",
  "payments",
  "governance",
  "rng",
  "datafeed",
  "storage",
  "oracle",
  "compute",
  "automation",
  "apps",
  "secrets",
  "cross_chain",
]);

const SUPPORTED_STATS_KEYS = new Set([
  "total_transactions",
  "total_users",
  "total_gas_used",
  "total_gas_earned",
  "daily_active_users",
  "weekly_active_users",
  "last_activity_at",
]);

const STATS_KEY_ALIASES = new Map<string, string>([
  ["tx_count", "total_transactions"],
  ["gas_burned", "total_gas_used"],
  ["gas_consumed", "total_gas_used"],
]);

const SUPPORTED_CATEGORIES = new Set(["gaming", "defi", "governance", "utility", "social", "nft"]);

const CHAIN_ID_PATTERN = /^[a-z0-9]+-[a-z0-9]+(-[a-z0-9]+)*$/;

function stableSort(value: unknown): unknown {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(stableSort);
  if (typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v === undefined) continue;
    out[key] = stableSort(v);
  }
  return out;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableSort(value));
}

function normalizeStringList(
  value: unknown,
  label: string,
  mode: "upper" | "lower" | "preserve" = "preserve"
): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const items = value
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .map((v) => (mode === "upper" ? v.toUpperCase() : mode === "lower" ? v.toLowerCase() : v));
  return Array.from(new Set(items)).sort();
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeSupportedChains(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const list = value
    .map((v) =>
      String(v ?? "")
        .trim()
        .toLowerCase()
    )
    .filter(Boolean)
    .filter((v) => CHAIN_ID_PATTERN.test(v));
  const deduped = Array.from(new Set(list)).sort();
  for (const chainId of deduped) {
    if (!getChainConfig(chainId)) {
      throw new Error(`manifest.supported_chains contains unknown chain: ${chainId}`);
    }
  }
  return deduped;
}

function normalizeAddress(chainId: string, value: unknown, label: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error(`${label} required`);
  return normalizeHexBytes(raw, 20, label);
}

function normalizeContractEntry(chainId: string, raw: unknown): MiniAppChainContract {
  const obj = asObject(raw);
  if (obj.address === undefined) {
    const hasLegacy =
      "contract_address" in obj ||
      "contract_hash" in obj ||
      "script_hash" in obj ||
      "hash" in obj ||
      "contractHash" in obj;
    if (hasLegacy) {
      throw new Error(`manifest.contracts.${chainId}.address required (legacy address fields are not supported)`);
    }
  }

  const address = obj.address ? normalizeAddress(chainId, obj.address, `manifest.contracts.${chainId}.address`) : null;
  const entryUrl = String(obj.entry_url ?? obj.entryUrl ?? "").trim();
  const active = typeof obj.active === "boolean" ? obj.active : undefined;

  let callback: MiniAppChainContract["callback"];
  const callbackObj = asObject(obj.callback);
  const callbackAddressRaw = obj.callback_contract ?? callbackObj.address ?? callbackObj.contract;
  const callbackMethodRaw = obj.callback_method ?? callbackObj.method;
  if (callbackAddressRaw || callbackMethodRaw) {
    if (!callbackAddressRaw || !callbackMethodRaw) {
      throw new Error(`manifest.contracts.${chainId}.callback requires address and method`);
    }
    callback = {
      address: normalizeAddress(chainId, callbackAddressRaw, `manifest.contracts.${chainId}.callback.address`),
      method: String(callbackMethodRaw).trim(),
    };
  }

  const out: MiniAppChainContract = { address };
  if (entryUrl) out.entry_url = entryUrl;
  if (active !== undefined) out.active = active;
  if (callback) out.callback = callback;
  if (obj.abi !== undefined) out.abi = obj.abi;
  return out;
}

function normalizeContracts(value: unknown, supportedChains: string[]): Record<string, MiniAppChainContract> {
  const obj = asObject(value);
  const contracts: Record<string, MiniAppChainContract> = {};

  for (const [chainIdRaw, entry] of Object.entries(obj)) {
    const chainId = String(chainIdRaw ?? "")
      .trim()
      .toLowerCase();
    if (!CHAIN_ID_PATTERN.test(chainId)) continue;
    if (!getChainConfig(chainId)) {
      throw new Error(`manifest.contracts contains unknown chain: ${chainId}`);
    }
    contracts[chainId] = normalizeContractEntry(chainId, entry);
  }

  for (const chainId of supportedChains) {
    if (!contracts[chainId]) {
      contracts[chainId] = { address: null };
    }
  }

  return contracts;
}

function normalizeAssetPolicy(value: unknown, label: string): string[] | Record<string, string[]> {
  if (Array.isArray(value)) {
    return normalizeStringList(value, label, "upper");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an array or object`);
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, string[]> = {};
  for (const [chainIdRaw, list] of Object.entries(obj)) {
    const chainId = String(chainIdRaw ?? "")
      .trim()
      .toLowerCase();
    if (!CHAIN_ID_PATTERN.test(chainId)) {
      throw new Error(`${label} contains invalid chain id: ${chainId}`);
    }
    out[chainId] = normalizeStringList(list, `${label}.${chainId}`, "upper");
  }
  return out;
}

function normalizePermissions(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) {
    throw new Error("manifest.permissions must be an object or array");
  }

  // Blueprint form: ["payments","rng",...]
  if (Array.isArray(value)) {
    const list = normalizeStringList(value, "manifest.permissions", "lower");
    const out: Record<string, unknown> = {};
    for (const key of list) {
      if (!SUPPORTED_PERMISSION_KEYS.has(key)) {
        throw new Error(`manifest.permissions contains unsupported permission: ${key}`);
      }
      if (key === "wallet") {
        out[key] = ["read-address"];
      } else {
        out[key] = true;
      }
    }
    return out;
  }

  // Expanded form: { payments: true, wallet: ["read-address"], ... }
  if (typeof value !== "object") {
    throw new Error("manifest.permissions must be an object or array");
  }

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [rawKey, rawVal] of Object.entries(obj)) {
    const key = String(rawKey ?? "").trim();
    if (!key) continue;
    if (!SUPPORTED_PERMISSION_KEYS.has(key)) {
      throw new Error(`manifest.permissions contains unsupported permission: ${key}`);
    }

    if (typeof rawVal === "boolean") {
      if (key === "wallet" && rawVal) {
        out[key] = ["read-address"];
      } else {
        out[key] = rawVal;
      }
      continue;
    }

    if (Array.isArray(rawVal)) {
      const list = normalizeStringList(rawVal, `manifest.permissions.${key}`, "lower");
      if (key === "wallet") {
        const allowedWallet = new Set(["read-address"]);
        for (const entry of list) {
          if (!allowedWallet.has(entry)) {
            throw new Error(`manifest.permissions.wallet contains unsupported entry: ${entry}`);
          }
        }
      }
      out[key] = list;
      continue;
    }

    if (rawVal === null || rawVal === undefined) {
      // Treat explicit null/undefined as "not granted".
      out[key] = false;
      continue;
    }

    throw new Error(`manifest.permissions.${key} must be a boolean or array`);
  }

  return out;
}

function normalizeLimits(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) {
    throw new Error("manifest.limits must be an object");
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("manifest.limits must be an object");
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  // Keep arbitrary limit keys, but normalize values to trimmed strings for hashing.
  for (const [rawKey, rawVal] of Object.entries(obj)) {
    const key = String(rawKey ?? "").trim();
    if (!key) continue;
    const val = String(rawVal ?? "").trim();
    if (!val) continue;
    out[key] = val;
  }
  return out;
}

function normalizeStatsDisplay(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("manifest.stats_display must be an array");
  }
  const list = normalizeStringList(value, "manifest.stats_display", "lower");
  const mapped = list.map((key) => STATS_KEY_ALIASES.get(key) ?? key);
  const deduped = Array.from(new Set(mapped)).sort();
  for (const key of deduped) {
    if (!SUPPORTED_STATS_KEYS.has(key)) {
      throw new Error(`manifest.stats_display contains unsupported key: ${key}`);
    }
  }
  return deduped;
}

function normalizeCategory(value: unknown): string {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) {
    throw new Error("manifest.category must be a non-empty string");
  }
  if (!SUPPORTED_CATEGORIES.has(raw)) {
    throw new Error(`manifest.category must be one of: ${Array.from(SUPPORTED_CATEGORIES).join(", ")}`);
  }
  return raw;
}

export function canonicalizeMiniAppManifest(manifest: unknown): Record<string, unknown> {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("manifest must be an object");
  }
  const m = manifest as Record<string, unknown>;

  const appId = String(m.app_id ?? "").trim();
  const entryUrl = String(m.entry_url ?? "").trim();
  const developerPubKey = String(m.developer_pubkey ?? "").trim();

  if (!appId) throw new Error("manifest.app_id required");
  if (!entryUrl) throw new Error("manifest.entry_url required");
  if (!developerPubKey) throw new Error("manifest.developer_pubkey required");

  const out: Record<string, unknown> = { ...m };
  out.app_id = appId;
  out.entry_url = entryUrl;
  out.developer_pubkey = normalizeHex(developerPubKey, "manifest.developer_pubkey");

  if ("name" in m) out.name = String(m.name ?? "").trim();
  if ("version" in m) out.version = String(m.version ?? "").trim();
  if ("description" in m) out.description = String(m.description ?? "").trim();
  if ("icon" in m) out.icon = String(m.icon ?? "").trim();
  if ("banner" in m) out.banner = String(m.banner ?? "").trim();
  if ("category" in m) {
    out.category = normalizeCategory(m.category);
  }

  if ("supportedChains" in m && m.supported_chains === undefined) {
    throw new Error("manifest.supported_chains required (supportedChains is not supported)");
  }
  const supportedChainsRaw = m.supported_chains;
  let supportedChains: string[] = [];
  if (supportedChainsRaw !== undefined) {
    supportedChains = normalizeSupportedChains(supportedChainsRaw, "manifest.supported_chains");
  }

  if ("contract_hash" in m || "contractHash" in m) {
    throw new Error("manifest.contract_hash is no longer supported; use manifest.contracts");
  }
  let contractsRaw = m.contracts ?? undefined;

  let contracts = normalizeContracts(contractsRaw, supportedChains);
  if (supportedChains.length === 0) {
    supportedChains = Object.keys(contracts).sort();
  }
  if (supportedChains.length === 0) {
    throw new Error("manifest.supported_chains required");
  }

  if ("callback_contract" in m || "callbackContract" in m || "callback_method" in m || "callbackMethod" in m) {
    throw new Error("manifest.callback_contract is no longer supported; use contracts.<chain>.callback");
  }

  out.supported_chains = supportedChains;
  out.contracts = contracts;

  if ("assets_allowed" in m) {
    out.assets_allowed = normalizeAssetPolicy(m.assets_allowed, "manifest.assets_allowed");
  }
  if ("governance_assets_allowed" in m) {
    out.governance_assets_allowed = normalizeAssetPolicy(
      m.governance_assets_allowed,
      "manifest.governance_assets_allowed"
    );
  }
  if ("sandbox_flags" in m) {
    out.sandbox_flags = normalizeStringList(m.sandbox_flags, "manifest.sandbox_flags", "lower");
  }
  if ("contracts_needed" in m) {
    out.contracts_needed = normalizeStringList(m.contracts_needed, "manifest.contracts_needed", "preserve");
  }
  if ("permissions" in m) {
    out.permissions = normalizePermissions(m.permissions);
  }
  if ("limits" in m) {
    out.limits = normalizeLimits(m.limits);
  }
  const newsIntegrationRaw = m.news_integration;
  if ("news_integration" in m) {
    if (typeof newsIntegrationRaw !== "boolean") {
      throw new Error("manifest.news_integration must be a boolean");
    }
    out.news_integration = newsIntegrationRaw;
  }
  let statsDisplay: string[] | undefined;
  if ("stats_display" in m) {
    statsDisplay = normalizeStatsDisplay(m.stats_display);
    out.stats_display = statsDisplay;
  }
  const requiresContracts = newsIntegrationRaw !== false || (Array.isArray(statsDisplay) && statsDisplay.length > 0);
  const hasContractAddress = Object.values(contracts).some((entry) => Boolean(entry?.address));
  if (requiresContracts && !hasContractAddress) {
    throw new Error("manifest.contracts address required when news/stats are enabled");
  }

  return out;
}

export async function computeManifestHashHex(manifest: unknown): Promise<string> {
  const canonical = canonicalizeMiniAppManifest(manifest);
  const payload = stableStringify(canonical);
  return sha256Hex(payload);
}

function isModuleFederationEntry(entryUrl: string): boolean {
  if (!entryUrl.startsWith("mf://")) return false;
  try {
    const parsed = new URL(entryUrl);
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function enforceMiniAppAssetPolicy(manifest: unknown): void {
  const canonical = canonicalizeMiniAppManifest(manifest);
  const supportedChains = Array.isArray(canonical.supported_chains) ? (canonical.supported_chains as string[]) : [];

  const resolvePolicy = (label: string, policy: unknown, chainId: string): string[] | null => {
    if (!policy) return null;
    if (Array.isArray(policy)) return normalizeStringList(policy, label, "upper");
    if (typeof policy === "object" && !Array.isArray(policy)) {
      const map = policy as Record<string, unknown>;
      const value = map[chainId];
      if (value === undefined) return null;
      return normalizeStringList(value, `${label}.${chainId}`, "upper");
    }
    return null;
  };

  for (const chainId of supportedChains) {
    const chain = getChainConfig(chainId);
    if (!chain || chain.type !== "neo-n3") continue;

    const assetsAllowed = resolvePolicy("manifest.assets_allowed", canonical.assets_allowed, chainId) ?? ["GAS"];
    if (assetsAllowed.length !== 1 || assetsAllowed[0] !== "GAS") {
      throw new Error('manifest.assets_allowed must be exactly ["GAS"] for neo-n3 chains');
    }

    const governanceAllowed = resolvePolicy(
      "manifest.governance_assets_allowed",
      canonical.governance_assets_allowed,
      chainId
    ) ?? ["NEO"];
    if (governanceAllowed.length !== 1 || governanceAllowed[0] !== "NEO") {
      throw new Error('manifest.governance_assets_allowed must be exactly ["NEO"] for neo-n3 chains');
    }
  }

  const entryUrl = String(canonical.entry_url ?? "").trim();
  if (
    isProductionEnv() &&
    !entryUrl.startsWith("https://") &&
    !entryUrl.startsWith("/miniapps/") &&
    !isModuleFederationEntry(entryUrl)
  ) {
    throw new Error("manifest.entry_url must use https://, /miniapps/, or mf:// in production");
  }
}

export async function parseMiniAppManifestCore(manifest: unknown): Promise<MiniAppManifestCore> {
  enforceMiniAppAssetPolicy(manifest);
  const canonical = canonicalizeMiniAppManifest(manifest);

  const appId = String(canonical.app_id ?? "").trim();
  const entryUrl = String(canonical.entry_url ?? "").trim();
  const developerPubKeyHex = normalizeHex(String(canonical.developer_pubkey ?? ""), "manifest.developer_pubkey");
  const name = String(canonical.name ?? "").trim();
  const description = String(canonical.description ?? "").trim();
  const icon = String(canonical.icon ?? "").trim();
  const banner = String(canonical.banner ?? "").trim();
  const category = String(canonical.category ?? "").trim();
  const supportedChains = Array.isArray(canonical.supported_chains) ? (canonical.supported_chains as string[]) : [];
  const contracts = asObject(canonical.contracts) as Record<string, MiniAppChainContract>;

  const manifestHashHex = await computeManifestHashHex(canonical);

  return {
    appId,
    entryUrl,
    developerPubKeyHex,
    manifestHashHex,
    name,
    description,
    icon,
    banner,
    category,
    supportedChains,
    contracts,
  };
}
