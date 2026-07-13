const MAX_AMOUNT_DIGITS = 40;
const PRICE_DECIMALS = 6;
const BPS_DENOMINATOR = 10_000n;

function decimalScale(decimals: number): bigint {
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("Unsupported token precision");
  }
  return 10n ** BigInt(decimals);
}

/**
 * Parse a user-entered decimal into exact token base units.
 *
 * Scientific notation, signs, separators, excess precision and pathologically
 * long values are rejected rather than rounded. The bounded digit count keeps
 * hostile dispatch payloads from turning a quote calculation into unbounded
 * BigInt work.
 */
export function parseDecimalUnits(
  raw: string,
  decimals: number,
  options: { allowZero?: boolean } = {},
): bigint | null {
  const text = String(raw ?? "").trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return null;

  const whole = match[1] ?? "";
  const fraction = match[2] ?? "";
  if (whole.length + fraction.length > MAX_AMOUNT_DIGITS || fraction.length > decimals) {
    return null;
  }

  const units = BigInt(whole) * decimalScale(decimals)
    + BigInt(fraction.padEnd(decimals, "0") || "0");
  if (!options.allowZero && units <= 0n) return null;
  return units;
}

/** Exact base units to a trimmed decimal string. */
export function formatUnits(units: bigint, decimals: number): string {
  const negative = units < 0n;
  const magnitude = negative ? -units : units;
  if (decimals === 0) return `${negative ? "-" : ""}${magnitude.toString()}`;

  const scale = decimalScale(decimals);
  const whole = magnitude / scale;
  const fraction = (magnitude % scale)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  const value = fraction ? `${whole}.${fraction}` : whole.toString();
  return negative ? `-${value}` : value;
}

/**
 * The shared Morpheus reader exposes a number descaled from the contract's
 * fixed-six integer. Reconstitute that fixed-six value immediately, then keep
 * every downstream quote calculation in BigInt.
 */
export function morpheusPriceUnits(price: number): bigint | null {
  if (!Number.isFinite(price) || price <= 0 || price > 1_000_000_000_000) return null;
  const fixed = price.toFixed(PRICE_DECIMALS);
  return parseDecimalUnits(fixed, PRICE_DECIMALS);
}

/** Six-decimal display cross-rate, floored from two exact fixed-six legs. */
export function formatPriceRatio(
  fromPriceUnits: bigint,
  toPriceUnits: bigint,
  displayDecimals = PRICE_DECIMALS,
): string {
  if (fromPriceUnits <= 0n || toPriceUnits <= 0n) return "";
  const scaled = (fromPriceUnits * decimalScale(displayDecimals)) / toPriceUnits;
  return formatUnits(scaled, displayDecimals);
}

/**
 * Quote an output directly in receiving-token base units. This avoids routing
 * the trade intent through a rounded display rate or JavaScript floating point.
 */
export function quoteOutputUnits(
  amountInUnits: bigint,
  fromDecimals: number,
  toDecimals: number,
  fromPriceUnits: bigint,
  toPriceUnits: bigint,
): bigint {
  if (amountInUnits <= 0n || fromPriceUnits <= 0n || toPriceUnits <= 0n) return 0n;
  const numerator = amountInUnits * fromPriceUnits * decimalScale(toDecimals);
  const denominator = decimalScale(fromDecimals) * toPriceUnits;
  return numerator / denominator;
}

export function applySlippageFloor(outputUnits: bigint, slippageBps: number): bigint {
  if (outputUnits <= 0n || !Number.isSafeInteger(slippageBps)) return 0n;
  const bounded = Math.min(9_999, Math.max(0, slippageBps));
  return (outputUnits * (BPS_DENOMINATOR - BigInt(bounded))) / BPS_DENOMINATOR;
}

/** Parse an exact percentage into basis points (0.5 -> 50), then clamp. */
export function parseSlippageBps(
  value: string | number,
  minimumBps: number,
  maximumBps: number,
): number | null {
  const text = String(value).trim().replace(/%$/, "");
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const whole = BigInt(match[1] ?? "0");
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  const rawBps = whole * 100n + fraction;
  const bounded = rawBps < BigInt(minimumBps)
    ? BigInt(minimumBps)
    : rawBps > BigInt(maximumBps)
      ? BigInt(maximumBps)
      : rawBps;
  return Number(bounded);
}

export function formatSlippageBps(bps: number): string {
  if (!Number.isSafeInteger(bps) || bps < 0) return "";
  const whole = Math.floor(bps / 100);
  const fraction = String(bps % 100).padStart(2, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}%`;
}

export function safeUnits(raw: string): bigint {
  return /^\d{1,80}$/.test(raw) ? BigInt(raw) : 0n;
}
