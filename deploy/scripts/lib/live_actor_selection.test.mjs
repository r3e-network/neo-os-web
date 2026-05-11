import test from "node:test";
import assert from "node:assert/strict";

import actorSelection from "./live_actor_selection.js";

const { chooseNeoCapableActor } = actorSelection;

test("chooseNeoCapableActor selects the first configured actor with enough NEO", () => {
  const chosen = chooseNeoCapableActor([
    { label: "admin", address: "N-admin", neo: 0n },
    { label: "user", address: "N-user", neo: 9431n },
  ], 1n);

  assert.equal(chosen.label, "user");
  assert.equal(chosen.address, "N-user");
});

test("chooseNeoCapableActor reports all candidate NEO balances when no actor can fund the flow", () => {
  assert.throws(
    () => chooseNeoCapableActor([
      { label: "primary", address: "N-primary", neo: 0n },
      { label: "admin", address: "N-admin", neo: 0n },
    ], 1n),
    /primary N-primary has 0 NEO; admin N-admin has 0 NEO/,
  );
});
