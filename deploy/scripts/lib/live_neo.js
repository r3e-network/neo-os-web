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

function stackValue(item) {
  if (!item || typeof item !== "object") return null;
  switch (item.type) {
    case "Integer":
      return String(item.value || "0");
    case "Boolean":
      return Boolean(item.value);
    case "ByteString": {
      const bytes = stackBytes(item);
      if (bytes.length === 20) {
        return `0x${Buffer.from(bytes).reverse().toString("hex")}`;
      }
      try {
        return bytes.toString("utf8");
      } catch {
        return item.value ?? null;
      }
    }
    case "Array":
    case "Struct":
      return Array.isArray(item.value) ? item.value.map(stackValue) : [];
    case "Map":
      return Object.fromEntries(
        (item.value || []).map((entry) => [stackValue(entry.key), stackValue(entry.value)])
      );
    default:
      return item.value ?? null;
  }
}

function executionReturnedTrue(execution) {
  const item = execution?.stack?.[0];
  if (!item) return false;
  if (item.type === "Boolean") return item.value === true;
  if (item.type === "Integer") return String(item.value || "0") !== "0";
  return false;
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
  executionReturnedTrue,
  findNotification,
  createWaitForLog,
};
