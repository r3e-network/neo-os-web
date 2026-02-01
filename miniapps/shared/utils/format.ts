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
  } catch {
    return num.toFixed(decimals);
  }
}

/**
 * Format GAS amount from raw units (1 GAS = 100000000 = 1e8)
 * Handles bigint, number, or string input
 */
export function formatGas(
  amount: bigint | number | string,
  decimals = 4,
): string {
  const value = typeof amount === "bigint" ? amount : BigInt(amount || 0);
  const divisor = BigInt(100000000);
  const whole = value / divisor;
  const fraction = value % divisor;

  if (fraction === BigInt(0)) {
    return whole.toString();
  }

  const fractionStr = fraction.toString().padStart(8, "0");
  const trimmed = fractionStr.slice(0, decimals).replace(/0+$/, "");

  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

/**
 * Format a Fixed8 value (8 decimal places) for display
 * Convenience wrapper for formatGas
 */
export function formatFixed8(
  value: bigint | number | string,
  decimals = 4,
): string {
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
export function toFixedDecimals(
  value: string | number,
  decimals: number,
): string {
  if (!Number.isFinite(decimals) || decimals < 0) return "0";
  const raw = typeof value === "number" ? String(value) : String(value);
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
 * Convert human-readable value to Fixed8 format string (multiply by 1e8)
 * Used for blockchain transaction arguments
 */
export function toFixed8(value: string | number): string {
  return toFixedDecimals(value, 8);
}

export function formatAddress(address?: string, head = 6, tail = 4): string {
  const value = (address ?? "").trim();
  if (!value) return "--";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function formatCountdown(targetSeconds: number): string {
  if (!Number.isFinite(targetSeconds)) return "--";
  const targetMs = targetSeconds > 1e12 ? targetSeconds : targetSeconds * 1000;
  const diff = Math.max(0, targetMs - Date.now());
  if (diff <= 0) return "Ended";

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
  const normalized = cleaned.length % 2 === 0 ? cleaned : `0${cleaned}`;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomIntFromBytes(bytes: Uint8Array, max?: number): number {
  if (!bytes.length) return 0;
  let value = 0n;
  for (const byte of bytes) {
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
 * Format a hash or address for display (truncate middle)
 */
export function formatHash(hash: string, head = 6, tail = 4): string {
  const value = String(hash || "").trim();
  if (!value) return "";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

/**
 * Sleep/delay utility - returns a promise that resolves after ms milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimTrailingZero(value: string): string {
  return value.replace(/\.0$/, "");
}

/**
 * Format a large number to compact form (K, M, B)
 * e.g., 1500000 -> "1.5M"
 */
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return "--";
  const absValue = Math.abs(value);
  const format = (num: number, unit: string) => `${trimTrailingZero(num.toFixed(1))}${unit}`;

  if (absValue >= 1_000_000_000) return format(value / 1_000_000_000, "B");
  if (absValue >= 1_000_000) return format(value / 1_000_000, "M");
  if (absValue >= 1_000) return format(value / 1_000, "K");
  return trimTrailingZero(value.toFixed(0));
}
