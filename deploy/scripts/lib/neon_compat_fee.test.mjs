import test from "node:test";
import assert from "node:assert/strict";

import Neon, { estimateNetworkFee, NETWORK_FEE_FALLBACK_ENV } from "./neon-compat.mjs";

function fakeRpcClient(calculateNetworkFee) {
  return { inner: { calculateNetworkFee } };
}

function captureWarnings() {
  const warnings = [];
  const original = console.warn;
  console.warn = (message) => warnings.push(String(message));
  return {
    warnings,
    restore: () => {
      console.warn = original;
    },
  };
}

test("estimateNetworkFee returns the node-calculated fee on success", async () => {
  const client = fakeRpcClient(async () => ({ networkfee: "123456" }));
  assert.equal(await estimateNetworkFee(client, "00aabb", { env: {} }), 123456n);
});

test("estimateNetworkFee retries transient failures before succeeding", async () => {
  let attempts = 0;
  const client = fakeRpcClient(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("This operation was aborted");
    return { networkfee: "777" };
  });
  assert.equal(await estimateNetworkFee(client, "00aabb", { env: {} }), 777n);
  assert.equal(attempts, 2);
});

test("estimateNetworkFee FAILS (no silent flat fee) when the RPC keeps erroring and no fallback env is set", async () => {
  const client = fakeRpcClient(async () => {
    throw new Error("calculatenetworkfee not supported");
  });
  await assert.rejects(
    () => estimateNetworkFee(client, "00aabb", { env: {} }),
    new RegExp(`calculatenetworkfee failed: .*set ${NETWORK_FEE_FALLBACK_ENV}`)
  );
});

test("opt-in fallback env substitutes the flat default fee with a warning", async () => {
  const { warnings, restore } = captureWarnings();
  try {
    const client = fakeRpcClient(async () => {
      throw new Error("boom");
    });
    const fee = await estimateNetworkFee(client, "00aabb", {
      env: { [NETWORK_FEE_FALLBACK_ENV]: "1" },
    });
    assert.equal(fee, 5000000n);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /\[neon-compat\] calculatenetworkfee failed \(boom\)/);
    assert.match(warnings[0], /5000000 datoshi/);
  } finally {
    restore();
  }
});

test("fallback env accepts an explicit datoshi amount and rejects garbage", async () => {
  const failing = () => {
    throw new Error("down");
  };
  const { restore } = captureWarnings();
  try {
    assert.equal(
      await estimateNetworkFee(fakeRpcClient(failing), "00", {
        env: { [NETWORK_FEE_FALLBACK_ENV]: "250000" },
      }),
      250000n
    );
  } finally {
    restore();
  }
  await assert.rejects(
    () =>
      estimateNetworkFee(fakeRpcClient(failing), "00", {
        env: { [NETWORK_FEE_FALLBACK_ENV]: "lots" },
      }),
    new RegExp(`${NETWORK_FEE_FALLBACK_ENV} must be "1" or a positive datoshi integer`)
  );
});

test("sc.ContractParam exposes the bool alias without mutating the shared base class", async () => {
  const { ContractParam } = await import("@r3e/neo-js-sdk/compat/contract-param");
  assert.equal(typeof Neon.sc.ContractParam.bool, "function");
  // The wrapper still produces real ContractParam values…
  const param = Neon.sc.ContractParam.bool(true);
  assert.deepEqual(param.toJson ? param.toJson() : param.toJSON(), ContractParam.boolean(true).toJson ? ContractParam.boolean(true).toJson() : ContractParam.boolean(true).toJSON());
  // …but the imported base class is left untouched (no module side effect).
  assert.equal(Object.prototype.hasOwnProperty.call(ContractParam, "bool"), false);
  // Statics are inherited.
  assert.equal(typeof Neon.sc.ContractParam.hash160, "function");
  assert.equal(typeof Neon.sc.ContractParam.integer, "function");
});
