import test from "node:test";
import assert from "node:assert/strict";
import {
  checkLiveState,
  decodeRpcBoolean,
  decodeRpcInteger,
  decodeRpcValue,
  preflightDescriptorUpdates,
} from "../audit_platform_game_live_state.mjs";

const HASH = "0x1111111111111111111111111111111111111111";
const ENGINE = "0xc75b181b4561462903bb27d8d9e0b32b637bec12";

function stack(type, value) {
  return { type, value };
}

function reads(overrides = {}) {
  const defaults = {
    getGameType: { ok: true, stack: [stack("Integer", "5")] },
    isGameActive: { ok: true, stack: [stack("Boolean", true)] },
    isPaused: { ok: true, stack: [stack("Boolean", false)] },
    getGameAdmin: { ok: true, stack: [stack("Hash160", HASH)] },
    getGameConfig: { ok: true, stack: [stack("ByteArray", "AQID")] },
    poolBalance: { ok: true, stack: [stack("Integer", "100")] },
    reservedPool: { ok: true, stack: [stack("Integer", "40")] },
    freePool: { ok: true, stack: [stack("Integer", "60")] },
    heldForApp: { ok: true, stack: [stack("Integer", "100")] },
  };
  return { ...defaults, ...overrides };
}

test("decodes scalar RPC values without exposing byte payloads", () => {
  assert.equal(decodeRpcInteger(stack("Integer", "42")), 42n);
  assert.equal(decodeRpcBoolean(stack("Boolean", false)), false);
  assert.equal(decodeRpcValue(stack("Hash160", HASH)), HASH);
  assert.equal(
    decodeRpcValue(stack("ByteString", "CqiyUBK3xeqpSEaj+XMpNpxR7xM=")),
    "0x13ef519c362973f9a34648a9eac5b71250b2a80a",
  );
  assert.deepEqual(decodeRpcValue(stack("ByteArray", "AQID")), {
    type: "ByteArray",
    byte_length: 3,
  });
});

test("accepts a complete active PlatformGame app state", () => {
  const result = checkLiveState({
    expectedEngine: ENGINE,
    attachment: {
      status: "attached",
      app_row: ["platform-game", ENGINE, HASH, "0x0000000000000000000000000000000000000000", false, true],
    },
    appId: "miniapp-example",
    reads: reads(),
    expectedDescriptors: { limitMs0: 60_000 },
    descriptorReads: {
      limitMs0: { ok: true, stack: [stack("Integer", "60000")] },
    },
  });
  assert.equal(result.live_state_ready, true);
  assert.deepEqual(result.blockers, []);
});

test("fails closed when a registry descriptor differs from the manifest", () => {
  const result = checkLiveState({
    expectedEngine: ENGINE,
    attachment: {
      status: "attached",
      app_row: ["platform-game", ENGINE, HASH, "0x0000000000000000000000000000000000000000", false, true],
    },
    appId: "miniapp-example",
    reads: reads(),
    expectedDescriptors: { limitMs0: 60_000, targetScore0: 3 },
    descriptorReads: {
      limitMs0: { ok: true, stack: [stack("Integer", "120000")] },
      targetScore0: { ok: true, stack: [stack("Integer", "3")] },
    },
  });
  assert.equal(result.live_state_ready, false);
  assert.ok(result.blockers.includes("descriptor_values_match_manifest"));
  assert.equal(result.descriptor_match_count, 1);
});

test("preflights only mismatched descriptors with the public app admin", async () => {
  const calls = [];
  const result = await preflightDescriptorUpdates({
    live: {
      testInvoke: async (account, scriptHash, operation, args) => {
        calls.push({ account, scriptHash, operation, args });
        return { state: "HALT", gasconsumed: "2300000" };
      },
    },
    registryHash: "0x2222222222222222222222222222222222222222",
    appId: "miniapp-example",
    appRow: ["platform-game", ENGINE, HASH, "0x0", false, true],
    expectedDescriptors: { limitMs0: 180000, targetScore0: 15 },
    descriptorValues: {
      limitMs0: { matches: false },
      targetScore0: { matches: true },
    },
  });
  assert.equal(result.status, "eligible");
  assert.equal(result.attempted, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].account.scriptHash, HASH.slice(2));
  assert.equal(calls[0].operation, "setDescriptor");
});

test("fails closed on paused, inactive, and inconsistent pool state", () => {
  const result = checkLiveState({
    expectedEngine: ENGINE,
    attachment: {
      status: "attached",
      app_row: ["platform-game", ENGINE, HASH, "0x0000000000000000000000000000000000000000", false, true],
    },
    appId: "miniapp-example",
    reads: reads({
      isGameActive: { ok: true, stack: [stack("Boolean", false)] },
      isPaused: { ok: true, stack: [stack("Boolean", true)] },
      reservedPool: { ok: true, stack: [stack("Integer", "120")] },
      heldForApp: { ok: true, stack: [stack("Integer", "80")] },
    }),
  });
  assert.equal(result.live_state_ready, false);
  assert.deepEqual(result.blockers, [
    "game_active",
    "app_not_paused",
    "pool_accounting",
    "held_for_app_covers_pool",
  ]);
});

test("fails closed when a required read faults", () => {
  const result = checkLiveState({
    expectedEngine: ENGINE,
    attachment: {
      status: "attached",
      app_row: ["platform-game", ENGINE, HASH, "0x0000000000000000000000000000000000000000", false, true],
    },
    appId: "miniapp-example",
    reads: reads({
      getGameConfig: { ok: false, stack: [], error: "FAULT" },
      poolBalance: { ok: false, stack: [], error: "RPC unavailable" },
    }),
  });
  assert.equal(result.live_state_ready, false);
  assert.ok(result.blockers.includes("game_config_readable"));
  assert.ok(result.blockers.includes("pool_values_readable"));
});
