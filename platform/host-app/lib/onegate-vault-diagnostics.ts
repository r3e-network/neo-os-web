import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OneGateVaultDiagnosticEventType =
  | "missing_address"
  | "claim_error"
  | "scan_open"
  | "status_error";

export type OneGateVaultDiagnosticRecord = {
  id?: string;
  eventType: OneGateVaultDiagnosticEventType;
  network: "mainnet" | "testnet";
  appId: string;
  oneGateAppId: string;
  poolId: string;
  source: string;
  operation: string;
  platform: "iphone" | "android" | "ios-sim-or-mac" | "desktop" | "other";
  locale: string;
  userAgent: string;
  message: string;
  diagnostic: string;
  details: Record<string, unknown>;
  fingerprint: string;
  createdAt?: string;
};

const MAX_TEXT = 2_000;
const MAX_SHORT_TEXT = 160;

function text(value: unknown, max = MAX_TEXT): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizedIdentity(value: unknown, max = 128): string {
  const raw = text(value, max);
  return /^[A-Za-z0-9_.:-]{1,128}$/.test(raw) ? raw : "";
}

function normalizedEventType(value: unknown): OneGateVaultDiagnosticEventType {
  const raw = text(value, 64);
  if (
    raw === "missing_address" ||
    raw === "claim_error" ||
    raw === "scan_open" ||
    raw === "status_error"
  ) {
    return raw;
  }
  return "claim_error";
}

function normalizedNetwork(value: unknown): "mainnet" | "testnet" {
  return value === "testnet" ? "testnet" : "mainnet";
}

export function redactOneGateVaultDiagnosticText(value: unknown): string {
  let safe = text(value);
  safe = safe.replace(
    /\b(authorization|bearer|token|secret|wif|privateKey|private_key|claimKey|claim_key|key)=([^&\s"'<>]+)/gi,
    "$1=[redacted]",
  );
  safe = safe.replace(/\bogv_[A-Za-z0-9_:-]{6,128}\b/g, "[claim-key]");
  safe = safe.replace(/\bN[1-9A-HJ-NP-Za-km-z]{33}\b/g, "[neo-address]");
  safe = safe.replace(/[KL5][1-9A-HJ-NP-Za-km-z]{50,52}/g, "[secret-key]");
  safe = safe.replace(/https?:\/\/[^\s"'<>]+/gi, (match) => {
    try {
      const url = new URL(match);
      return `${url.origin}${url.pathname}${url.search ? "?[redacted]" : ""}`;
    } catch {
      return "[url]";
    }
  });
  return safe.slice(0, MAX_TEXT);
}

function sanitizeDetails(value: unknown, depth = 0): unknown {
  if (value == null) return null;
  if (typeof value === "string") return redactOneGateVaultDiagnosticText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeDetails(item, depth + 1));
  }
  if (typeof value !== "object" || depth >= 4) return "[redacted]";

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, 50)) {
    const safeKey = normalizedIdentity(key, 64) || "field";
    if (
      /^(claimKey|claim_key|key|token|secret|wif|privateKey|private_key|address|wallet|account)$/i.test(
        safeKey,
      )
    ) {
      output[safeKey] = "[redacted]";
      continue;
    }
    output[safeKey] = sanitizeDetails(item, depth + 1);
  }
  return output;
}

function detectPlatform(userAgent: string): OneGateVaultDiagnosticRecord["platform"] {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iphone";
  if (/Android/i.test(userAgent)) return "android";
  if (/Mac OS X/i.test(userAgent)) return "ios-sim-or-mac";
  if (/Windows|Linux/i.test(userAgent)) return "desktop";
  return "other";
}

function normalizedPlatform(
  value: unknown,
): OneGateVaultDiagnosticRecord["platform"] | "" {
  const raw = normalizedIdentity(value, 64);
  return raw === "iphone" ||
    raw === "android" ||
    raw === "ios-sim-or-mac" ||
    raw === "desktop" ||
    raw === "other"
    ? raw
    : "";
}

function hashFingerprint(parts: Array<string | undefined>): string {
  return crypto
    .createHash("sha256")
    .update(parts.filter(Boolean).join("\n"))
    .digest("hex");
}

export function normalizeOneGateVaultDiagnosticInput(
  input: Record<string, unknown>,
): OneGateVaultDiagnosticRecord {
  const userAgent = redactOneGateVaultDiagnosticText(input.userAgent).slice(
    0,
    512,
  );
  const diagnostic = redactOneGateVaultDiagnosticText(
    input.diagnostic ?? input.diagnostics,
  );
  const eventType = normalizedEventType(input.eventType);
  const network = normalizedNetwork(input.network);
  const source = normalizedIdentity(input.source, MAX_SHORT_TEXT) || "unknown";
  const operation =
    normalizedIdentity(input.operation ?? input.op, MAX_SHORT_TEXT) || "unknown";
  const appId =
    normalizedIdentity(input.appId ?? input.miniappId, MAX_SHORT_TEXT) ||
    "miniapp-gas-lucky-pool";
  const oneGateAppId =
    normalizedIdentity(
      input.oneGateAppId ?? input.oneGateId ?? input.onegateAppId,
      MAX_SHORT_TEXT,
    ) || "";
  const poolId =
    normalizedIdentity(input.poolId ?? input.pool ?? input.campaignId, 128) ||
    "";
  const platform = normalizedPlatform(input.platform) || detectPlatform(userAgent);
  const details = sanitizeDetails(input.details ?? input.runtime ?? {}) as Record<
    string,
    unknown
  >;
  const message = redactOneGateVaultDiagnosticText(input.message);
  const locale = normalizedIdentity(input.locale, 64);
  const fingerprint = hashFingerprint([
    eventType,
    network,
    appId,
    oneGateAppId,
    poolId,
    source,
    operation,
    platform,
    diagnostic.replace(/providerReq=\d+/g, "providerReq=*").replace(/providerReady=\d+/g, "providerReady=*"),
  ]);

  return {
    eventType,
    network,
    appId,
    oneGateAppId,
    poolId,
    source,
    operation,
    platform,
    locale,
    userAgent,
    message,
    diagnostic,
    details,
    fingerprint,
  };
}

