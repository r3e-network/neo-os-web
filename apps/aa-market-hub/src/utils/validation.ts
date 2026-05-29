export const HASH160_PATTERN = /^(0x)?[0-9a-fA-F]{40}$/;
export const NEO_ADDRESS_PATTERN = /^N[1-9A-HJ-NP-Za-km-z]{33}$/;

export const MIN_MARKET_PRICE_FRACTIONS = 1_000_000n;
export const MAX_MARKET_PRICE_FRACTIONS = 100_000_000_000n;

export function isHash160(value: unknown): boolean {
  return HASH160_PATTERN.test(String(value ?? "").trim());
}

export function isOptionalHash160(value: unknown): boolean {
  const trimmed = String(value ?? "").trim();
  return !trimmed || isHash160(trimmed);
}

export function isHash160OrNeoAddress(value: unknown): boolean {
  const trimmed = String(value ?? "").trim();
  return isHash160(trimmed) || NEO_ADDRESS_PATTERN.test(trimmed);
}

export function isOptionalHash160OrNeoAddress(value: unknown): boolean {
  const trimmed = String(value ?? "").trim();
  return !trimmed || isHash160OrNeoAddress(trimmed);
}

export function parseGasAmountFractions(value: unknown): bigint | null {
  const raw = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,8})?$/.test(raw)) return null;

  const [wholePart = "0", fractionPart = ""] = raw.split(".");
  const whole = BigInt(wholePart || "0");
  const fraction = BigInt((fractionPart + "00000000").slice(0, 8));
  return whole * 100_000_000n + fraction;
}

export function isMarketPriceGas(value: unknown): boolean {
  const fractions = parseGasAmountFractions(value);
  return (
    fractions !== null &&
    fractions >= MIN_MARKET_PRICE_FRACTIONS &&
    fractions <= MAX_MARKET_PRICE_FRACTIONS
  );
}
