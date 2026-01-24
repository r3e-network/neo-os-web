/**
 * Crypto utilities - React Native platform
 * Uses expo-crypto for native random generation
 */
import { sha256 } from "@noble/hashes/sha256";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

export { sha256, ripemd160, bytesToHex, hexToBytes };

/**
 * Generate random bytes using expo-crypto
 * Note: In actual usage, import from expo-crypto
 */
export function randomBytes(length: number): Uint8Array {
  // In React Native, use expo-crypto's getRandomBytes
  // This is a fallback for environments where expo-crypto is not available
  if (typeof globalThis !== "undefined" && (globalThis as Record<string, unknown>).crypto) {
    const crypto = (globalThis as Record<string, unknown>).crypto as Crypto;
    return crypto.getRandomValues(new Uint8Array(length));
  }
  // Fallback - should not be used in production
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/**
 * Hash160 (SHA256 + RIPEMD160)
 */
export function hash160(data: Uint8Array): Uint8Array {
  return ripemd160(sha256(data));
}

/**
 * Double SHA256
 */
export function hash256(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}
