export function formatNumber(value: number | string, decimals = 2): string {
  const num = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(num)) {
    return "0";
  }
  try {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  } catch (_e) {
    return num.toFixed(decimals);
  }
}

/**
 * Format GAS amount from raw units (1 GAS = 100000000 = 1e8)
 * Handles bigint, number, or string input
 */
export function formatGas(amount: bigint | number | string, decimals = 4): string {
  let value: bigint;
  try {
    value = typeof amount === "bigint" ? amount : BigInt(amount || 0);
  } catch (_e) {
    value = 0n;
  }
  // Reject negative values — modulo on negative bigint is implementation-defined
  if (value < 0n) {
    return "0";
  }
  // Clamp decimals to a safe range to prevent memory issues
  const safeDecimals = Math.min(Math.max(decimals, 0), 80);
  const divisor = BigInt(100000000);
  const whole = value / divisor;
  const fraction = value % divisor;

  if (fraction === BigInt(0)) {
    return whole.toString();
  }

  const fractionStr = fraction.toString().padStart(8, "0");
  const trimmed = fractionStr.slice(0, safeDecimals).replace(/0+$/, "");

  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

/**
 * Format a Fixed8 value (8 decimal places) for display
 * Convenience wrapper for formatGas
 */
export function formatFixed8(value: bigint | number | string, decimals = 4): string {
  return formatGas(value, decimals);
}

/**
 * Parse raw GAS units to decimal number (1 GAS = 100000000 = 1e8)
 * Returns number for calculations, use formatGas for display
 */
export function parseGas(value: bigint | number | string | unknown): number {
  const num = typeof value === "bigint" ? Number(value) : Number(value ?? 0);
  return Number.isFinite(num) ? num / 1e8 : 0;
}

/**
 * Alias for parseGas - convert Fixed8 raw units to decimal number
 */
export function fromFixed8(value: bigint | number | string | unknown): number {
  return parseGas(value);
}

/**
 * Convert human-readable value to fixed decimal integer string.
 * Uses string parsing to avoid floating point rounding.
 */
export function toFixedDecimals(value: string | number, decimals: number): string {
  if (!Number.isFinite(decimals) || decimals < 0 || decimals > 80) return "0";
  // A number is expanded to fixed notation: String(0.0000001) === "1e-7" would
  // fail the digit check below and yield "0"; toFixed avoids the exponent form.
  let raw: string;
  if (typeof value === "number") {
    raw = Number.isFinite(value) ? value.toFixed(decimals) : "0";
  } else {
    raw = String(value);
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("-")) return "0";
  const parts = trimmed.split(".");
  if (parts.length > 2) return "0";
  const whole = parts[0] || "0";
  const frac = parts[1] || "";
  if (!/^\d+$/.test(whole) || (frac && !/^\d+$/.test(frac))) return "0";
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const combined = `${whole}${padded}`.replace(/^0+/, "") || "0";
  return combined;
}

/**
 * Strictly parse a positive human-readable amount to fixed decimal base units.
 * Unlike toFixedDecimals(), this rejects malformed input and over-precision
 * instead of truncating. Use this for transaction amounts.
 */
export function parsePositiveFixedDecimals(
  value: string | number,
  decimals: number,
): string | null {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 80) return null;
  const raw =
    typeof value === "number"
      ? Number.isFinite(value)
        ? value.toString()
        : ""
      : String(value ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;
  const [whole = "0", fractionRaw = ""] = raw.split(".");
  if (fractionRaw.length > decimals) return null;
  try {
    const units =
      BigInt(whole || "0") * 10n ** BigInt(decimals) +
      BigInt((fractionRaw || "").padEnd(decimals, "0") || "0");
    return units > 0n ? units.toString() : null;
  } catch {
    return null;
  }
}

export function parsePositiveFixed8(value: string | number): string | null {
  return parsePositiveFixedDecimals(value, 8);
}

/**
 * Convert human-readable value to Fixed8 format string (multiply by 1e8)
 * Used for blockchain transaction arguments
 */
export function toFixed8(value: string | number): string {
  return toFixedDecimals(value, 8);
}

export function formatAddress(address?: string, head = 6, tail = 4): string {
  const value = (address ?? "").trim();
  if (!value) return "";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function formatCountdown(targetSeconds: number): string {
  if (!Number.isFinite(targetSeconds)) return "";
  const targetMs = targetSeconds > 1e12 ? targetSeconds : targetSeconds * 1000;
  const diff = Math.max(0, targetMs - Date.now());
  if (diff <= 0) return "";

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/^0x/i, "").trim();
  if (!cleaned) return new Uint8Array();
  // Odd-length hex is a malformed byte stream (chain hex — hashes, sigs, txids —
  // is always even-length). Reject rather than left-pad, which would silently
  // shift every nibble. (Matches the internal hexToBytes in neo.ts.)
  if (cleaned.length % 2 !== 0) return new Uint8Array();
  if (!/^[0-9a-fA-F]*$/.test(cleaned)) return new Uint8Array();
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomIntFromBytes(bytes: Uint8Array, max?: number): number {
  if (!bytes.length) return 0;
  // Limit bytes to prevent value from exceeding safe integer range before modulo
  const safeBytes = bytes.slice(0, 7);
  let value = 0n;
  for (const byte of safeBytes) {
    value = (value << 8n) + BigInt(byte);
  }
  const safeMax = BigInt(Number.MAX_SAFE_INTEGER);
  const safeValue = value % safeMax;
  if (typeof max === "number" && Number.isFinite(max) && max > 0) {
    return Number(safeValue % BigInt(Math.floor(max)));
  }
  return Number(safeValue);
}

/**
 * Format a hash or address for display (truncate middle).
 * Alias of {@link formatAddress}; kept as a distinct export for call-site clarity.
 */
export function formatHash(hash: string, head = 6, tail = 4): string {
  return formatAddress(hash, head, tail);
}

/**
 * Sleep/delay utility - returns a promise that resolves after ms milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely convert an unknown value to a finite number, defaulting to 0.
 * Handles null, undefined, non-numeric strings, NaN, and Infinity.
 */
export function toSafeNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function trimTrailingZero(value: string): string {
  return value.replace(/\.0$/, "");
}

/**
 * Format a large number to compact form (K, M, B)
 * e.g., 1500000 -> "1.5M"
 */
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  const absValue = Math.abs(value);
  const format = (num: number, unit: string) => `${trimTrailingZero(num.toFixed(1))}${unit}`;

  if (absValue >= 1_000_000_000) return format(value / 1_000_000_000, "B");
  if (absValue >= 1_000_000) return format(value / 1_000_000, "M");
  if (absValue >= 1_000) return format(value / 1_000, "K");
  return trimTrailingZero(value.toFixed(0));
}

/**
 * Shorthand number formatter used across miniapp UIs.
 * Equivalent to `formatNumber(value, decimals)` — extracted because
 * most miniapps define a local `const formatNum = (n) => formatNumber(n, 2)`.
 */
export function formatNum(value: number | string, decimals = 2): string {
  return formatNumber(value, decimals);
}

/**
 * Format a number as currency with symbol.
 * Defaults to GAS display convention used across the platform.
 *
 * @example
 * formatCurrency(1.5)        // "1.50 GAS"
 * formatCurrency(1000, "NEO", 0) // "1,000 NEO"
 */
export function formatCurrency(value: number | string, symbol = "GAS", decimals = 2): string {
  return `${formatNumber(value, decimals)} ${symbol}`;
}

/** Em-dash placeholder shown for a stat whose data has not loaded yet. */
export const STAT_PLACEHOLDER = "—";

/**
 * Render a stat value with a consistent loaded/not-loaded convention so sibling
 * apps stop diverging (one showing real `0.00` while another shows `—` for the
 * same not-yet-loaded state). The em-dash means "data not loaded"; once loaded,
 * the real value is shown — including a genuine `0`/`0.00`.
 *
 * Pass `loaded=false` while hydrating to render the placeholder; pass `true`
 * once the value is real. A pre-formatted string is returned verbatim when
 * loaded; numbers are run through `formatNumber(value, decimals)`.
 *
 * @example
 * formatStat(0, true)              // "0.00"   (loaded zero is real)
 * formatStat(0, false)             // "—"      (not loaded yet)
 * formatStat(12.5, true)           // "12.50"
 * formatStat("0.7 GAS", true)      // "0.7 GAS" (already-formatted string)
 * formatStat(undefined, false)     // "—"
 */
export function formatStat(
  value: number | string | null | undefined,
  loaded: boolean,
  decimals = 2,
): string {
  if (!loaded) return STAT_PLACEHOLDER;
  if (value == null) return STAT_PLACEHOLDER;
  if (typeof value === "string") return value;
  return formatNumber(value, decimals);
}
