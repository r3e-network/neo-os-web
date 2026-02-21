function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return toHex(digest);
}

export function generateAPIKey(): { rawKey: string; prefix: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const rawKey = `sl_${toHex(bytes)}`;
  // Prefix is stored in DB for safe display/lookup. Keep it long enough for UX.
  const prefix = rawKey.slice(0, 11);
  return { rawKey, prefix };
}

