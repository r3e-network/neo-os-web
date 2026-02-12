/**
 * Coerce an unknown caught value into a proper Error instance.
 * Avoids unsafe `as Error` casts in catch blocks.
 */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === "string") return new Error(value);
  return new Error(String(value));
}
