import test from "node:test";
import assert from "node:assert/strict";

import { createLiveRpc, isTransientRpcError } from "./live_rpc.mjs";

/* ── offline fakes ─────────────────────────────────────────────────────── */

class FakeTransaction {
  constructor(opts) {
    Object.assign(this, opts);
    this.signMagics = [];
  }
  sign(_account, magic) {
    this.signMagics.push(magic);
  }
}

const fakeNeon = {
  rpc: {
    RPCClient: class {
      constructor(url) {
        this.url = url;
      }
    },
  },
  sc: {
    createScript: ({ operation }) => `script:${operation}`,
  },
  tx: {
    Signer: { fromJson: (json) => json },
    Transaction: FakeTransaction,
  },
  u: {
    HexString: { fromHex: (hex) => hex },
    BigInteger: { fromNumber: (n) => BigInt(Math.trunc(Number(n))) },
  },
};

const ACCOUNT = { scriptHash: "ab".repeat(20) };
const noSleep = async () => {};
const quietLogger = { log: () => {}, warn: () => {} };

function makeRpc({ clients, urls = ["https://node-a", "https://node-b"], ...overrides } = {}) {
  let created = [];
  const rpc = createLiveRpc({
    neon: fakeNeon,
    env: {},
    rpcUrls: urls,
    networkMagic: 999,
    sleep: noSleep,
    retryDelayMs: 0,
    confirmPollMs: 0,
    confirmTimeoutMs: 500,
    logger: quietLogger,
    createClient: (url) => {
      const client = clients ? clients(url) : {};
      created.push({ url, client });
      return client;
    },
    ...overrides,
  });
  return { rpc, created };
}

/* ── tests ─────────────────────────────────────────────────────────────── */

test("isTransientRpcError classifies network noise but not contract FAULTs", () => {
  assert.equal(isTransientRpcError(new Error("fetch failed")), true);
  assert.equal(isTransientRpcError(new Error("read ECONNRESET")), true);
  assert.equal(isTransientRpcError(new Error("HTTP 503")), true);
  assert.equal(isTransientRpcError(new Error("insufficient prepaid gas")), false);
});

test("readStack returns the stack on HALT and throws naming the method on FAULT", async () => {
  const { rpc } = makeRpc({
    clients: () => ({
      invokeFunction: async (hash, method) =>
        method === "creditOf"
          ? { state: "HALT", stack: [{ type: "Integer", value: "7" }] }
          : { state: "FAULT", exception: "boom" },
    }),
  });

  const stack = await rpc.readStack("0xc0ffee", "creditOf", []);
  assert.equal(stack[0].value, "7");
  await assert.rejects(() => rpc.readStack("0xc0ffee", "broken", []), /broken FAULT: boom/);
});

test("retry rotates to the next endpoint on transient errors and succeeds", async () => {
  const callsByUrl = [];
  const { rpc } = makeRpc({
    clients: (url) => ({
      invokeFunction: async () => {
        callsByUrl.push(url);
        if (url === "https://node-a") throw new Error("fetch failed");
        return { state: "HALT", stack: [] };
      },
    }),
  });

  const result = await rpc.readInvoke("0xc0ffee", "anything", []);
  assert.equal(result.state, "HALT");
  assert.deepEqual(callsByUrl, ["https://node-a", "https://node-b"]);
  assert.equal(rpc.rpcUrl, "https://node-b");
});

test("retry gives up after the configured attempts and wraps the error with the step label", async () => {
  let attempts = 0;
  const { rpc } = makeRpc({
    urls: ["https://only-node"],
    retryAttempts: 3,
    clients: () => ({
      invokeFunction: async () => {
        attempts += 1;
        throw new Error("fetch failed");
      },
    }),
  });

  await assert.rejects(() => rpc.readInvoke("0xc0ffee", "balanceOf", []), /read\.balanceOf: fetch failed/);
  assert.equal(attempts, 3);
});

