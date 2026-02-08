/** Parse a Neo N3 stack item from invokeRead response */
export function parseStackItem(item: unknown): unknown {
  if (!item || typeof item !== "object") return item;
  const si = item as Record<string, unknown>;
  const type = String(si.type || "");
  const value = si.value;

  switch (type) {
    case "Integer":
      return typeof value === "string" ? BigInt(value) : Number(value ?? 0);
    case "Boolean":
      return Boolean(value);
    case "ByteString":
    case "Buffer":
      return value ? String(value) : "";
    case "Array":
      return Array.isArray(value) ? value.map(parseStackItem) : [];
    case "Map": {
      const entries = Array.isArray(value) ? value : [];
      const map: Record<string, unknown> = {};
      for (const entry of entries) {
        const e = entry as Record<string, unknown>;
        const k = String(parseStackItem(e.key) ?? "");
        map[k] = parseStackItem(e.value);
      }
      return map;
    }
    default:
      return value ?? null;
  }
}

/** Extract result from invokeRead response */
export function parseInvokeResult(res: unknown): unknown {
  if (!res || typeof res !== "object") return null;
  const r = res as Record<string, unknown>;
  const stack = r.stack as unknown[];
  if (!Array.isArray(stack) || stack.length === 0) return null;
  return parseStackItem(stack[0]);
}
