/**
 * EVM Cryptographic Utilities
 * Pure JavaScript implementation for browser compatibility
 * Uses @noble/secp256k1 for elliptic curve operations
 */

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";

/**
 * Get uncompressed public key from private key
 * Returns 65 bytes: 0x04 prefix + 32 bytes X + 32 bytes Y
 */
export function getPublicKey(privateKey: Uint8Array): Uint8Array {
  return secp256k1.getPublicKey(privateKey, false);
}

/**
 * Keccak256 hash (used for Ethereum addresses)
 */
export function keccak256(data: Uint8Array): Uint8Array {
  return keccak_256(data);
}

/**
 * Derive Ethereum address from private key
 */
export function deriveAddress(privateKey: Uint8Array): string {
  const publicKey = getPublicKey(privateKey);
  // Remove 0x04 prefix for address derivation
  const publicKeyWithoutPrefix = publicKey.slice(1);
  const hash = keccak256(publicKeyWithoutPrefix);
  const addressBytes = hash.slice(-20);
  return (
    "0x" +
    Array.from(addressBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * Sign message with private key (EIP-191 personal sign)
 */
export function signMessage(message: string, privateKey: Uint8Array): string {
  const messageHash = hashMessage(message);
  // Use 'recovered' format to get 65 bytes: r (32) + s (32) + v (1)
  const sig = secp256k1.sign(messageHash, privateKey, { prehash: false, format: "recovered" });
  // Convert to hex and adjust v value for Ethereum (add 27)
  const sigHex = Array.from(sig)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Last byte is recovery id (0 or 1), convert to Ethereum v (27 or 28)
  const v = (sig[64] + 27).toString(16).padStart(2, "0");
  return "0x" + sigHex.slice(0, 128) + v;
}

/**
 * Hash message with Ethereum prefix (EIP-191)
 */
export function hashMessage(message: string): Uint8Array {
  const prefix = `\x19Ethereum Signed Message:\n${message.length}`;
  const prefixedMessage = new TextEncoder().encode(prefix + message);
  return keccak256(prefixedMessage);
}

/**
 * Validate private key
 */
export function isValidPrivateKey(privateKey: Uint8Array): boolean {
  try {
    secp256k1.getPublicKey(privateKey);
    return true;
  } catch {
    return false;
  }
}
