/**
 * Neo Multisig — on-chain custody vault operations.
 *
 * Pure helpers for the MiniAppMultisig v2 custody-vault contract
 * (hash 0xa361cdc792e97c4d8ddf42048cf48f3283ea7178 on neo-n3-testnet AND
 * neo-n3-mainnet, resolved through the app manifest as the app's primary
 * contract).
 *
 * The vault model is fully on-chain:
 *   1. createVault(creator, signers[], threshold) -> vaultId
 *   2. deposit  = NEP-17 transfer of GAS/NEO to the contract with the vaultId
 *      passed as the transfer `data`; OnNEP17Payment credits the vault.
 *   3. createRequest(vaultId, creator, recipient, asset, amount, memo) -> reqId
 *   4. approve(reqId, signer) — at threshold the contract releases the funds.
 *      If the vault balance no longer covers the request at threshold time,
 *      the contract auto-cancels it and emits
 *      RequestUnfunded(requestId, required, available) (v2).
 *   5. cancel(reqId, caller) — ANY vault signer may cancel a pending request
 *      (v2; previously creator-only).
 *
 * Amounts are contract BASE UNITS: GAS uses 1e8 (1 GAS = 100_000_000),
 * NEO is indivisible (1 = 1 NEO, no scaling). These helpers build the
 * ContractArg arrays and parse the contract reads into plain JS shapes;
 * all chain I/O lives in services/api.ts.
 */

import { eventValue } from "@shared/utils/chain-events";
import { addressToScriptHash } from "@shared/utils/neo";

export const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
export const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

/** Contract-enforced bounds for the signer set. */
export const MIN_SIGNERS = 2;
export const MAX_SIGNERS = 16;

const GAS_DECIMALS = 8;
const GAS_FACTOR = 100_000_000n;

export type VaultAsset = "GAS" | "NEO";

/** Parsed shape of getVault(vaultId). */
export interface VaultView {
  id: number;
  creator: string;
  threshold: number;
  signers: string[];
  createdTime: number;
  neoBalance: string;
  gasBalance: string;
}

/** Request lifecycle status as stored on-chain. */
export type RequestStatus = "pending" | "executed" | "cancelled";

/** Parsed shape of getRequest(reqId). */
export interface RequestView {
  id: number;
  vaultId: number;
  creator: string;
  recipient: string;
  asset: string;
  assetSymbol: VaultAsset;
  amount: string;
  approvalCount: number;
  status: RequestStatus;
  createdTime: number;
  memo: string;
}

export type ContractArg = {
  type: "Hash160" | "Integer" | "Array" | "String";
  value: string | ContractArg[];
};

// ---------------------------------------------------------------------------
// Address / Hash160 helpers
// ---------------------------------------------------------------------------

/** Strict Neo N3 address check (signers are ADDRESSES, never public keys). */
export function isValidAddress(address: unknown): boolean {
  if (typeof address !== "string") return false;
  const trimmed = address.trim();
  if (!/^N[A-Za-z0-9]{33}$/.test(trimmed)) return false;
  // The address must decode to a 20-byte script hash, otherwise it is malformed
  // even when it superficially matches the N-prefixed shape.
  return /^0x[0-9a-fA-F]{40}$/.test(addressToScriptHash(trimmed));
}

/**
 * Convert a Neo N3 address (or an existing 0x Hash160) into a 0x-prefixed
 * little-endian script hash suitable for a Hash160 ContractArg.
 */
export function toHash160(value: unknown, label = "Address"): string {
  const raw = String(value ?? "").trim();
  if (/^(0x)?[0-9a-fA-F]{40}$/.test(raw)) {
    const normalized = raw.startsWith("0x") ? raw.toLowerCase() : `0x${raw.toLowerCase()}`;
    if (!/^0x0{40}$/.test(normalized)) return normalized;
  }
  const converted = addressToScriptHash(raw);
  if (/^0x[0-9a-fA-F]{40}$/.test(converted)) return converted;
  throw new Error(`${label} must be a valid Neo N3 address.`);
}

