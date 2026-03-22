function stableSort(value: unknown): unknown {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(stableSort);
  if (typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v === undefined) continue;
    out[key] = stableSort(v);
  }
  return out;
}

export function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(stableSort(value));
  } catch (err) {
    console.warn("[stableStringify] serialization failed:", err instanceof Error ? err.message : String(err));
    return String(value);
  }
}
