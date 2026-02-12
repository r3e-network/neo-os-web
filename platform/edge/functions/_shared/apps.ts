import { parseDecimalToInt } from "./amount.ts";
import { getEnv, isProductionEnv } from "./env.ts";
import {
  canonicalizeMiniAppManifest,
  enforceMiniAppAssetPolicy,
  type MiniAppChainContract,
  type MiniAppManifestCore,
} from "./manifest.ts";
import { error } from "./response.ts";
import { supabaseServiceClient } from "./supabase.ts";
import { initializeStatsForApp } from "./stats-init.ts";

export type MiniAppPolicy = {
  appId: string;
  manifestHash: string;
  status: string;
  supportedChains: string[];
  contracts: Record<string, MiniAppChainContract>;
  permissions: Record<string, unknown>;
  limits: {
    maxGasPerTx?: bigint;
    dailyGasCapPerUser?: bigint;
    governanceCap?: bigint;
  };
};

type UsageMode = "record" | "check";

type UsageCapInput = {
  appId: string;
  userId: string;
  chainId?: string;
  gasDelta?: bigint;
  governanceDelta?: bigint;
  gasCap?: bigint;
  governanceCap?: bigint;
  mode?: string;
  req?: Request;
};

type MiniAppRow = {
  app_id: string;
  developer_user_id: string;
  manifest_hash: string;
  manifest: Record<string, unknown>;
  status: string;
};

function parseGasLimit(raw: unknown, label: string): bigint | undefined {
  const value = String(raw ?? "").trim();
  if (!value) return undefined;
  const parsed = parseDecimalToInt(value, 8);
  if (parsed <= 0n) {
    throw new Error(`${label} must be > 0`);
  }
  return parsed;
}

function parseNeoLimit(raw: unknown, label: string): bigint | undefined {
  const value = String(raw ?? "").trim();
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) {
    throw new Error(`${label} must be an integer string`);
  }
  const parsed = BigInt(value);
  if (parsed <= 0n) {
    throw new Error(`${label} must be > 0`);
  }
  return parsed;
}

export function permissionEnabled(permissions: Record<string, unknown> | undefined, key: string): boolean {
  if (!permissions) return false;
  const value = permissions[key];
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function parseUsageMode(raw: string | undefined): UsageMode | null {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!value) return null;
  if (value === "record") return "record";
  if (
    value === "check" ||
    value === "cap-only" ||
    value === "caps-only" ||
    value === "cap_only" ||
    value === "caps_only"
  ) {
    return "check";
  }
  return null;
}

function resolveUsageMode(override?: string): UsageMode {
  const explicit = parseUsageMode(override);
  if (explicit) return explicit;
  const envMode = parseUsageMode(getEnv("MINIAPP_USAGE_MODE"));
  if (envMode) return envMode;
  return "record";
}

export async function enforceUsageCaps(input: UsageCapInput): Promise<Response | null> {
  const hasGas = typeof input.gasCap === "bigint" && input.gasCap > 0n;
  const hasGovernance = typeof input.governanceCap === "bigint" && input.governanceCap > 0n;
  const gasDelta = typeof input.gasDelta === "bigint" ? input.gasDelta : 0n;
  const governanceDelta = typeof input.governanceDelta === "bigint" ? input.governanceDelta : 0n;
  const hasUsage = gasDelta > 0n || governanceDelta > 0n;
  const enforceCaps = hasGas || hasGovernance;
  const usageMode = resolveUsageMode(input.mode);
  const recordUsage = usageMode === "record";
  if (!enforceCaps && (!hasUsage || !recordUsage)) return null;

  let supabase;
  try {
    supabase = supabaseServiceClient();
  } catch (err) {
    if (!enforceCaps) {
      console.warn("usage tracking unavailable", err);
      return null;
    }
    return error(500, "usage tracking unavailable", "USAGE_UNAVAILABLE", input.req);
  }
  const rpcName = recordUsage ? "miniapp_usage_bump" : "miniapp_usage_check";
  const { error: bumpErr } = await supabase.rpc(rpcName, {
    p_user_id: input.userId,
    p_app_id: input.appId,
    p_chain_id: input.chainId ?? "neo-n3-mainnet",
    p_gas_delta: gasDelta.toString(),
    p_governance_delta: governanceDelta.toString(),
    p_gas_cap: hasGas ? input.gasCap?.toString() : null,
    p_governance_cap: hasGovernance ? input.governanceCap?.toString() : null,
  });

  if (bumpErr) {
    const message = bumpErr.message ?? "usage cap enforcement failed";
    if (message.toLowerCase().includes("cap_exceeded")) {
      return error(403, "usage cap exceeded", "LIMIT_EXCEEDED", input.req);
    }
    if (!enforceCaps) {
      console.warn("usage tracking failed", message);
      return null;
    }
    if (!isProductionEnv()) return null;
    return error(503, `usage tracking unavailable: ${message}`, "USAGE_UNAVAILABLE", input.req);
  }

  return null;
}