// ---------------------------------------------------------------------------
// Amount helpers (BASE UNITS — no wrong pre-scaling)
// ---------------------------------------------------------------------------

/**
 * Validate a human-entered amount for the given asset.
 * GAS allows up to 8 decimals; NEO must be a positive whole number.
 */
export function isValidAmount(amount: unknown, asset: VaultAsset): boolean {
  const raw = String(amount ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return false;
  const [, fraction = ""] = raw.split(".");
  if (asset === "NEO" && fraction.length > 0) return false;
  if (asset === "GAS" && fraction.length > GAS_DECIMALS) return false;
  return BigInt(toBaseUnits(raw, asset)) > 0n;
}

/**
 * Convert a human amount string to the contract's BASE UNITS as a decimal
 * string. GAS scales by 1e8; NEO passes through as an integer (no scaling).
 *
 * @throws when the value is not a well-formed positive amount for the asset.
 */
export function toBaseUnits(amount: unknown, asset: VaultAsset): string {
  const raw = String(amount ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) {
    throw new Error("Amount must be a positive number.");
  }

  if (asset === "NEO") {
    if (raw.includes(".")) {
      throw new Error("NEO transfers must use whole token amounts.");
    }
    const whole = raw.replace(/^0+(?=\d)/, "") || "0";
    return whole;
  }

  const [wholeRaw = "0", fractionRaw = ""] = raw.split(".");
  if (fractionRaw.length > GAS_DECIMALS) {
    throw new Error(`GAS supports at most ${GAS_DECIMALS} decimal places.`);
  }
  const fraction = fractionRaw.padEnd(GAS_DECIMALS, "0");
  const scaled = `${wholeRaw}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
  return scaled;
}

/** Format BASE UNITS back to a human string (GAS divides by 1e8, NEO as-is). */
export function fromBaseUnits(
  baseUnits: number | string | bigint,
  asset: VaultAsset,
): string {
  let value = 0n;
  try {
    value = typeof baseUnits === "bigint" ? baseUnits : BigInt(String(baseUnits).trim() || "0");
  } catch {
    return "0";
  }
  if (asset === "NEO") return value.toString();

  const whole = value / GAS_FACTOR;
  const fraction = (value % GAS_FACTOR)
    .toString()
    .padStart(GAS_DECIMALS, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/** Resolve the NEP-17 contract hash for an asset. */
export function assetHash(asset: VaultAsset): string {
  return asset === "NEO" ? NEO_HASH : GAS_HASH;
}

/** Map a stored asset Hash160 to its symbol (GAS / NEO / UNKNOWN). */
export function assetSymbol(hash: unknown): VaultAsset | "UNKNOWN" {
  const raw = String(hash ?? "").trim().toLowerCase();
  const normalized = /^[0-9a-f]{40}$/.test(raw) ? `0x${raw}` : raw;
  if (normalized === GAS_HASH) return "GAS";
  if (normalized === NEO_HASH) return "NEO";
  return "UNKNOWN";
}

// ---------------------------------------------------------------------------
// Signer-set validation
// ---------------------------------------------------------------------------

export interface SignerSet {
  signers: string[];
  threshold: number;
}

/** Canonical policy order used for deterministic creation and readback. */
export function canonicalSignerHashes(signers: string[]): string[] {
  return signers.map((signer) => addressToScriptHash(signer)).sort((a, b) => a.localeCompare(b));
}

/**
 * Validate and normalize a signer set against the contract's rules:
 * 2..16 distinct valid addresses and 1 <= threshold <= signers.length.
 *
 * @throws with a message key reference resolved by the caller's translator.
 */
export function validateSignerSet(
  rawSigners: unknown[],
  rawThreshold: unknown,
): SignerSet {
  const signers = (Array.isArray(rawSigners) ? rawSigners : [])
    .map((s) => String(s ?? "").trim())
    .filter(Boolean);

  for (const signer of signers) {
    if (!isValidAddress(signer)) {
      throw new Error("Each signer must be a valid Neo N3 address.");
    }
  }

  const unique = new Set(signers);
  if (unique.size !== signers.length) {
    throw new Error("Signer addresses must be distinct.");
  }

  if (signers.length < MIN_SIGNERS || signers.length > MAX_SIGNERS) {
    throw new Error(
      `Provide between ${MIN_SIGNERS} and ${MAX_SIGNERS} signer addresses.`,
    );
  }

  const threshold = Math.floor(Number(rawThreshold));
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > signers.length) {
    throw new Error("Threshold must be between 1 and the number of signers.");
  }

  // The contract treats signer order as semantically irrelevant. Sorting by
  // canonical script hash makes an M-of-N policy deterministic across devices
  // and prevents two visually identical member sets from being encoded in
  // different orders.
  signers.sort((left, right) => addressToScriptHash(left).localeCompare(addressToScriptHash(right)));
  return { signers, threshold };
}

// ---------------------------------------------------------------------------
// ContractArg builders
// ---------------------------------------------------------------------------

/** createVault(creator, signers[], threshold) */
export function buildCreateVaultArgs(
  creator: string,
  set: SignerSet,
): ContractArg[] {
  return [
    { type: "Hash160", value: toHash160(creator, "Creator") },
    {
      type: "Array",
      value: set.signers.map<ContractArg>((signer) => ({
        type: "Hash160",
        value: toHash160(signer, "Signer"),
      })),
    },
    { type: "Integer", value: String(set.threshold) },
  ];
}

/**
 * NEP-17 deposit transfer args: transfer(from, CONTRACT, amount, vaultId).
 * Pass `contractHash` (the resolved app contract) so the vaultId lands in the
 * transfer `data` and OnNEP17Payment credits the right vault. The invoke must
 * target the token contract via opts.scriptHash = assetHash(asset).
 */
export function buildDepositArgs(params: {
  from: string;
  contractHash: string;
  vaultId: number;
  amount: string;
  asset: VaultAsset;
}): ContractArg[] {
  return [
    { type: "Hash160", value: toHash160(params.from, "Sender") },
    { type: "Hash160", value: toHash160(params.contractHash, "Contract") },
    { type: "Integer", value: toBaseUnits(params.amount, params.asset) },
    { type: "Integer", value: String(params.vaultId) },
  ];
}

/** createRequest(vaultId, creator, recipient, asset, amount, memo) */
export function buildCreateRequestArgs(params: {
  vaultId: number;
  creator: string;
  recipient: string;
  asset: VaultAsset;
  amount: string;
  memo: string;
}): ContractArg[] {
  return [
    { type: "Integer", value: String(params.vaultId) },
    { type: "Hash160", value: toHash160(params.creator, "Creator") },
    { type: "Hash160", value: toHash160(params.recipient, "Recipient") },
    { type: "Hash160", value: assetHash(params.asset) },
    { type: "Integer", value: toBaseUnits(params.amount, params.asset) },
    { type: "String", value: String(params.memo ?? "").slice(0, 160) },
  ];
}

/** approve(reqId, signer) */
export function buildApproveArgs(reqId: number, signer: string): ContractArg[] {
  return [
    { type: "Integer", value: String(reqId) },
    { type: "Hash160", value: toHash160(signer, "Signer") },
  ];
}

/** cancel(reqId, caller) — caller may be ANY vault signer (v2). */
export function buildCancelArgs(reqId: number, caller: string): ContractArg[] {
  return [
    { type: "Integer", value: String(reqId) },
    { type: "Hash160", value: toHash160(caller, "Caller") },
  ];
}

// ---------------------------------------------------------------------------
// Read-result parsing (getVault / getRequest Maps -> JS shapes)
// ---------------------------------------------------------------------------

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toSafeInteger(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : null;
  if (typeof value === "bigint") {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  if (typeof value !== "string" || !/^-?\d+$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function toBaseString(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  try {
    const parsed = BigInt(raw);
    return parsed >= 0n ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function toStringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

const STATUS_BY_CODE: Record<number, RequestStatus> = {
  0: "pending",
  1: "executed",
  2: "cancelled",
};

/** Map a numeric status code from the contract to its label. */
export function statusFromCode(code: unknown): RequestStatus | null {
  const parsed = toSafeInteger(code);
  return parsed === null ? null : STATUS_BY_CODE[parsed] ?? null;
}

/** Parse a getVault(vaultId) Map read into a VaultView, or null when absent. */
export function parseVault(raw: unknown): VaultView | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  const id = toSafeInteger(data.id);
  const threshold = toSafeInteger(data.threshold);
  const neoBalance = toBaseString(data.neoBalance);
  const gasBalance = toBaseString(data.gasBalance);
  if (id === null || id <= 0 || threshold === null || neoBalance === null || gasBalance === null) return null;

  const signersRaw = Array.isArray(data.signers) ? data.signers : [];
  const signers = signersRaw.map(toStringValue).filter(Boolean);
  const creator = toStringValue(data.creator);
  const validAccount = (value: string) => /^0x[0-9a-fA-F]{40}$/.test(value) || isValidAddress(value);
  if (
    !validAccount(creator) || !signers.every(validAccount) ||
    signers.length < MIN_SIGNERS || signers.length > MAX_SIGNERS ||
    new Set(signers.map((signer) => signer.toLowerCase())).size !== signers.length ||
    !Number.isInteger(threshold) || threshold < 1 || threshold > signers.length
  ) return null;
  return {
    id,
    creator,
    threshold,
    signers,
    createdTime: toNumber(data.createdTime),
    neoBalance,
    gasBalance,
  };
}

/**
 * Parsed RequestUnfunded(requestId, required, available) event payload (v2).
 * Emitted when a threshold approval found the vault balance below the request
 * amount — the contract auto-cancels the request instead of leaving it stuck.
 * Amounts are BASE UNITS of the request's asset.
 */
export interface RequestUnfundedEvent {
  requestId: number;
  required: string;
  available: string;
}

/** Parse a RequestUnfunded event entry, or null when it is not one. */
export function parseRequestUnfundedEvent(
  entry: unknown,
): RequestUnfundedEvent | null {
  const requestId = toSafeInteger(eventValue(entry, 0));
  const required = toBaseString(eventValue(entry, 1));
  const available = toBaseString(eventValue(entry, 2));
  if (requestId === null || requestId <= 0 || required === null || available === null) return null;
  return {
    requestId,
    required,
    available,
  };
}

/** Parse a getRequest(reqId) Map read into a RequestView, or null when absent. */
export function parseRequest(raw: unknown): RequestView | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  const id = toSafeInteger(data.id);
  const vaultId = toSafeInteger(data.vaultId);
  const amount = toBaseString(data.amount);
  const approvalCount = toSafeInteger(data.approvalCount);
  const status = statusFromCode(data.status);
  if (
    id === null || id <= 0 || vaultId === null || vaultId <= 0 ||
    amount === null || BigInt(amount) <= 0n || approvalCount === null || approvalCount < 0 || !status
  ) return null;

  const asset = toStringValue(data.asset);
  const creator = toStringValue(data.creator);
  const recipient = toStringValue(data.recipient);
  const symbol = assetSymbol(asset);
  const validAccount = (value: string) => /^0x[0-9a-fA-F]{40}$/.test(value) || isValidAddress(value);
  if (symbol === "UNKNOWN" || !validAccount(creator) || !validAccount(recipient)) return null;
  return {
    id,
    vaultId,
    creator,
    recipient,
    asset,
    assetSymbol: symbol,
    amount,
    approvalCount,
    status,
    createdTime: toNumber(data.createdTime),
    memo: toStringValue(data.memo),
  };
}
