import test from "node:test";
import assert from "node:assert/strict";
import Neon from "./neon-compat.mjs";

test("RPCClient retries transient aborted read calls before surfacing failure", async () => {
  const client = new Neon.rpc.RPCClient("http://example.invalid");
  let attempts = 0;
  client.inner = {
    async send(method, params) {
      attempts += 1;
      if (attempts === 1) throw new Error("This operation was aborted");
      return { method, params, ok: true };
    },
  };

  const result = await client.send("getversion", []);

  assert.equal(attempts, 2);
  assert.deepEqual(result, { method: "getversion", params: [], ok: true });
});

test("RPCClient annotates persistent transient failures with the RPC method", async () => {
  const client = new Neon.rpc.RPCClient("http://example.invalid");
  client.inner = {
    async send() {
      throw new Error("This operation was aborted");
    },
  };

  await assert.rejects(
    () => client.send("invokefunction", []),
    /rpc\.invokefunction: This operation was aborted/,
  );
});

test("RPCClient defaults to five attempts for transient read failures", async () => {
  const previousAttempts = process.env.NEO_RPC_RETRY_ATTEMPTS;
  delete process.env.NEO_RPC_RETRY_ATTEMPTS;
  const client = new Neon.rpc.RPCClient("http://example.invalid");
  let attempts = 0;
  client.inner = {
    async send() {
      attempts += 1;
      throw new Error("This operation was aborted");
    },
  };

  try {
    await assert.rejects(
      () => client.send("invokefunction", []),
      /rpc\.invokefunction: This operation was aborted/,
    );
    assert.equal(attempts, 5);
  } finally {
    if (previousAttempts === undefined) delete process.env.NEO_RPC_RETRY_ATTEMPTS;
    else process.env.NEO_RPC_RETRY_ATTEMPTS = previousAttempts;
  }
});

test("RPCClient retries transient raw transaction submission failures", async () => {
  const client = new Neon.rpc.RPCClient("http://example.invalid");
  let attempts = 0;
  client.inner = {
    async sendRawTransaction(payload) {
      attempts += 1;
      if (attempts === 1) throw new Error("This operation was aborted");
      return { hash: "0xabc", payload };
    },
  };

  const result = await client.sendRawTransaction("001122");

  assert.equal(attempts, 2);
  assert.equal(result.hash, "0xabc");
});

test("RPCClient treats duplicate raw transaction submission as accepted when txid is available", async () => {
  const client = new Neon.rpc.RPCClient("http://example.invalid");
  client.inner = {
    async sendRawTransaction() {
      throw new Error("Inventory already exists - AlreadyExists");
    },
  };
  const tx = {
    serialize() {
      return "001122";
    },
    hash() {
      return "0xduplicate";
    },
  };

  const result = await client.sendRawTransaction(tx);

  assert.deepEqual(result, { hash: "0xduplicate", alreadyAccepted: true });
});
