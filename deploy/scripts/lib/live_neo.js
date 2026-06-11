"use strict";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asTxid(value) {
  const text = String(value || "");
  return text.startsWith("0x") ? text : `0x${text}`;
}

function stackBytes(item) {
  if (!item || typeof item !== "object") return Buffer.alloc(0);
  if (item.type === "ByteString" || item.type === "Buffer") {
    return Buffer.from(String(item.value || ""), "base64");
  }
  if (item.type === "Integer") {
    let hex = BigInt(String(item.value || "0")).toString(16);
    if (hex.length % 2 !== 0) hex = `0${hex}`;
    return Buffer.from(hex, "hex");
  }
  return Buffer.alloc(0);
}

/**
 * Decode a ByteString stack item per a caller-directed mode:
 *   "auto"    (default) printable-ASCII → utf8 text, else 20 bytes → reversed
 *             0x hash, else utf8 text — the historical heuristic.
 *   "utf8"    always utf8 text (even for 20-byte values).
 *   "hash160" require exactly 20 bytes; return big-endian display "0x…".
 *   "hex"     raw bytes as unreversed "0x…" hex.
 *   "base64"  the node's base64 payload untouched.
 */
function decodeByteString(item, mode) {
  const bytes = stackBytes(item);
  switch (mode) {
    case "utf8":
      return bytes.toString("utf8");
    case "hex":
      return `0x${bytes.toString("hex")}`;
    case "base64":
      return String(item.value || "");
    case "hash160": {
      if (bytes.length !== 20) {
        throw new Error(`stackValue: expected a 20-byte hash160 ByteString, got ${bytes.length} bytes`);
      }
      return `0x${Buffer.from(bytes).reverse().toString("hex")}`;
    }
    case "auto":
    default: {
      // Heuristic: printable ASCII reads as text, 20-byte values as a script
      // hash. A 20-byte hash that is entirely printable ASCII mis-decodes as
      // text here — callers that know the shape should pass an explicit mode.
      const text = bytes.toString("utf8");
      if (/^[\x20-\x7E]+$/.test(text)) {
        return text;
      }
      if (bytes.length === 20) {
        return `0x${Buffer.from(bytes).reverse().toString("hex")}`;
      }
      return text;
    }
  }
}

/**
 * Decode an invokefunction stack item to a plain JS value.
 *
 * @param {object} item     RPC stack item
 * @param {string|{byteString?: string}} [options]  caller-directed ByteString
 *        decode mode ("auto" | "utf8" | "hash160" | "hex" | "base64"), either
 *        as a bare string or as { byteString }. Applies recursively to
 *        Array/Struct/Map members. Defaults to the historical "auto" heuristic.
 */
function stackValue(item, options) {
  if (!item || typeof item !== "object") return null;
  const byteStringMode =
    typeof options === "string" ? options : (options && options.byteString) || "auto";
  switch (item.type) {
    case "Integer":
      return String(item.value || "0");
    case "Boolean":
      return Boolean(item.value);
    case "ByteString":
      return decodeByteString(item, byteStringMode);
    case "Array":
    case "Struct":
      return Array.isArray(item.value) ? item.value.map((entry) => stackValue(entry, options)) : [];
    case "Map":
      return Object.fromEntries(
        (item.value || []).map((entry) => [stackMapKey(entry.key), stackValue(entry.value, options)])
      );
    default:
      return item.value ?? null;
  }
}

function stackMapKey(item) {
  if (!item || typeof item !== "object") return "";
  if (item.type === "ByteString" || item.type === "Buffer") {
    const bytes = stackBytes(item);
    const text = bytes.toString("utf8");
    if (/^[\x20-\x7E]+$/.test(text)) return text;
  }
  return String(stackValue(item) ?? "");
}

function executionReturnedTrue(execution) {
  const item = execution?.stack?.[0];
  if (!item) return false;
  if (item.type === "Boolean") return item.value === true;
  if (item.type === "Integer") return String(item.value || "0") !== "0";
  return false;
}

async function withStep(label, fn) {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const wrapped = new Error(`${label}: ${message}`);
    if (error instanceof Error && error.stack) {
      wrapped.stack = `${wrapped.name}: ${wrapped.message}\nCaused by: ${error.stack}`;
    }
    throw wrapped;
  }
}

function findNotification(execution, contractHash, eventName) {
  const expected = String(contractHash).toLowerCase();
  return (execution.notifications || []).find(
    (entry) =>
      String(entry.contract || "").toLowerCase() === expected &&
      String(entry.eventname || "") === eventName
  );
}

function createWaitForLog({ getApplicationLog, label, pollIntervalMs = 2000 }) {
  if (typeof getApplicationLog !== "function") {
    throw new Error("createWaitForLog requires getApplicationLog");
  }
  const prefix = String(label || "live_neo");
  return async function waitForLog(txid, timeoutMs = 120000) {
    const deadline = Date.now() + timeoutMs;
    const normalized = asTxid(txid);
    while (Date.now() < deadline) {
      try {
        const log = await getApplicationLog(normalized);
        const execution = log?.executions?.[0];
        if (execution) return { txid: normalized, execution };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (!/Unknown script container/i.test(message)) {
          console.warn(`[${prefix}] getApplicationLog failed, retrying: ${message}`);
        }
      }
      await sleep(pollIntervalMs);
    }
    throw new Error(`timed out waiting for ${normalized}`);
  };
}

module.exports = {
  sleep,
  asTxid,
  stackBytes,
  stackValue,
  stackMapKey,
  executionReturnedTrue,
  findNotification,
  createWaitForLog,
  withStep,
};
