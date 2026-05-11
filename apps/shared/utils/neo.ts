/**
 * Neo blockchain utilities
 *
 * Utility functions for parsing and handling Neo blockchain data
 * including contract invocation results and stack items.
 */

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
  if (bytes.length === 20) return `0x${bytesToHex(bytes)}`;
  return `0x${bytesToHex(bytes)}`;
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

      case "Integer":
        // Convert Integer to number
        if (typeof typed.value === "string") {
          // Handle hex strings (BigInt doesn't support 0x prefix, need to parse differently)
          if (typed.value.startsWith("0x")) {
            try {
              return BigInt(parseInt(typed.value.slice(2), 16)).toString();
            } catch (_e) {
              return "0";
            }
          }
          const parsed = parseInt(typed.value, 10);
          return Number.isFinite(parsed) ? parsed : 0;
        }
        // Handle number or other types
        if (typeof typed.value === "number") {
          return Number.isFinite(typed.value) ? typed.value : 0;
        }
        return 0;

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

/**
 * Convert a Neo N3 address to its script hash.
 *
 * Neo N3 addresses are Base58Check encoded:
 *   Base58Check(0x35 + 20-byte-script-hash + 4-byte-checksum)
 *
 * This function decodes the address, extracts the 20-byte hash,
 * reverses it to little-endian, and returns it with a 0x prefix.
 *
 * @param address - Neo N3 address (e.g. "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs")
 * @returns Script hash in 0x-prefixed little-endian hex, or "" on error
 */
export function addressToScriptHash(address: string): string {
  if (!address) return "";
  // If already a 0x-prefixed script hash, reverse it to match other conversions
  if (address.startsWith("0x")) {
    const hex = address.slice(2);
    if (hex.length === 40) {
      const reversed = hex.match(/.{2}/g)?.reverse().join("") ?? "";
      return `0x${reversed}`;
    }
    return address;
  }
  try {
    // Neo N3 address format: Base58Check(0x35 + 20-byte-script-hash)
    // Decode Base58 to a big integer, then extract the script hash bytes.
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let num = BigInt(0);
    for (const char of address) {
      const idx = ALPHABET.indexOf(char);
      if (idx < 0) return "";
      num = num * BigInt(58) + BigInt(idx);
    }
    // Convert to hex, pad to 50 chars (25 bytes = 1 version + 20 hash + 4 checksum)
    const hex = num.toString(16).padStart(50, "0");
    // Extract script hash (bytes 1-20, skip version byte, skip 4 checksum bytes)
    const scriptHashHex = hex.substring(2, 42);
    // Reverse byte order for little-endian
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
