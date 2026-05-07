import test from "node:test";
import assert from "node:assert/strict";

import liveNeo from "./live_neo.js";

const {
  asTxid,
  stackBytes,
  stackValue,
  executionReturnedTrue,
  findNotification,
  createWaitForLog,
} = liveNeo;

test("asTxid normalizes missing 0x prefix", () => {
  assert.equal(asTxid("abcd"), "0xabcd");
  assert.equal(asTxid("0xabcd"), "0xabcd");
  assert.equal(asTxid(""), "0x");
});

test("stackBytes decodes byte strings and integers", () => {
  assert.deepEqual(
    stackBytes({ type: "ByteString", value: Buffer.from("neo").toString("base64") }),
    Buffer.from("neo")
  );
  assert.deepEqual(stackBytes({ type: "Integer", value: "255" }), Buffer.from("ff", "hex"));
});

test("stackValue decodes booleans, integers, arrays, maps, utf8, and hash160 byte strings", () => {
  assert.equal(stackValue({ type: "Integer", value: "42" }), "42");
  assert.equal(stackValue({ type: "Boolean", value: true }), true);
  assert.equal(
    stackValue({ type: "ByteString", value: Buffer.from("hello").toString("base64") }),
    "hello"
  );

  const hashBytes = Buffer.from("00112233445566778899aabbccddeeff00112233", "hex").reverse();
  assert.equal(
    stackValue({ type: "ByteString", value: hashBytes.toString("base64") }),
    "0x00112233445566778899aabbccddeeff00112233"
  );

  assert.deepEqual(
    stackValue({
      type: "Array",
      value: [
        { type: "Integer", value: "1" },
        { type: "Boolean", value: false },
      ],
    }),
    ["1", false]
  );

  assert.deepEqual(
    stackValue({
      type: "Map",
      value: [
        {
          key: { type: "ByteString", value: Buffer.from("name").toString("base64") },
          value: { type: "ByteString", value: Buffer.from("neo").toString("base64") },
        },
      ],
    }),
    { name: "neo" }
  );
});

test("executionReturnedTrue interprets bool and integer stack heads", () => {
  assert.equal(executionReturnedTrue({ stack: [{ type: "Boolean", value: true }] }), true);
  assert.equal(executionReturnedTrue({ stack: [{ type: "Boolean", value: false }] }), false);
  assert.equal(executionReturnedTrue({ stack: [{ type: "Integer", value: "1" }] }), true);
  assert.equal(executionReturnedTrue({ stack: [{ type: "Integer", value: "0" }] }), false);
  assert.equal(executionReturnedTrue({ stack: [] }), false);
});

test("findNotification matches contract hash and event name", () => {
  const execution = {
    notifications: [
      { contract: "0xabc", eventname: "Ignored" },
      { contract: "0xdef", eventname: "Matched" },
    ],
  };
  assert.deepEqual(findNotification(execution, "0xdef", "Matched"), execution.notifications[1]);
  assert.equal(findNotification(execution, "0xdef", "Missing"), undefined);
});

test("createWaitForLog retries through unknown script container without warning", async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(String(message));

  let calls = 0;
  const waitForLog = createWaitForLog({
    label: "test_live_neo",
    pollIntervalMs: 0,
    getApplicationLog: async () => {
      calls += 1;
      if (calls === 1) throw new Error("Unknown script container");
      return { executions: [{ vmstate: "HALT" }] };
    },
  });

  try {
    const result = await waitForLog("abcd", 1000);
    assert.equal(result.txid, "0xabcd");
    assert.equal(result.execution.vmstate, "HALT");
    assert.deepEqual(warnings, []);
  } finally {
    console.warn = originalWarn;
  }
});

test("createWaitForLog warns on non-transient errors and times out", async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(String(message));

  const waitForLog = createWaitForLog({
    label: "test_live_neo",
    pollIntervalMs: 0,
    getApplicationLog: async () => {
      throw new Error("rpc unavailable");
    },
  });

  try {
    await assert.rejects(waitForLog("abcd", 10), /timed out waiting for 0xabcd/);
    assert.equal(warnings.length > 0, true);
    assert.match(warnings[0], /\[test_live_neo\] getApplicationLog failed, retrying: rpc unavailable/);
  } finally {
    console.warn = originalWarn;
  }
});
