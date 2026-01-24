/**
 * Crypto utilities - Web platform
 * Uses Web Crypto API
 */
import { sha256 } from "@noble/hashes/sha256";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

export { sha256, ripemd160, bytesToHex, hexToBytes };

/**
 * Generate random bytes using Web Crypto API
 */
export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
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
