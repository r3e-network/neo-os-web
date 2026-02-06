export function normalizeHex(value: string, label: string): string {
  let s = String(value ?? "").trim();
  s = s.replace(/^0x/i, "");
  if (!s) throw new Error(`${label} required`);
  if (!/^[0-9a-fA-F]+$/.test(s)) throw new Error(`${label} must be hex`);
  if (s.length % 2 !== 0) throw new Error(`${label} must have an even hex length`);
  return s.toLowerCase();
}

export function normalizeHexBytes(value: string, expectedBytes: number, label: string): string {
  const s = normalizeHex(value, label);
  if (s.length !== expectedBytes * 2) throw new Error(`${label} must be ${expectedBytes} bytes`);
  return s;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function normalizeUInt160(value: string): string {
  const s = normalizeHexBytes(value, 20, "UInt160");
  return `0x${s}`;
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return bytesToHex(digest);
}
