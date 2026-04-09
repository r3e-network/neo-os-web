import { createHash } from "crypto";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE = BigInt(ALPHABET.length);

function decodeBase58(input: string): Buffer {
  let num = BigInt(0);
  for (const char of input) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) return Buffer.alloc(0);
    num = num * BASE + BigInt(index);
  }
  const hex = num.toString(16).padStart(2, "0");
  const bytes = Buffer.from(hex.length % 2 ? "0" + hex : hex, "hex");
  // Preserve leading zeros
  let leadingZeros = 0;
  for (const char of input) {
    if (char !== "1") break;
    leadingZeros++;
  }
  return Buffer.concat([Buffer.alloc(leadingZeros), bytes]);
}

function sha256(data: Buffer): Buffer {
  return createHash("sha256").update(data).digest();
}

/**
 * Validate a Neo N3 address using Base58Check.
 * Version byte 0x35 (53) maps to the "N" prefix.
 */
export function isValidNeoAddress(value: string): boolean {
  if (typeof value !== "string" || !/^N[A-Za-z0-9]{33}$/.test(value)) {
    return false;
  }
  const decoded = decodeBase58(value);
  if (decoded.length !== 25) return false;
  if (decoded[0] !== 0x35) return false;
  const payload = decoded.subarray(0, 21);
  const checksum = decoded.subarray(21);
  const expected = sha256(sha256(payload)).subarray(0, 4);
  return checksum.equals(expected);
}
