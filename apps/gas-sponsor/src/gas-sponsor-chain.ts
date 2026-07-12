import type { MiniAppFramework } from "@shared/react";
import {
  GAS_HASH,
  getMiniAppContractHash,
  getRpcUrl,
  resolveNeoNetwork,
  type NeoNetwork,
} from "@shared/constants/rpc";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import { addressToScriptHash, parseHash160, parseStackItem } from "@shared/utils/neo";

export const GAS_SPONSOR_APP_ID = "miniapp-gas-sponsor";
export const GAS_SPONSOR_POOL_TYPE_PUBLIC = 1;
export const GAS_SPONSOR_MIN_CREATE_RAW = "100000000";
export const GAS_SPONSOR_MAX_CLAIM_RAW = "10000000";
export const GAS_SPONSOR_MIN_TOP_UP_RAW = "50000000";
export const GAS_SPONSOR_DESCRIPTION_MAX_LENGTH = 200;
export const GAS_SPONSOR_PAYMENT_MEMO = GAS_SPONSOR_APP_ID;

export type GasSponsorPoolStatus =
  | "active"
  | "expired"
  | "depleted"
  | "withdrawn"
  | "inactive";

export interface GasSponsorPool {
  id: string;
  sponsor: string;
  poolType: number;
  initialAmountRaw: string;
  remainingAmountRaw: string;
  maxClaimPerUserRaw: string;
  totalClaimedRaw: string;
  claimCount: number;
  createTimeMs: number;
  expiryTimeMs: number;
  active: boolean;
  description: string;
  status: GasSponsorPoolStatus;
  isMine: boolean;
}

export interface GasSponsorPlatformStats {
  totalPools: number;
  activePools: number;
  totalSponsoredRaw: string;
  totalClaimedRaw: string;
  totalSponsors: number;
  totalBeneficiaries: number;
  minSponsorshipRaw: string;
  maxClaimPerTxRaw: string;
  /** Despite the deployed map key saying "Seconds", live pools use this as milliseconds. */
  defaultExpiryMs: number;
  topUpMinRaw: string;
  maxWhitelistSize: number;
  loadedAtMs: number;
}

export type GasSponsorOperationKind = "create" | "claim" | "topUp" | "withdraw" | "extend";

export interface GasSponsorOutcome {
  status: "idle" | "pending" | "confirmed" | "failed" | "unknown";
  operation: GasSponsorOperationKind | null;
  message: string;
  txid?: string;
  paymentTxid?: string;
  poolId?: string;
  amountRaw?: string;
}

export interface PendingGasSponsorOperation {
  version: 2;
  kind: GasSponsorOperationKind;
  phase: "payment-broadcast" | "payment-confirmed" | "target-broadcast";
  network: NeoNetwork;
  contractHash: string;
  gasHash: string;
  walletHash: string;
  createdAtMs: number;
  paymentTxid?: string;
  txid?: string;
  poolId?: string;
  amountRaw?: string;
  maxClaimRaw?: string;
  description?: string;
  newExpiryMs?: number;
  baselinePoolCount: number;
  baselineInitialRaw?: string;
  baselineRemainingRaw?: string;
  baselineClaimedRaw?: string;
  baselineExpiryMs?: number;
  baselineUserClaimedRaw?: string;
}

export interface GasSponsorChainContext {
  network: NeoNetwork;
  contractHash: string;
  gasHash: string;
}

export interface GasSponsorNotification {
  contract: string;
  eventName: string;
  state: unknown[];
}

export interface GasSponsorTransactionOutcome {
  state: "halt" | "fault" | "unknown";
  notifications: GasSponsorNotification[];
}

const ZERO_HASH = /^0x0{40}$/i;
const DISPLAY_HASH = /^0x[0-9a-f]{40}$/i;
const TXID = /^0x[0-9a-f]{64}$/i;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export function gasSponsorUnsigned(value: unknown, field = "value"): bigint {
  const text = clean(value);
  if (!/^\d+$/.test(text)) throw new Error(`Invalid ${field}.`);
  return BigInt(text);
}

export function gasSponsorSafeInteger(value: unknown, field = "value"): number {
  const parsed = gasSponsorUnsigned(value, field);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`Unsafe ${field}.`);
  return Number(parsed);
}

export function gasSponsorRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Malformed Gas Sponsor map.");
  }
  return value as Record<string, unknown>;
}

function exactBoolean(value: unknown, field: string): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  throw new Error(`Invalid ${field}.`);
}

