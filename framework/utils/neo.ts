/**
 * Neo blockchain utilities
 *
 * Utility functions for parsing and handling Neo blockchain data
 * including contract invocation results and stack items.
 *
 * Canonical home of the helpers formerly duplicated between
 * apps/shared/utils/neo.ts and the framework fork — shared re-exports
 * from here.
 */
import { sha256 } from "@noble/hashes/sha2.js";

function decodeBase64Bytes(value: unknown): Uint8Array | null {
  if (typeof value !== "string") return null;
  if (!value) return new Uint8Array();
  try {
    const decoded = atob(value);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i += 1) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToPrintableText(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return "";
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (/^[\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]*$/.test(text)) {
      return text;
    }
  } catch {
    return null;
  }
  return null;
}

function parseByteLike(value: unknown): unknown {
  const bytes = decodeBase64Bytes(value);
  if (!bytes) return value;
  const text = bytesToPrintableText(bytes);
  if (text !== null) return text;
  return `0x${bytesToHex(bytes)}`;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

const HASH160_BYTE_LENGTH = 20;

function extractHash160Bytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return value.length === HASH160_BYTE_LENGTH ? value : null;
  }
  if (typeof value !== "string" || !value) return null;

  // 1. Hex form ("0x" optional). parseByteLike emits "0x<40 hex>" for
  //    non-printable byte strings — checked before base64 because 40 hex
  //    chars are also base64-decodable (to 30 bytes, which would fail).
  const hex = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
  if (hex.length === HASH160_BYTE_LENGTH * 2) {
    const fromHex = hexToBytes(hex);
    if (fromHex) return fromHex;
  }

  // 2. Raw RPC ByteString value (base64 of the 20 bytes).
  const fromBase64 = decodeBase64Bytes(value);
  if (fromBase64 && fromBase64.length === HASH160_BYTE_LENGTH) return fromBase64;

  // 3. parseByteLike's printable-text path: when all 20 bytes happen to be
  //    printable, the hash arrives as a 20-char string — recover the bytes
  //    from the char codes (only valid while every char fits in one byte).
  if (value.length === HASH160_BYTE_LENGTH) {
    const bytes = new Uint8Array(HASH160_BYTE_LENGTH);
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i);
      if (code > 0xff) return null;
      bytes[i] = code;
    }
    return bytes;
  }

  return null;
}

/**
 * Convert a Hash160 value as it arrives from chain reads into the 0x display
 * hex that explorers, `invokefunction` params and {@link addressToScriptHash}
 * use.
 *
 * Neo VM ByteStrings carry UInt160 values in reversed (chain) byte order, so
 * `parseStackItem`/`parseByteLike` renders them either as the byte-reversed
 * `0x…` hex of the display hash or — when all 20 bytes are printable — as a
 * garbage text string. This helper accepts all the shapes a Hash160 read can
 * take and normalizes to the display form:
 *
 * - a raw stack item (`{ type: "ByteString", value: "<base64>" }`)
 * - the raw base64 ByteString value
 * - a 40-char hex string in chain byte order (with or without `0x`)
 * - the 20-char printable-text output of `parseByteLike`
 * - a 20-byte `Uint8Array`
 *
 * The input is always interpreted as chain (reversed) byte order — do not
 * pass values that are already in display order.
 *
 * Real-node fixture: `getOwner` on MiniAppSelfLoan (testnet) returns
 * ByteString base64 `ODf0EwY4dOXBDMmxnUaR3fZWBm0=`, which displays as
 * `0x6d0656f6dd91469db1c90cc1e574380613f43738` (address
 * `NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32`).
 *
 * @param value - Hash160 in any chain-read shape (see above)
 * @returns Display-order `0x` hex (lowercase), or `""` when the input is not
 *          a 20-byte hash-like value
 */
export function parseHash160(value: unknown): string {
  let candidate = value;
  if (
    candidate &&
    typeof candidate === "object" &&
    !(candidate instanceof Uint8Array) &&
    "type" in candidate
  ) {
    const typed = candidate as { type: string; value?: unknown };
    if (typed.type !== "ByteString" && typed.type !== "ByteArray" && typed.type !== "Buffer") {
      return "";
    }
    candidate = typed.value;
  }
  const bytes = extractHash160Bytes(candidate);
  if (!bytes) return "";
  return `0x${bytesToHex(Uint8Array.from(bytes).reverse())}`;
}

