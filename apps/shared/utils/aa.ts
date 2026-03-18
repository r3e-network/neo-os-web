import { ripemd160 } from "../shims/noble-hashes-ripemd160.js";
import { sha256 } from "../shims/noble-hashes-sha256.js";
import { normalizeScriptHash } from "./neo";

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function deriveAAAccountIdHash(input: string): string {
  const trimmed = String(input || "").trim();
  const normalized = normalizeScriptHash(trimmed).replace(/^0x/, "");
  if (/^[0-9a-f]{40}$/i.test(normalized)) return normalized.toLowerCase();
  if (!trimmed) {
    throw new Error("accountId seed is required");
  }
  const seed = new TextEncoder().encode(trimmed);
  return bytesToHex(ripemd160(sha256(seed)));
}