function reverseDisplayHash(value: string): string {
  const bytes = value.replace(/^0x/i, "").match(/../g) ?? [];
  return bytes.length === 20 ? `0x${[...bytes].reverse().join("")}`.toLowerCase() : "";
}

/** Normalize configuration/user input. A 0x value is already display-order. */
export function normalizeGasSponsorAccount(value: unknown): string {
  const raw = clean(value);
  if (DISPLAY_HASH.test(raw) && !ZERO_HASH.test(raw)) return raw.toLowerCase();
  const fromAddress = addressToScriptHash(raw);
  return DISPLAY_HASH.test(fromAddress) && !ZERO_HASH.test(fromAddress)
    ? fromAddress.toLowerCase()
    : "";
}

/** Decode a Hash160 returned by the VM (little-endian ByteString). */
export function parseGasSponsorChainAccount(value: unknown): string {
  const raw = clean(value);
  const fromAddress = addressToScriptHash(raw);
  if (DISPLAY_HASH.test(fromAddress) && !ZERO_HASH.test(fromAddress)) return fromAddress.toLowerCase();
  const parsed = parseHash160(value);
  return DISPLAY_HASH.test(parsed) && !ZERO_HASH.test(parsed) ? parsed.toLowerCase() : "";
}

function accountVariants(value: unknown): Set<string> {
  const values = new Set<string>();
  const normalized = normalizeGasSponsorAccount(value);
  if (normalized) {
    values.add(normalized);
    values.add(reverseDisplayHash(normalized));
  }
  const parsed = parseGasSponsorChainAccount(value);
  if (parsed) {
    values.add(parsed);
    values.add(reverseDisplayHash(parsed));
  }
  values.delete("");
  return values;
}

export function gasSponsorAccountsMatch(left: unknown, right: unknown): boolean {
  const lhs = accountVariants(left);
  const rhs = accountVariants(right);
  return lhs.size > 0 && rhs.size > 0 && [...lhs].some((candidate) => rhs.has(candidate));
}

function poolStatus(value: unknown, active: boolean, remaining: bigint, expiryTimeMs: number): GasSponsorPoolStatus {
  const reported = clean(value).toLowerCase();
  if (["active", "expired", "depleted", "withdrawn", "inactive"].includes(reported)) {
    return reported as GasSponsorPoolStatus;
  }
  if (active && remaining > 0n && expiryTimeMs > Date.now()) return "active";
  if (remaining === 0n) return "depleted";
  if (expiryTimeMs <= Date.now()) return "expired";
  return "inactive";
}

export function parseGasSponsorPool(
  value: unknown,
  requestedId?: string | number,
  walletHash = "",
): GasSponsorPool {
  const raw = gasSponsorRecord(value);
  const id = gasSponsorUnsigned(raw.id, "pool id").toString();
  if (id === "0" || (requestedId !== undefined && id !== gasSponsorUnsigned(requestedId, "requested pool id").toString())) {
    throw new Error("Gas Sponsor pool id mismatch.");
  }
  const sponsor = parseGasSponsorChainAccount(raw.sponsor);
  if (!sponsor) throw new Error("Invalid pool sponsor.");
  const poolType = gasSponsorSafeInteger(raw.poolType, "pool type");
  if (poolType < 1 || poolType > 2) throw new Error("Invalid pool type.");
  const initial = gasSponsorUnsigned(raw.initialAmount, "initial amount");
  const remaining = gasSponsorUnsigned(raw.remainingAmount, "remaining amount");
  const maxClaim = gasSponsorUnsigned(raw.maxClaimPerUser, "maximum claim");
  const totalClaimed = gasSponsorUnsigned(raw.totalClaimed, "total claimed");
  if (initial <= 0n || maxClaim <= 0n || maxClaim > initial || remaining > initial) {
    throw new Error("Invalid pool balances.");
  }
  const claimCount = gasSponsorSafeInteger(raw.claimCount, "claim count");
  const createTimeMs = gasSponsorSafeInteger(raw.createTime, "create time");
  const expiryTimeMs = gasSponsorSafeInteger(raw.expiryTime, "expiry time");
  if (createTimeMs <= 0 || expiryTimeMs < createTimeMs) throw new Error("Invalid pool lifetime.");
  const active = exactBoolean(raw.active, "pool active flag");
  const description = clean(raw.description);
  if (description.length > 512) throw new Error("Invalid pool description.");
  return {
    id,
    sponsor,
    poolType,
    initialAmountRaw: initial.toString(),
    remainingAmountRaw: remaining.toString(),
    maxClaimPerUserRaw: maxClaim.toString(),
    totalClaimedRaw: totalClaimed.toString(),
    claimCount,
    createTimeMs,
    expiryTimeMs,
    active,
    description,
    status: poolStatus(raw.status, active, remaining, expiryTimeMs),
    isMine: Boolean(walletHash) && gasSponsorAccountsMatch(sponsor, walletHash),
  };
}

