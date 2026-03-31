import type { MiniAppInfo } from "@/components/types";

export type Dict = Record<string, unknown>;

export const APP_ID_REGEX = /^[a-z0-9][a-z0-9._-]*$/;
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const CONTRACT_HASH_REGEX = /^0x[0-9a-fA-F]{40}$/;
export const PUBKEY_REGEX = /^(?:0x)?[0-9a-fA-F]+$/;
export const ADMIN_SCHEMA_VERSION = "2026-02-21";

export const STAT_KEY_ALIASES: Record<string, string> = {
  tx_count: "total_transactions",
  gas_burned: "total_gas_used",
  gas_consumed: "total_gas_used",
};

export const MANIFEST_ENTRY_PREFIX = "mf://manifest?app=";

export const ALLOWED_STAT_KEYS = new Set([
  "total_transactions",
  "total_users",
  "total_gas_used",
  "total_gas_earned",
  "daily_active_users",
  "weekly_active_users",
  "last_activity_at",
]);

// ---------------------------------------------------------------------------
// Primitive coercion helpers
// ---------------------------------------------------------------------------

export function asObject(value: unknown): Dict {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Dict;
}

export function asString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

export function asTrimmedString(value: unknown): string {
  return asString(value).trim();
}

export function asOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

export function toIsoNow(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Field-level normalizers
// ---------------------------------------------------------------------------

export function normalizeOptionalUrl(value: unknown): string | null {
  const raw = asTrimmedString(value);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch (_e: unknown) {
    console.warn("[miniapp-admin] URL parse failed:", _e instanceof Error ? _e.message : String(_e));
    return null;
  }
}

export function normalizeContractHash(value: unknown): string | null {
  const raw = asTrimmedString(value);
  if (!raw) return null;
  if (!CONTRACT_HASH_REGEX.test(raw)) return null;
  return raw.toLowerCase();
}

export function normalizeDeveloperPubkey(value: unknown): string | null {
  const raw = asTrimmedString(value);
  if (!raw) return "";
  if (!PUBKEY_REGEX.test(raw)) return null;
  return raw.toLowerCase().replace(/^0x/, "");
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = value.map((item) => asTrimmedString(item)).filter(Boolean);
  return Array.from(new Set(out));
}

export function normalizeAssetsAllowed(value: unknown, fallback: unknown, expected: string): string[] | null {
  const raw = normalizeStringArray(value);
  const fallbackRaw = normalizeStringArray(fallback);
  const candidate = raw.length > 0 ? raw : fallbackRaw.length > 0 ? fallbackRaw : [expected];
  const normalized = Array.from(new Set(candidate.map((item) => item.toUpperCase())));
  if (!normalized.length) return [expected];
  if (normalized.some((item) => item !== expected)) return null;
  return [expected];
}

export function normalizeLimits(value: unknown, fallback?: MiniAppInfo["limits"] | null): MiniAppInfo["limits"] {
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

export function normalizeStatsDisplay(value: unknown, fallback?: unknown): string[] | null {
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

// ---------------------------------------------------------------------------
// Generic deep-clone & manifest cleaning
// ---------------------------------------------------------------------------

export function deepClone<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch (err) {
    console.warn("[deepClone] JSON serialization failed, returning original value:", err instanceof Error ? err.message : String(err));
    return value;
  }
}

export function cleanForManifest(value: unknown): unknown {
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

export function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Dict).length > 0;
  return true;
}

export function mergeContentFields(base: Dict, content: Dict): Dict {
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
