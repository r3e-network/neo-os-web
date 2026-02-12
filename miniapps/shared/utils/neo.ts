/**
 * Neo blockchain utilities
 *
 * Utility functions for parsing and handling Neo blockchain data
 * including contract invocation results and stack items.
 */

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
      case "ByteArray":
      case "Buffer":
        return typed.value;

      case "Integer":
        // Convert Integer to number
        if (typeof typed.value === "string") {
          // Handle hex strings
          if (typed.value.startsWith("0x")) {
            return BigInt(typed.value).toString();
          }
          return parseInt(typed.value, 10);
        }
        return Number(typed.value);

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
            if (Array.isArray(entry) && entry.length === 2) {
              map.set(parseStackItem(entry[0]), parseStackItem(entry[1]));
            }
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
 * Convert address to script hash
 *
 * @param address - Neo address
 * @returns Script hash (reversed, with 0x prefix)
 */
export function addressToScriptHash(address: string): string {
  // This is a simplified version - in production you'd use proper base58 decoding
  // For now, return the address as-is with prefix
  if (address.startsWith("0x")) {
    return address;
  }
  return `0x${address}`;
}

/**
 * Normalize script hash format
 *
 * @param hash - Script hash in any format
 * @returns Normalized script hash (0x prefix, lowercase)
 */
export function normalizeScriptHash(hash: string): string {
  let normalized = hash.trim();

  // Add 0x prefix if missing
  if (!normalized.startsWith("0x")) {
    normalized = `0x${normalized}`;
  }

  // Convert to lowercase
  normalized = normalized.toLowerCase();

  return normalized;
}
