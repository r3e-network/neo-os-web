const FIXED8_FACTOR = 100_000_000;

/** Convert human-readable amount to fixed8 integer (e.g. 1.5 → 150000000) */
export function toFixed8(value: number | string): number {
  return Math.round(Number(value) * FIXED8_FACTOR);
}

/** Convert fixed8 integer to human-readable (e.g. 150000000 → 1.5) */
export function fromFixed8(value: number | bigint | string): number {
  return Number(value) / FIXED8_FACTOR;
}

/** Format a Neo N3 address hash for display (first 6 + last 4) */
export function formatHash(hash: string): string {
  if (!hash || hash.length < 10) return hash || "";
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

/** Format GAS amount with up to 8 decimal places, trimming trailing zeros */
export function formatGas(amount: number): string {
  if (amount === 0) return "0";
  return amount.toFixed(8).replace(/\.?0+$/, "");
}

/** Extract a human-readable message from an unknown error */
export function extractError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}