function parseMapEntry(entry: unknown): [unknown, unknown] | null {
  if (Array.isArray(entry) && entry.length === 2) {
    return [entry[0], entry[1]];
  }
  if (entry && typeof entry === "object" && "key" in entry && "value" in entry) {
    const kv = entry as { key: unknown; value: unknown };
    return [kv.key, kv.value];
  }
  return null;
}

/**
 * Parse a stack item from Neo VM
 *
 * @param item - Stack item to parse
 * @returns Parsed value
 */
export function parseStackItem(item: unknown): unknown {
  if (item === null || item === undefined) {
    return null;
  }

  // Handle ByteArray
  if (typeof item === "object" && "type" in item) {
    const typed = item as { type: string; value: unknown };

    switch (typed.type) {
      case "ByteString":
      case "ByteArray":
      case "Buffer":
        return parseByteLike(typed.value);

      case "Integer": {
        // Parse via BigInt so large values stay precise. One rule for every
        // encoding (decimal string, 0x-hex string, number): values within
        // Number.MAX_SAFE_INTEGER return as number; anything larger (fixed8
        // products, 1e12-scaled accumulators) returns as a decimal string so
        // the digits survive intact. Unparseable input returns 0.
        let parsed: bigint;
        if (typeof typed.value === "string") {
          try {
            parsed = BigInt(typed.value.trim());
          } catch (_e) {
            return 0;
          }
        } else if (typeof typed.value === "number") {
          if (!Number.isFinite(typed.value)) return 0;
          parsed = BigInt(Math.trunc(typed.value));
        } else if (typeof typed.value === "bigint") {
          parsed = typed.value;
        } else {
          return 0;
        }
        if (
          parsed >= BigInt(Number.MIN_SAFE_INTEGER) &&
          parsed <= BigInt(Number.MAX_SAFE_INTEGER)
        ) {
          return Number(parsed);
        }
        return parsed.toString();
      }

      case "Array":
      case "Struct":
        if (Array.isArray(typed.value)) {
          return typed.value.map(parseStackItem);
        }
        return typed.value;

      case "Map":
        if (Array.isArray(typed.value)) {
          const map = new Map();
          for (const entry of typed.value) {
            const kv = parseMapEntry(entry);
            if (!kv) continue;
            map.set(parseStackItem(kv[0]), parseStackItem(kv[1]));
          }
          return Object.fromEntries(map);
        }
        return typed.value;

      case "Boolean":
        // Neo RPC serializes a Boolean stack item's value as the JSON STRING
        // "true"/"false" (not a native boolean), so a bare Boolean(value) turns
        // "false" into true (any non-empty string is truthy). Handle the string
        // and numeric ("0"/"1") wire forms explicitly; fall back to the native
        // coercion when a provider does send a real boolean/number.
        if (typeof typed.value === "string") {
          const v = typed.value.trim().toLowerCase();
          return v === "true" || v === "1";
        }
        if (typeof typed.value === "number") return typed.value !== 0;
        return Boolean(typed.value);

      case "String":
        return String(typed.value);

      case "Hash160":
      case "Hash256":
        return String(typed.value);

      case "InteropInterface":
        return typed.value;

      default:
        return typed.value;
    }
  }

  // Handle arrays recursively
  if (Array.isArray(item)) {
    return item.map(parseStackItem);
  }

  return item;
}

/**
 * Parse invoke result from contract execution
 *
 * @param result - Result from invoke or invokeRead
 * @returns Parsed result data
 */
