/**
 * Shared utility functions - Platform agnostic
 */

import { sha256 } from "@noble/hashes/sha2";

/**
 * Format a Neo address for display (truncated)
 */
export function formatAddress(address: string, chars = 6): string {
  if (!address || address.length < chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format a number with decimals
 */
export function formatAmount(amount: string | number, decimals = 8): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * Convert script hash to address format
 */
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const NEO_N3_VERSION = 0x35;

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

function base58Encode(bytes: Uint8Array): string {
  let num = BigInt(0);
  for (const byte of bytes) {
    num = num * BigInt(256) + BigInt(byte);
  }

  let encoded = "";
  while (num > 0) {
    const rem = Number(num % BigInt(58));
    encoded = BASE58_ALPHABET[rem] + encoded;
    num = num / BigInt(58);
  }

  let leadingZeros = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      leadingZeros += 1;
    } else {
      break;
    }
  }

  return `${"1".repeat(leadingZeros)}${encoded}`;
}

/**
 * Convert script hash to Neo N3 address format
 */
export function scriptHashToAddress(scriptHash: string): string {
  const normalized = scriptHash.trim().toLowerCase().replace(/^0x/, "");
  if (normalized.length !== 40) return scriptHash;
  if (!/^[0-9a-f]{40}$/.test(normalized)) return scriptHash;

  const bytes = hexToBytes(normalized);
  const reversed = Uint8Array.from(bytes);
  reversed.reverse();

  const payload = new Uint8Array(1 + reversed.length);
  payload[0] = NEO_N3_VERSION;
  payload.set(reversed, 1);

  const checksum = sha256(sha256(payload)).slice(0, 4);
  const addressBytes = new Uint8Array(payload.length + checksum.length);
  addressBytes.set(payload);
  addressBytes.set(checksum, payload.length);

  return base58Encode(addressBytes);
}

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await delay(baseDelay * Math.pow(2, i));
      }
    }
  }
  throw lastError;
}