test("invokeAndConfirm runs the full fee/sign/broadcast/confirm loop", async () => {
  const sent = [];
  let logPolls = 0;
  const { rpc } = makeRpc({
    urls: ["https://node-a"],
    clients: () => ({
      getBlockCount: async () => 100,
      invokeScript: async (script, signers) => {
        assert.equal(script, "script:claim");
        assert.equal(signers[0].scopes, "CalledByEntry");
        assert.equal(signers[0].account, `0x${ACCOUNT.scriptHash}`);
        return { state: "HALT", gasconsumed: "123456" };
      },
      calculateNetworkFee: async (txn) => {
        // provisional witness must exist before fee calculation
        assert.equal(txn.signMagics.length, 1);
        return 98765;
      },
      sendRawTransaction: async (txn) => {
        sent.push(txn);
        return "0x" + "11".repeat(32);
      },
      getApplicationLog: async () => {
        logPolls += 1;
        if (logPolls === 1) throw new Error("Unknown script container");
        return {
          executions: [{ vmstate: "HALT", notifications: [{ eventname: "Claimed" }] }],
        };
      },
    }),
  });

  const { txid, log, execution } = await rpc.invokeAndConfirm({
    label: "claim1",
    account: ACCOUNT,
    scriptHash: "0xc0ffee",
    operation: "claim",
    args: [],
  });

  assert.equal(txid, "0x" + "11".repeat(32));
  assert.equal(execution.vmstate, "HALT");
  assert.equal(log.executions[0].notifications[0].eventname, "Claimed");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].validUntilBlock, 150);
  assert.equal(sent[0].systemFee, 123456n);
  assert.equal(sent[0].networkFee, 98765n);
  assert.deepEqual(sent[0].signMagics, [999, 999]); // provisional + final, both with the magic
});

test("invokeAndConfirm refuses to broadcast when the test-invoke FAULTs", async () => {
  let broadcasts = 0;
  const { rpc } = makeRpc({
    urls: ["https://node-a"],
    clients: () => ({
      getBlockCount: async () => 100,
      invokeScript: async () => ({ state: "FAULT", exception: "insufficient prepaid gas" }),
      sendRawTransaction: async () => {
        broadcasts += 1;
        return "0xdead";
      },
    }),
  });

  await assert.rejects(
    () =>
      rpc.invokeAndConfirm({
        label: "deposit",
        account: ACCOUNT,
        scriptHash: "0xc0ffee",
        operation: "deposit",
      }),
    /deposit test-invoke FAULT: insufficient prepaid gas/
  );
  assert.equal(broadcasts, 0);
});

test("invokeAndConfirm surfaces an on-chain FAULT from the application log", async () => {
  const { rpc } = makeRpc({
    urls: ["https://node-a"],
    clients: () => ({
      getBlockCount: async () => 100,
      invokeScript: async () => ({ state: "HALT", gasconsumed: "1" }),
      calculateNetworkFee: async () => 1,
      sendRawTransaction: async () => "0xfeed",
      getApplicationLog: async () => ({
        executions: [{ vmstate: "FAULT", exception: "credit underflow" }],
      }),
    }),
  });

  await assert.rejects(
    () =>
      rpc.invokeAndConfirm({
        label: "claim2",
        account: ACCOUNT,
        scriptHash: "0xc0ffee",
        operation: "claim",
      }),
    /claim2 FAULT: "credit underflow"/
  );
});

test("testInvoke probes guards with a CalledByEntry signer without broadcasting", async () => {
  let invoked;
  const { rpc } = makeRpc({
    urls: ["https://node-a"],
    clients: () => ({
      invokeScript: async (script, signers) => {
        invoked = { script, signers };
        return { state: "FAULT", exception: "not yet unlocked" };
      },
    }),
  });

  const result = await rpc.testInvoke(ACCOUNT, "0xc0ffee", "reveal", []);
  assert.equal(result.state, "FAULT");
  assert.equal(invoked.script, "script:reveal");
  assert.equal(invoked.signers[0].account, `0x${ACCOUNT.scriptHash}`);
});

test("nep17BalanceOf decodes the integer stack head", async () => {
  const { rpc } = makeRpc({
    urls: ["https://node-a"],
    clients: () => ({
      invokeFunction: async (hash, method, params) => {
        assert.equal(method, "balanceOf");
        assert.deepEqual(params[0], { type: "Hash160", value: "cafe" });
        return { state: "HALT", stack: [{ type: "Integer", value: "42" }] };
      },
    }),
  });
  assert.equal(await rpc.nep17BalanceOf("0xgas", "cafe"), 42n);
});

test("endpoints resolve from NEO_RPC_ENDPOINTS env when no explicit urls are given", () => {
  const rpc = createLiveRpc({
    neon: fakeNeon,
    env: { NEO_RPC_ENDPOINTS: " https://x , https://y " },
    networkMagic: 999,
    sleep: noSleep,
    logger: quietLogger,
    createClient: () => ({}),
  });
  assert.deepEqual(rpc.endpoints, ["https://x", "https://y"]);
  assert.equal(rpc.rpcUrl, "https://x");
});
