/**
 * sessionKeyDecode.ts — decode the SessionKeyVerifier `getSessionKey` struct
 * and `getSpentAmount` integer into labeled, human-readable fields so the owner
 * can verify the on-chain truth of what they delegated (target contract, allowed
 * method, expiry, spending limit, and spend so far) instead of reading raw JSON.
 *
 * The on-chain SessionKeyData struct (frozen contract) serializes, in order:
 *   [PubKey: ByteString, TargetContract: UInt160, Method: string,
 *    ValidUntil: BigInteger (ms epoch), SpendingLimit: BigInteger (GAS base units)]
 * `chain.read` parses a Struct into a positional array (see shared parseStackItem),
 * so we read by index. All parsing is defensive — any missing/odd field degrades
 * gracefully rather than throwing.
 */

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
}

/**
 * Decode a parsed `getSessionKey` result (an array/struct) into labeled fields.
 * Returns null when the input is not a populated struct.
 */
export function decodeSessionKey(read: unknown): DecodedSessionKey | null {
  if (!Array.isArray(read) || read.length < 5) return null;

  const pubKeyRaw = read[0];
  const targetRaw = read[1];
  const methodRaw = read[2];
  const validUntilRaw = read[3];
  const spendingLimitRaw = read[4];

  const pubKey =
    typeof pubKeyRaw === "string" ? pubKeyRaw.replace(/^0x/i, "") : "";
  const targetContract =
    typeof targetRaw === "string" && targetRaw ? targetRaw : "";
  const method = typeof methodRaw === "string" ? methodRaw : "";

  // ValidUntil is stored as a millisecond epoch (Runtime.Time is ms on Neo N3).
  let validUntilMs = 0;
  if (typeof validUntilRaw === "number" && Number.isFinite(validUntilRaw)) {
    validUntilMs = validUntilRaw;
  } else if (typeof validUntilRaw === "string" && /^\d+$/.test(validUntilRaw)) {
    validUntilMs = Number(validUntilRaw);
  }
  const expirySeconds = validUntilMs > 0 ? Math.floor(validUntilMs / 1000) : 0;
  const expiryDisplay =
    expirySeconds > 0 ? new Date(expirySeconds * 1000).toLocaleString() : "";

  const spendingLimitGas = formatGasBaseUnits(spendingLimitRaw);
  const spendingLimitUnlimited = spendingLimitGas === "0";

  return {
    pubKey,
    targetContract,
    method,
    expirySeconds,
    expiryDisplay,
    spendingLimitGas,
    spendingLimitUnlimited,
  };
}
