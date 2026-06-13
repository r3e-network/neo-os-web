/**
 * scriptHashToAddress — convert a display-order `0x` Hash160 (the form
 * {@link parseHash160} emits for chain reads) into its Neo N3 address.
 *
 * The shared util layer ships address -> scriptHash (addressToScriptHash) but
 * not the inverse, and this app must stay dependency-free (shared primitives +
 * shims only). The pact's party1/party2 fields arrive as Hash160 script hashes;
 * the UI needs the human N-address so a creator sees their partner's real
 * address rather than a truncated hex script hash.
 *
 * Neo N3 addresses are Base58Check(0x35 + 20-byte-script-hash + 4-byte-checksum)
 * where the script hash is stored in CHAIN (little-endian) byte order — the
 * reverse of the display-order hex. This mirrors addressToScriptHash exactly so
 * the round-trip scriptHashToAddress(addressToScriptHash(addr)) === addr holds.
 */

import { sha256 } from "@shared/shims/noble-hashes-sha256.js";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const NEO_N3_ADDRESS_VERSION = 0x35;

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function base58Encode(bytes: Uint8Array): string {
  // Count leading zero bytes (each becomes a leading "1").
  let leadingZeros = 0;
  for (const byte of bytes) {
    if (byte !== 0) break;
    leadingZeros += 1;
  }
  let num = 0n;
  for (const byte of bytes) {
    num = num * 256n + BigInt(byte);
  }
  let out = "";
  while (num > 0n) {
    const rem = Number(num % 58n);
    num /= 58n;
    out = BASE58_ALPHABET[rem] + out;
  }
  return "1".repeat(leadingZeros) + out;
}

/**
 * Convert a display-order Hash160 (`0x`-prefixed, 40 hex chars — as emitted by
 * parseHash160) into its Neo N3 address. Returns "" for any input that is not a
 * 20-byte display-order hash.
 *
 * @param scriptHash - Display-order `0x` Hash160 hex (e.g. parseHash160 output)
 * @returns Neo N3 address (e.g. "NR3E4D8N…"), or "" on malformed input
 */
export function scriptHashToAddress(scriptHash: string): string {
  const value = String(scriptHash ?? "").trim();
  if (!value) return "";
  const hex = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
  if (hex.length !== 40) return "";
  const displayOrder = hexToBytes(hex);
  if (!displayOrder) return "";

  // Display order is the reverse of chain (little-endian) order.
  const chainOrder = Uint8Array.from(displayOrder).reverse();
  const payload = new Uint8Array(21);
  payload[0] = NEO_N3_ADDRESS_VERSION;
  payload.set(chainOrder, 1);

  const checksum = sha256(sha256(payload)).subarray(0, 4);
  const full = new Uint8Array(25);
  full.set(payload, 0);
  full.set(checksum, 21);

  return base58Encode(full);
}