export function parseGasSponsorPlatformStats(value: unknown, nowMs = Date.now()): GasSponsorPlatformStats {
  const raw = gasSponsorRecord(value);
  const totalPools = gasSponsorSafeInteger(raw.totalPools, "total pools");
  const activePools = gasSponsorSafeInteger(raw.activePools, "active pools");
  const totalSponsored = gasSponsorUnsigned(raw.totalSponsored, "total sponsored");
  const totalClaimed = gasSponsorUnsigned(raw.totalClaimed, "total claimed");
  const totalSponsors = gasSponsorSafeInteger(raw.totalSponsors, "total sponsors");
  const totalBeneficiaries = gasSponsorSafeInteger(raw.totalBeneficiaries, "total beneficiaries");
  const minSponsorship = gasSponsorUnsigned(raw.minSponsorship, "minimum sponsorship");
  const maxClaimPerTx = gasSponsorUnsigned(raw.maxClaimPerTx, "maximum claim per transaction");
  const defaultExpiryMs = gasSponsorSafeInteger(raw.defaultExpirySeconds, "default expiry");
  const topUpMin = gasSponsorUnsigned(raw.topUpMin, "minimum top up");
  const maxWhitelistSize = gasSponsorSafeInteger(raw.maxWhitelistSize, "maximum whitelist size");
  if (
    activePools > totalPools
    || totalClaimed > totalSponsored
    || minSponsorship <= 0n
    || maxClaimPerTx <= 0n
    || maxClaimPerTx > minSponsorship
    || defaultExpiryMs <= 0
    || topUpMin <= 0n
    || maxWhitelistSize <= 0
  ) {
    throw new Error("Invalid Gas Sponsor platform statistics.");
  }
  return {
    totalPools,
    activePools,
    totalSponsoredRaw: totalSponsored.toString(),
    totalClaimedRaw: totalClaimed.toString(),
    totalSponsors,
    totalBeneficiaries,
    minSponsorshipRaw: minSponsorship.toString(),
    maxClaimPerTxRaw: maxClaimPerTx.toString(),
    defaultExpiryMs,
    topUpMinRaw: topUpMin.toString(),
    maxWhitelistSize,
    loadedAtMs: nowMs,
  };
}

function explicitNetwork(value: unknown): NeoNetwork | "" {
  const raw = clean(value).toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet") return "testnet";
  return "";
}

export function gasSponsorReadContext(
  app: MiniAppFramework,
  requestedNetwork?: string | null,
): GasSponsorChainContext {
  const network = explicitNetwork(requestedNetwork)
    || explicitNetwork(app.platform.launch.network)
    || resolveNeoNetwork(requestedNetwork);
  const contractHash = normalizeGasSponsorAccount(getMiniAppContractHash(GAS_SPONSOR_APP_ID, network));
  const configured = normalizeGasSponsorAccount(app.chain.contractAddress.get());
  if (!contractHash || (configured && configured !== contractHash)) {
    throw new Error("gasSponsorChainContextMismatch");
  }
  return { network, contractHash, gasHash: GAS_HASH.toLowerCase() };
}

export async function requireWritableGasSponsorContext(
  app: MiniAppFramework,
  requestedNetwork?: string | null,
): Promise<GasSponsorChainContext> {
  const context = gasSponsorReadContext(app, requestedNetwork);
  let detected: NeoNetwork | "" = "";
  try {
    detected = explicitNetwork(await app.chain.detectNetwork());
  } catch {
    throw new Error("gasSponsorWalletNetworkUnknown");
  }
  if (!detected || detected !== context.network) throw new Error("gasSponsorWalletNetworkMismatch");
  return context;
}

export function normalizeGasSponsorTxid(value: unknown): string {
  const txid = clean(value).toLowerCase();
  return TXID.test(txid) ? txid : "";
}

