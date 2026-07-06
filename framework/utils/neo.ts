import { sha256 } from "@noble/hashes/sha2.js";

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const NEO_N3_ADDRESS_VERSION = 0x35;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base58Decode(input: string): Uint8Array | null {
  let num = 0n;
  for (const char of input) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx < 0) return null;
    num = num * 58n + BigInt(idx);
  }
  let hex = num === 0n ? "" : num.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const digits = new Uint8Array(hex.length / 2);
  for (let i = 0; i < digits.length; i += 1) {
    digits[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  let leadingZeros = 0;
  for (const char of input) {
    if (char !== "1") break;
    leadingZeros += 1;
  }
  if (leadingZeros === 0) return digits;
  const bytes = new Uint8Array(leadingZeros + digits.length);
  bytes.set(digits, leadingZeros);
  return bytes;
}

export function addressToScriptHash(address: string): string {
  const trimmed = String(address ?? "").trim();
  if (!trimmed) return "";
  if (/^0x/i.test(trimmed)) {
    const hex = trimmed.slice(2).toLowerCase();
    if (/^[0-9a-f]{40}$/.test(hex)) {
      const reversed = hex.match(/.{2}/g)?.reverse().join("") ?? "";
      return `0x${reversed}`;
    }
    return trimmed;
  }
  try {
    const decoded = base58Decode(trimmed);
    if (!decoded || decoded.length !== 25) return "";
    if (decoded[0] !== NEO_N3_ADDRESS_VERSION) return "";
    const payload = decoded.subarray(0, 21);
    const checksum = decoded.subarray(21);
    const expected = sha256(sha256(payload)).subarray(0, 4);
    for (let i = 0; i < 4; i += 1) {
      if (checksum[i] !== expected[i]) return "";
    }
    const scriptHashHex = bytesToHex(decoded.subarray(1, 21));
    const reversed = scriptHashHex.match(/.{2}/g)?.reverse().join("") ?? "";
    return `0x${reversed}`;
  } catch {
    return "";
  }
}