export function parseInvokeResult(result: unknown): unknown {
  if (!result) {
    return null;
  }

  // Handle InvokeResult type
  if (typeof result === "object" && result !== null) {
    const obj = result as Record<string, unknown>;

    // A VM FAULT means the read reverted — its stack is not a valid result.
    // Return null (a faulted read carries no data) rather than decoding the
    // half-executed stack as a real value, which silently presented garbage as
    // success. Callers already treat null as "no data".
    if (
      typeof obj.state === "string" &&
      obj.state.toUpperCase().includes("FAULT")
    ) {
      return null;
    }

    // If there's a stack property, parse it
    if ("stack" in obj && Array.isArray(obj.stack)) {
      if (obj.stack.length === 0) {
        return null;
      }
      if (obj.stack.length === 1) {
        return parseStackItem(obj.stack[0]);
      }
      return obj.stack.map(parseStackItem);
    }

    // If there's a state property (for events)
    if ("state" in obj) {
      return parseStackItem(obj.state);
    }

    // If there's a txid or txHash, return as is
    if ("txid" in obj || "txHash" in obj) {
      return result;
    }

    // Otherwise, try to parse the entire object
    return parseStackItem(result);
  }

  // Handle primitive values
  if (typeof result === "string" || typeof result === "number" || typeof result === "boolean") {
    return result;
  }

  return parseStackItem(result);
}

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const NEO_N3_ADDRESS_VERSION = 0x35;

function base58Decode(input: string): Uint8Array | null {
  let num = BigInt(0);
  for (const char of input) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx < 0) return null;
    num = num * BigInt(58) + BigInt(idx);
  }
  let hex = num === BigInt(0) ? "" : num.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const digits = new Uint8Array(hex.length / 2);
  for (let i = 0; i < digits.length; i += 1) {
    digits[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  // Preserve leading zero bytes (encoded as leading "1" characters)
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

/**
 * Convert a Neo N3 address to its script hash.
 *
 * Neo N3 addresses are Base58Check encoded:
 *   Base58Check(0x35 + 20-byte-script-hash + 4-byte-checksum)
 *
 * This function performs the full Base58Check validation — decoded length
 * must be exactly 25 bytes, the version byte must be 0x35, and the trailing
 * 4 bytes must equal the first 4 bytes of double-SHA256 of the payload — so
 * a typo'd address can never silently produce a plausible-looking hash.
 * The validated 20-byte hash is reversed to little-endian and 0x-prefixed.
 *
 * @param address - Neo N3 address (e.g. "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs")
 * @returns Script hash in 0x-prefixed little-endian hex, or "" on error
 */
export function addressToScriptHash(address: string): string {
  if (!address) return "";
  const trimmed = address.trim();
  // If already a 0x-prefixed script hash, reverse it to match other conversions.
  // Accept an uppercase "0X" prefix and lowercase the hex so the output matches
  // the lowercase little-endian form base58 / normalizeScriptHash produce
  // (otherwise a direct string-compare against a normalized hash falsely fails).
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
    // Extract script hash (bytes 1-20) and reverse byte order for little-endian
    const scriptHashHex = bytesToHex(decoded.subarray(1, 21));
    const reversed = scriptHashHex.match(/.{2}/g)?.reverse().join("") ?? "";
    return `0x${reversed}`;
  } catch (_e) {
    return "";
  }
}

/**
 * Normalize script hash format
 *
 * @param hash - Script hash in any format
 * @returns Normalized script hash (0x prefix, lowercase)
 */
export function normalizeScriptHash(hash: string): string {
  let normalized = String(hash ?? "").trim();

  // Add 0x prefix if missing
  if (!normalized.startsWith("0x")) {
    normalized = `0x${normalized}`;
  }

  // Convert to lowercase
  normalized = normalized.toLowerCase();

  return normalized;
}

/**
 * Compare an owner value from contract/event data against a wallet address.
 *
 * Supports direct address equality and script-hash comparison.
 *
 * @param owner - Owner value from chain data
 * @param address - Wallet address to match against
 * @returns True when owner belongs to the wallet address
 */
export function ownerMatchesAddress(owner: unknown, address: string | null | undefined): boolean {
  if (!address) return false;

  const value = String(owner || "");
  if (value === address) return true;

  const normalized = normalizeScriptHash(value);
  if (!normalized) return false;

  const addressHash = addressToScriptHash(address);
  if (!addressHash) return false;

  return normalized === addressHash;
}
