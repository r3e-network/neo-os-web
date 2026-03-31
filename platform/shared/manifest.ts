/**
 * Canonical deterministic JSON serializer.
 * Produces identical output for semantically-equal objects regardless of
 * key insertion order. Used for manifest hashing AND audit-chain hashing,
 * so every call-site in the platform MUST use this single implementation.
 */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
}