export function toOneGateVaultDiagnosticRow(
  record: OneGateVaultDiagnosticRecord,
) {
  return {
    event_type: record.eventType,
    network: record.network,
    app_id: record.appId,
    onegate_app_id: record.oneGateAppId || null,
    pool_id: record.poolId || null,
    source: record.source,
    operation: record.operation,
    platform: record.platform,
    locale: record.locale || null,
    user_agent: record.userAgent,
    message: record.message,
    diagnostic: record.diagnostic,
    details: record.details,
    fingerprint: record.fingerprint,
  };
}

function fromOneGateVaultDiagnosticRow(
  row: Record<string, unknown>,
): OneGateVaultDiagnosticRecord {
  return {
    id: String(row.id ?? ""),
    eventType: normalizedEventType(row.event_type ?? row.eventType),
    network: normalizedNetwork(row.network),
    appId: text(row.app_id ?? row.appId, MAX_SHORT_TEXT),
    oneGateAppId: text(row.onegate_app_id ?? row.oneGateAppId, MAX_SHORT_TEXT),
    poolId: text(row.pool_id ?? row.poolId, MAX_SHORT_TEXT),
    source: text(row.source, MAX_SHORT_TEXT),
    operation: text(row.operation, MAX_SHORT_TEXT),
    platform:
      normalizedPlatform(row.platform) ||
      detectPlatform(text(row.user_agent ?? row.userAgent)),
    locale: text(row.locale, MAX_SHORT_TEXT),
    userAgent: text(row.user_agent ?? row.userAgent, 512),
    message: text(row.message),
    diagnostic: text(row.diagnostic),
    details:
      row.details && typeof row.details === "object"
        ? (row.details as Record<string, unknown>)
        : {},
    fingerprint: text(row.fingerprint, 64),
    createdAt: text(row.created_at ?? row.createdAt, MAX_SHORT_TEXT),
  };
}

export function summarizeOneGateVaultDiagnostics(
  records: OneGateVaultDiagnosticRecord[],
) {
  const byPlatform: Record<string, number> = {};
  const byEventType: Record<string, number> = {};
  const byNetwork: Record<string, number> = {};
  const groups = new Map<
    string,
    { fingerprint: string; count: number; eventType: string; platform: string; diagnostic: string }
  >();

  for (const record of records) {
    byPlatform[record.platform] = (byPlatform[record.platform] ?? 0) + 1;
    byEventType[record.eventType] = (byEventType[record.eventType] ?? 0) + 1;
    byNetwork[record.network] = (byNetwork[record.network] ?? 0) + 1;
    const existing = groups.get(record.fingerprint);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(record.fingerprint, {
        fingerprint: record.fingerprint,
        count: 1,
        eventType: record.eventType,
        platform: record.platform,
        diagnostic: record.diagnostic,
      });
    }
  }

  return {
    total: records.length,
    byPlatform,
    byEventType,
    byNetwork,
    groups: Array.from(groups.values()).sort((a, b) => b.count - a.count),
  };
}

export function createSupabaseOneGateVaultDiagnosticsRepository(
  supabase: SupabaseClient,
) {
  return {
    async create(input: Record<string, unknown>) {
      const record = normalizeOneGateVaultDiagnosticInput(input);
      const { data, error } = await supabase
        .from("onegate_vault_diagnostics")
        .insert(toOneGateVaultDiagnosticRow(record))
        .select("id,created_at")
        .single();
      if (error) throw new Error(String(error.message || "diagnostic insert failed"));
      return {
        ...record,
        id: data?.id ? String(data.id) : undefined,
        createdAt: data?.created_at ? String(data.created_at) : undefined,
      };
    },

    async listRecent(input: { limit?: number; network?: unknown } = {}) {
      const limit = Math.min(Math.max(Number(input.limit || 50), 1), 200);
      let query = supabase
        .from("onegate_vault_diagnostics")
        .select(
          "id,event_type,network,app_id,onegate_app_id,pool_id,source,operation,platform,locale,user_agent,message,diagnostic,details,fingerprint,created_at",
        );
      const network = input.network === "testnet" ? "testnet" : input.network === "mainnet" ? "mainnet" : "";
      if (network) query = query.eq("network", network);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(String(error.message || "diagnostic query failed"));
      return Array.isArray(data)
        ? data.map((row) => fromOneGateVaultDiagnosticRow(row as Record<string, unknown>))
        : [];
    },
  };
}