export async function upsertMiniAppManifest(input: {
  core: MiniAppManifestCore;
  canonicalManifest: Record<string, unknown>;
  developerUserId: string;
  mode: "register" | "update";
  req?: Request;
}): Promise<Response | null> {
  const supabase = supabaseServiceClient();

  const { data: existing, error: loadErr } = await supabase
    .from("miniapps")
    .select("app_id,developer_user_id")
    .eq("app_id", input.core.appId)
    .maybeSingle();

  if (loadErr) return error(500, `failed to load app registry: ${loadErr.message}`, "DB_ERROR", input.req);

  if (existing) {
    if (String((existing as Record<string, unknown>)?.developer_user_id ?? "") !== input.developerUserId) {
      return error(403, "app_id already registered by another developer", "APP_OWNER_MISMATCH", input.req);
    }
    if (input.mode === "register") {
      return error(409, "app_id already registered", "APP_ALREADY_REGISTERED", input.req);
    }
  } else if (input.mode === "update") {
    return error(404, "app_id not registered", "APP_NOT_FOUND", input.req);
  }

  let canonical: Record<string, unknown>;
  try {
    enforceMiniAppAssetPolicy(input.canonicalManifest);
    canonical = canonicalizeMiniAppManifest(input.canonicalManifest);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return error(400, message, "MANIFEST_INVALID", input.req);
  }
  const permissions = (canonical.permissions as Record<string, unknown> | undefined) ?? {};
  const limits = (canonical.limits as Record<string, unknown> | undefined) ?? {};
  const assetsAllowed = canonical.assets_allowed ?? null;
  const governanceAssetsAllowed = canonical.governance_assets_allowed ?? null;
  const supportedChains = Array.isArray(canonical.supported_chains) ? (canonical.supported_chains as string[]) : [];
  const contracts = (canonical.contracts as Record<string, MiniAppChainContract> | undefined) ?? {};

  const payload: Record<string, unknown> = {
    app_id: input.core.appId,
    developer_user_id: input.developerUserId,
    manifest_hash: input.core.manifestHashHex,
    entry_url: input.core.entryUrl,
    developer_pubkey: input.core.developerPubKeyHex,
    manifest: canonical,
    supported_chains: supportedChains,
    contracts,
    permissions,
    limits,
    assets_allowed: assetsAllowed,
    governance_assets_allowed: governanceAssetsAllowed,
    updated_at: new Date().toISOString(),
  };
  if (!existing || input.mode === "update") {
    payload.status = "pending";
  }

  const { error: upsertErr } = await supabase.from("miniapps").upsert(payload, { onConflict: "app_id" });

  if (upsertErr) {
    return error(500, `failed to store miniapp manifest: ${upsertErr.message}`, "DB_ERROR", input.req);
  }

  // Eager stats creation for new registrations (async, non-blocking)
  // Note: Database trigger also creates stats, this is a backup mechanism
  if (input.mode === "register" && !existing) {
    // Fire and forget - don't block registration on stats creation
    initializeStatsForApp(input.core.appId, supportedChains).catch((err) => {
      console.warn(`[apps] Stats initialization failed for ${input.core.appId}:`, err);
    });
  }

  return null;
}

export async function fetchMiniAppPolicy(appId: string, req?: Request): Promise<MiniAppPolicy | Response | null> {
  const supabase = supabaseServiceClient();
  const { data, error: loadErr } = await supabase
    .from("miniapps")
    .select("app_id,manifest_hash,manifest,status")
    .eq("app_id", appId)
    .maybeSingle();

  if (loadErr) return error(500, `failed to load app registry: ${loadErr.message}`, "DB_ERROR", req);

  if (!data) {
    if (isProductionEnv()) {
      return error(404, "app_id not registered", "APP_NOT_FOUND", req);
    }
    return null;
  }

  const row = data as MiniAppRow;
  const status = String(row.status ?? "").toLowerCase();
  if (status && status !== "active") {
    return error(403, "app is not active", "APP_INACTIVE", req);
  }

  let canonical: Record<string, unknown>;
  try {
    enforceMiniAppAssetPolicy(row.manifest ?? {});
    canonical = canonicalizeMiniAppManifest(row.manifest ?? {});
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return error(500, `stored manifest invalid: ${detail}`, "APP_MANIFEST_INVALID", req);
  }

  const permissions = (canonical.permissions as Record<string, unknown> | undefined) ?? {};
  const limitsRaw = (canonical.limits as Record<string, unknown> | undefined) ?? {};
  const supportedChains = Array.isArray(canonical.supported_chains) ? (canonical.supported_chains as string[]) : [];
  const contracts = (canonical.contracts as Record<string, MiniAppChainContract> | undefined) ?? {};

  let limits: MiniAppPolicy["limits"];
  try {
    limits = {
      maxGasPerTx: parseGasLimit(limitsRaw.max_gas_per_tx, "manifest.limits.max_gas_per_tx"),
      dailyGasCapPerUser: parseGasLimit(limitsRaw.daily_gas_cap_per_user, "manifest.limits.daily_gas_cap_per_user"),
      governanceCap: parseNeoLimit(limitsRaw.governance_cap, "manifest.limits.governance_cap"),
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return error(500, message, "APP_LIMITS_INVALID", req);
  }

  const manifestHash = String(row.manifest_hash ?? "");
  return {
    appId,
    manifestHash,
    status: status || "active",
    supportedChains,
    contracts,
    permissions,
    limits,
  };
}
