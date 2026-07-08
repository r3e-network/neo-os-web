/**
 * SHA-256 hex digest helpers built on Web Crypto.
 *
 * Canonical home of the helpers formerly duplicated in
 * apps/shared/utils/hash.ts (and the private `sha256Hex` re-impl in
 * framework/index.ts) — shared re-exports from here.
 */

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

export async function sha256HexFromHex(value: string): Promise<string> {
  const cleaned = value.replace(/^0x/i, "").trim();
  if (!cleaned) return "";
  if (cleaned.length % 2 !== 0) {
    throw new Error("sha256HexFromHex: hex string must have even number of characters");
  }
  if (!/^[0-9a-fA-F]*$/.test(cleaned)) {
    throw new Error("sha256HexFromHex: invalid hex character");
  }
  const hexBytes = cleaned.match(/.{1,2}/g);
  if (!hexBytes) return "";
  const data = new Uint8Array(hexBytes.map((byte) => parseInt(byte, 16)));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return toHex(digest);
}

/**
 * `0x`-prefixed SHA-256 digest used for oracle-envelope payloads.
 *
 * Oracle-envelope digests must be a real SHA-256 so an equivalent payload
 * hashes to the same value in the UI preview, the OneGate dApp call, and the
 * on-chain submission. A non-crypto fallback would silently diverge across
 * environments and break that cross-check, so require a secure context here
 * rather than return a digest that cannot be reproduced downstream.
 */
export async function sha256Hex0x(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "Oracle envelope digest requires SHA-256 (crypto.subtle); run in a secure context",
    );
  }
  return `0x${await sha256Hex(value)}`;
}
