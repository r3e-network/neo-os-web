export function fromFixed8(value: bigint | number | string | unknown): number {
  const num = typeof value === "bigint" ? Number(value) : Number(value ?? 0);
  return Number.isFinite(num) ? num / 1e8 : 0;
}
