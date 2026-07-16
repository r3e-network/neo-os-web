import assert from "node:assert/strict";
import test from "node:test";

import { evaluateRuntimeHealth } from "../live_validate_morpheus_game_liveness.mjs";

test("accepts a ready runtime only when the response network matches the URL lane", () => {
  const result = evaluateRuntimeHealth(
    "https://oracle.meshmini.app/testnet/health",
    { ok: true, status: 200 },
    { status: "ok", ready: true, network: "testnet" },
  );

  assert.equal(result.ready, true);
  assert.equal(result.expectedNetwork, "testnet");
  assert.equal(result.actualNetwork, "testnet");
});

test("rejects a mainnet runtime returned from the testnet lane", () => {
  const result = evaluateRuntimeHealth(
    "https://edge.meshmini.app/testnet/health",
    { ok: true, status: 200 },
    { status: "ok", ready: true, network: "mainnet" },
  );

  assert.equal(result.ready, false);
  assert.equal(result.expectedNetwork, "testnet");
  assert.equal(result.actualNetwork, "mainnet");
});

test("rejects unhealthy or network-less runtime responses", () => {
  assert.equal(
    evaluateRuntimeHealth(
      "https://oracle.meshmini.app/testnet/health",
      { ok: true, status: 200 },
      { status: "error", ready: false, network: "testnet" },
    ).ready,
    false,
  );
  assert.equal(
    evaluateRuntimeHealth(
      "https://oracle.meshmini.app/testnet/health",
      { ok: true, status: 200 },
      { status: "ok", ready: true },
    ).ready,
    false,
  );
});
