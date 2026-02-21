export function normalizeUInt160(value: string): string {
  let s = String(value ?? "").trim();
  s = s.replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{40}$/.test(s)) {
    throw new Error("invalid UInt160 (expected 40 hex chars)");
  }
  return `0x${s.toLowerCase()}`;
}

