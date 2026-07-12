/**
 * sessionKeyDecode.ts — decode the SessionKeyVerifier `getSessionKey` struct
 * and `getSpentAmount` integer into labeled, human-readable fields so the owner
 * can verify the on-chain truth of what they delegated (target contract, allowed
 * method, expiry, spending limit, and spend so far) instead of reading raw JSON.
 *
 * The on-chain SessionKeyData struct serializes, in order:
 *   [PubKey: ByteString, TargetContract: UInt160, Method: string,
 *    ValidUntil: BigInteger (ms epoch), SpendingLimit?: BigInteger]
 *
 * Mainnet exposes the fifth spending-limit field. The frozen testnet verifier
 * is the older four-field implementation, so callers must explicitly choose
 * whether allowance support is expected instead of inventing a zero limit.
 * `chain.read` parses a Struct into a positional array (see shared parseStackItem),
 * so we read by index. All parsing is defensive — any missing/odd field degrades
 * gracefully rather than throwing.
 */

import { parseHash160, parseStackItem } from "@shared/utils/neo";

const GAS_DECIMALS = 8;

/** Format a GAS base-unit (1e8) integer string/number into a decimal GAS string. */
export function formatGasBaseUnits(raw: unknown): string {
  let digits: string;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    digits = BigInt(Math.trunc(raw)).toString();
  } else if (typeof raw === "string" && /^-?\d+$/.test(raw.trim())) {
    digits = raw.trim();
  } else if (typeof raw === "bigint") {
    digits = raw.toString();
  } else {
    return "0";
  }
  const negative = digits.startsWith("-");
  const abs = negative ? digits.slice(1) : digits;
  const padded = abs.padStart(GAS_DECIMALS + 1, "0");
  const whole = padded.slice(0, padded.length - GAS_DECIMALS);
  const frac = padded.slice(padded.length - GAS_DECIMALS).replace(/0+$/, "");
  const body = frac ? `${whole}.${frac}` : whole;
  return negative ? `-${body}` : body;
}

export interface DecodedSessionKey {
  pubKey: string;
  targetContract: string;
  method: string;
  /** Expiry as a Unix-seconds epoch (the struct stores ms), 0 when unknown. */
  expirySeconds: number;
  /** Localized expiry date string, or "" when unknown. */
  expiryDisplay: string;
  /** Spending limit in GAS (decimal string); "0" means unlimited. */
  spendingLimitGas: string;
  spendingLimitUnlimited: boolean;
  spendingLimitSupported: boolean;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function rawStructItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const typed = value && typeof value === "object"
    ? value as { type?: unknown; value?: unknown }
    : null;
  if (
    typed &&
    (typed.type === "Struct" || typed.type === "Array") &&
    Array.isArray(typed.value)
  ) {
    return typed.value;
  }
  return [];
}

function normalizedPublicKey(value: unknown): string {
  const parsed = clean(parseStackItem(value)).replace(/^0x/i, "").toLowerCase();
  return /^(02|03)[0-9a-f]{64}$/.test(parsed) ? parsed : "";
}

function normalizedTarget(value: unknown): string {
  const parsed = parseHash160(value).toLowerCase();
  if (/^0x[0-9a-f]{40}$/.test(parsed)) return parsed;
  const direct = clean(parseStackItem(value)).toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(direct) ? direct : "";
}

function integerString(value: unknown): string {
  const parsed = parseStackItem(value);
  if (typeof parsed === "number" && Number.isSafeInteger(parsed)) return String(parsed);
  if (typeof parsed === "bigint") return parsed.toString();
  const direct = clean(parsed);
  return /^-?\d+$/.test(direct) ? direct : "";
}

/**
 * Decode a parsed `getSessionKey` result (an array/struct) into labeled fields.
 * Returns null when the input is not a populated struct.
 */
export function decodeSessionKey(
  read: unknown,
  options: { spendingLimitSupported?: boolean } = {},
): DecodedSessionKey | null {
  const raw = rawStructItems(read);
  const parsed = parseStackItem(read);
  const fields = Array.isArray(parsed) ? parsed : [];
  if (raw.length < 4 || fields.length < 4) return null;

  const pubKey = normalizedPublicKey(raw[0]);
  const targetContract = normalizedTarget(raw[1]);
  const method = clean(fields[2]);
  const validUntilRaw = integerString(raw[3]);
  const spendingLimitSupported = options.spendingLimitSupported ?? raw.length >= 5;

  if (!pubKey || !targetContract || !validUntilRaw) return null;

  // ValidUntil is stored as a millisecond epoch (Runtime.Time is ms on Neo N3).
  const validUntil = Number(validUntilRaw);
  if (!Number.isSafeInteger(validUntil) || validUntil <= 0) return null;
  // Runtime.Time is milliseconds. Accepting a seconds fixture as well keeps
  // old deployed/test data readable without changing the write path, which
  // always submits milliseconds.
  const expirySeconds = validUntil >= 100_000_000_000
    ? Math.floor(validUntil / 1000)
    : validUntil;
  const expiryDisplay =
    expirySeconds > 0 ? new Date(expirySeconds * 1000).toLocaleString() : "";

  const spendingLimitRaw = spendingLimitSupported ? integerString(raw[4]) : "";
  if (spendingLimitSupported && !spendingLimitRaw) return null;
  const spendingLimitGas = spendingLimitSupported
    ? formatGasBaseUnits(spendingLimitRaw)
    : "";
  const spendingLimitUnlimited = spendingLimitSupported && spendingLimitGas === "0";

  return {
    pubKey,
    targetContract,
    method,
    expirySeconds,
    expiryDisplay,
    spendingLimitGas,
    spendingLimitUnlimited,
    spendingLimitSupported,
  };
}
