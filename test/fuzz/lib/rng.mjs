/**
 * Deterministic + random input generators for contract fuzzing.
 */
import crypto from "node:crypto";

export function randomBytes(n) {
  return crypto.randomBytes(n);
}

export function randomHex(n) {
  return randomBytes(n).toString("hex");
}

export function randomUInt160() {
  return "0x" + randomHex(20);
}

export function randomBigInt(min = 0n, max = 10n ** 18n) {
  const range = max - min;
  const bits = range.toString(2).length;
  const bytes = Math.ceil(bits / 8) + 1;
  let value;
  do {
    value = BigInt("0x" + randomHex(bytes)) % (range + 1n);
  } while (value > range);
  return min + value;
}

export function randomInt(min = 0, max = 1000000) {
  return Number(randomBigInt(BigInt(min), BigInt(max)));
}

export function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomString(len = 16) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function randomAddress() {
  // Not a valid Neo address (checksum will fail), but useful for fuzz inputs
  return "N" + randomString(33);
}

/** Boundary values for integer fuzzing */
export const BOUNDARY_INTS = [
  0n, 1n, -1n,
  255n, 256n,
  2n ** 32n - 1n, 2n ** 32n,
  2n ** 64n - 1n, 2n ** 64n,
  2n ** 128n - 1n,
  10n ** 8n,   // 1 GAS (fixed8)
  10n ** 16n,  // 100M GAS
];

/** Boundary strings for input fuzzing */
export const BOUNDARY_STRINGS = [
  "",
  " ",
  "\0",
  "a".repeat(256),
  "a".repeat(65536),
  "<script>alert(1)</script>",
  "'; DROP TABLE users; --",
  "\n\r\t",
  "🔥".repeat(100),
  "\xff\xfe",
];
