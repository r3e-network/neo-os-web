import { bytesToHex } from "./hex.ts";

export { sha256Hex } from "./hex.ts";

export function generateAPIKey(): { rawKey: string; prefix: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const rawKey = `sl_${bytesToHex(bytes)}`;
  // Prefix is stored in DB for safe display/lookup. Keep it long enough for UX.
  const prefix = rawKey.slice(0, 11);
  return { rawKey, prefix };
}