export function isPendingGasSponsorOperation(value: unknown): value is PendingGasSponsorOperation {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const row = value as Partial<PendingGasSponsorOperation>;
    const kind = row.kind;
    const phase = row.phase;
    if (
      row.version !== 2
      || !["create", "claim", "topUp", "withdraw", "extend"].includes(String(kind))
      || !["payment-broadcast", "payment-confirmed", "target-broadcast"].includes(String(phase))
      || !explicitNetwork(row.network)
      || !normalizeGasSponsorAccount(row.contractHash)
      || normalizeGasSponsorAccount(row.gasHash) !== GAS_HASH.toLowerCase()
      || !normalizeGasSponsorAccount(row.walletHash)
      || !Number.isFinite(row.createdAtMs)
      || Number(row.createdAtMs) <= 0
      || !Number.isSafeInteger(row.baselinePoolCount)
      || Number(row.baselinePoolCount) < 0
    ) return false;
    if ((phase === "payment-broadcast" || phase === "payment-confirmed") && !normalizeGasSponsorTxid(row.paymentTxid)) return false;
    if (phase === "target-broadcast" && !normalizeGasSponsorTxid(row.txid)) return false;
    if ((phase === "payment-broadcast" || phase === "payment-confirmed") && kind !== "create" && kind !== "topUp") return false;
    if (kind !== "create" && (!row.poolId || gasSponsorUnsigned(row.poolId) <= 0n)) return false;
    if ((kind === "create" || kind === "claim" || kind === "topUp") && (!row.amountRaw || gasSponsorUnsigned(row.amountRaw) <= 0n)) {
      return false;
    }
    if (kind === "create") {
      if (!row.maxClaimRaw || gasSponsorUnsigned(row.maxClaimRaw) <= 0n) return false;
      if (clean(row.description).length > GAS_SPONSOR_DESCRIPTION_MAX_LENGTH) return false;
    }
    if (kind === "extend" && (!Number.isSafeInteger(row.newExpiryMs) || Number(row.newExpiryMs) <= 0)) return false;
    for (const raw of [
      row.baselineInitialRaw,
      row.baselineRemainingRaw,
      row.baselineClaimedRaw,
      row.baselineUserClaimedRaw,
    ]) {
      if (raw !== undefined && !/^\d+$/.test(clean(raw))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function parseNotification(value: unknown): GasSponsorNotification | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as { contract?: unknown; eventname?: unknown; event_name?: unknown; state?: unknown };
  const contract = normalizeGasSponsorAccount(row.contract);
  const eventName = clean(row.eventname ?? row.event_name);
  const rawState = row.state && typeof row.state === "object" && !Array.isArray(row.state) && "value" in row.state
    ? (row.state as { value?: unknown }).value
    : row.state;
  if (!contract || !eventName || !Array.isArray(rawState)) return null;
  return { contract, eventName, state: rawState.map(parseStackItem) };
}

export async function readGasSponsorTransactionOutcome(
  network: NeoNetwork,
  txid: string,
): Promise<GasSponsorTransactionOutcome> {
  const normalizedTxid = normalizeGasSponsorTxid(txid);
  if (!normalizedTxid) return { state: "unknown", notifications: [] };
  try {
    const response = await fetchWithTimeout(getRpcUrl(network), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getapplicationlog",
        params: [normalizedTxid],
      }),
      timeoutMs: 8_000,
    });
    if (!response.ok) return { state: "unknown", notifications: [] };
    const payload = await response.json() as {
      error?: unknown;
      result?: { executions?: Array<{ vmstate?: unknown; state?: unknown; notifications?: unknown[] }> };
    };
    if (payload.error || !Array.isArray(payload.result?.executions) || payload.result.executions.length === 0) {
      return { state: "unknown", notifications: [] };
    }
    const executions = payload.result.executions;
    const states = executions.map((entry) => clean(entry.vmstate ?? entry.state).toUpperCase());
    const state = states.some((entry) => entry.includes("FAULT"))
      ? "fault"
      : states.every((entry) => entry.includes("HALT"))
        ? "halt"
        : "unknown";
    return {
      state,
      notifications: executions.flatMap((execution) =>
        (execution.notifications ?? []).map(parseNotification).filter((entry): entry is GasSponsorNotification => Boolean(entry))),
    };
  } catch {
    return { state: "unknown", notifications: [] };
  }
}

export function gasSponsorNotificationValue(notification: GasSponsorNotification, index: number): unknown {
  return notification.state[index];
}

export function findGasSponsorNotification(
  outcome: GasSponsorTransactionOutcome,
  contract: string,
  eventName: string,
): GasSponsorNotification | null {
  return outcome.notifications.find((entry) =>
    entry.eventName === eventName && gasSponsorAccountsMatch(entry.contract, contract)) ?? null;
}

export async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, values.length || 1)) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(values[index]!, index);
    }
  });
  await Promise.all(runners);
  return output;
}
