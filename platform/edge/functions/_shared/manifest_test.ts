import { assertEquals, assertThrows } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { stableStringify, canonicalizeMiniAppManifest, computeSHA256Hex } from "./manifest.ts";

// ---------------------------------------------------------------------------
// stableStringify
// ---------------------------------------------------------------------------

Deno.test("stableStringify produces deterministic output for same input", () => {
  const obj = { b: 2, a: 1, c: 3 };
  const first = stableStringify(obj);
  const second = stableStringify(obj);
  assertEquals(first, second);
});

Deno.test("stableStringify sorts keys alphabetically", () => {
  const result = stableStringify({ z: 1, a: 2, m: 3 });
  assertEquals(result, '{"a":2,"m":3,"z":1}');
});

Deno.test("stableStringify produces same output regardless of key insertion order", () => {
  const a = stableStringify({ x: 1, y: 2 });
  const b = stableStringify({ y: 2, x: 1 });
  assertEquals(a, b);
});

Deno.test("stableStringify handles nested objects with sorted keys", () => {
  const result = stableStringify({ b: { d: 1, c: 2 }, a: 3 });
  assertEquals(result, '{"a":3,"b":{"c":2,"d":1}}');
});

Deno.test("stableStringify handles arrays preserving order", () => {
  const result = stableStringify([3, 1, 2]);
  assertEquals(result, "[3,1,2]");
});

Deno.test("stableStringify handles null", () => {
  assertEquals(stableStringify(null), "null");
});

Deno.test("stableStringify handles undefined", () => {
  assertEquals(stableStringify(undefined), "null");
});

Deno.test("stableStringify handles strings", () => {
  assertEquals(stableStringify("hello"), '"hello"');
});

Deno.test("stableStringify handles numbers", () => {
  assertEquals(stableStringify(42), "42");
});

Deno.test("stableStringify handles booleans", () => {
  assertEquals(stableStringify(true), "true");
  assertEquals(stableStringify(false), "false");
});

Deno.test("stableStringify handles empty object", () => {
  assertEquals(stableStringify({}), "{}");
});

Deno.test("stableStringify handles empty array", () => {
  assertEquals(stableStringify([]), "[]");
});

Deno.test("stableStringify handles mixed nested structures", () => {
  const obj = { arr: [1, { z: true, a: false }], str: "test" };
  const result = stableStringify(obj);
  assertEquals(result, '{"arr":[1,{"a":false,"z":true}],"str":"test"}');
});

// ---------------------------------------------------------------------------
// canonicalizeMiniAppManifest — input validation
// ---------------------------------------------------------------------------

const baseManifest = {
  app_id: "demo-app",
  entry_url: "https://example.com/app",
  developer_pubkey: "0x11",
};

const sampleContractHash = "0x1111111111111111111111111111111111111111";

Deno.test("canonicalizeMiniAppManifest throws on non-object input", () => {
  assertThrows(
    () => canonicalizeMiniAppManifest("not-an-object"),
    Error,
    "manifest must be an object",
  );
});

Deno.test("canonicalizeMiniAppManifest throws on array input", () => {
  assertThrows(
    () => canonicalizeMiniAppManifest([1, 2, 3]),
    Error,
    "manifest must be an object",
  );
});

Deno.test("canonicalizeMiniAppManifest throws on null input", () => {
  assertThrows(
    () => canonicalizeMiniAppManifest(null),
    Error,
    "manifest must be an object",
  );
});

Deno.test("canonicalizeMiniAppManifest requires app_id", () => {
  assertThrows(
    () => canonicalizeMiniAppManifest({ entry_url: "https://example.com", developer_pubkey: "aa" }),
    Error,
    "manifest.app_id required",
  );
});

Deno.test("canonicalizeMiniAppManifest requires entry_url", () => {
  assertThrows(
    () => canonicalizeMiniAppManifest({ app_id: "test-app", developer_pubkey: "aa" }),
    Error,
    "manifest.entry_url required",
  );
});

Deno.test("canonicalizeMiniAppManifest requires developer_pubkey", () => {
  assertThrows(
    () => canonicalizeMiniAppManifest({ app_id: "test-app", entry_url: "https://example.com" }),
    Error,
    "manifest.developer_pubkey required",
  );
});

// ---------------------------------------------------------------------------
// canonicalizeMiniAppManifest — normalization
// ---------------------------------------------------------------------------

Deno.test("canonicalizeMiniAppManifest normalizes developer_pubkey to lowercase hex", () => {
  const result = canonicalizeMiniAppManifest({
    ...baseManifest,
    developer_pubkey: "AABB",
    news_integration: false,
  });
  assertEquals(result.developer_pubkey, "aabb");
});

Deno.test("canonicalizeMiniAppManifest strips 0x prefix from developer_pubkey", () => {
  const result = canonicalizeMiniAppManifest({
    ...baseManifest,
    developer_pubkey: "0xAABB",
    news_integration: false,
  });
  assertEquals(result.developer_pubkey, "aabb");
});

Deno.test("canonicalizeMiniAppManifest trims string fields", () => {
  const result = canonicalizeMiniAppManifest({
    app_id: "  my-app  ",
    entry_url: "  https://example.com  ",
    developer_pubkey: "aabb",
    name: "  My App  ",
    description: "  A cool app  ",
    news_integration: false,
  });
  assertEquals(result.app_id, "my-app");
  assertEquals(result.entry_url, "https://example.com");
  assertEquals(result.name, "My App");
  assertEquals(result.description, "A cool app");
});

// ---------------------------------------------------------------------------
// canonicalizeMiniAppManifest — permissions
// ---------------------------------------------------------------------------

Deno.test("canonicalizeMiniAppManifest normalizes permissions from array form", () => {
  const result = canonicalizeMiniAppManifest({
    ...baseManifest,
    news_integration: false,
    permissions: ["payments", "rng"],
  });
  const perms = result.permissions as Record<string, unknown>;
  assertEquals(perms.payments, true);
  assertEquals(perms.rng, true);
});

Deno.test("canonicalizeMiniAppManifest normalizes wallet permission from array to scoped array", () => {
  const result = canonicalizeMiniAppManifest({
    ...baseManifest,
    news_integration: false,
    permissions: ["wallet"],
  });
  const perms = result.permissions as Record<string, unknown>;
  assertEquals(perms.wallet, ["read-address"]);
});

Deno.test("canonicalizeMiniAppManifest normalizes permissions from object form", () => {
  const result = canonicalizeMiniAppManifest({
    ...baseManifest,
    news_integration: false,
    permissions: { payments: true, storage: true },
  });
  const perms = result.permissions as Record<string, unknown>;
  assertEquals(perms.payments, true);
  assertEquals(perms.storage, true);
});

Deno.test("canonicalizeMiniAppManifest normalizes wallet boolean true to scoped array", () => {
  const result = canonicalizeMiniAppManifest({
    ...baseManifest,
    news_integration: false,
    permissions: { wallet: true },
  });
  const perms = result.permissions as Record<string, unknown>;
  assertEquals(perms.wallet, ["read-address"]);
});

Deno.test("canonicalizeMiniAppManifest normalizes null permission value to false", () => {
  const result = canonicalizeMiniAppManifest({
    ...baseManifest,
    news_integration: false,
    permissions: { payments: null },
  });
  const perms = result.permissions as Record<string, unknown>;
  assertEquals(perms.payments, false);
});

Deno.test("canonicalizeMiniAppManifest rejects unsupported permission key", () => {
  assertThrows(
    () =>
      canonicalizeMiniAppManifest({
        ...baseManifest,
        news_integration: false,
        permissions: ["invalid_perm"],
      }),
    Error,
    "unsupported permission",
  );
});

// ---------------------------------------------------------------------------
// canonicalizeMiniAppManifest — category
// ---------------------------------------------------------------------------

Deno.test("canonicalizeMiniAppManifest normalizes category to lowercase", () => {
  const result = canonicalizeMiniAppManifest({
    ...baseManifest,
    news_integration: false,
    category: "GAMING",
  });
  assertEquals(result.category, "gaming");
});

Deno.test("canonicalizeMiniAppManifest rejects unsupported category", () => {
  assertThrows(
    () =>
      canonicalizeMiniAppManifest({
        ...baseManifest,
        news_integration: false,
        category: "unknown-category",
      }),
    Error,
    "manifest.category must be one of",
  );
});

// ---------------------------------------------------------------------------
// canonicalizeMiniAppManifest — limits
// ---------------------------------------------------------------------------

Deno.test("canonicalizeMiniAppManifest normalizes limits values to trimmed strings", () => {
  const result = canonicalizeMiniAppManifest({
    ...baseManifest,
    news_integration: false,
    limits: { max_gas_per_tx: "  0.5  ", daily_gas_cap_per_user: "10" },
  });
  const limits = result.limits as Record<string, unknown>;
  assertEquals(limits.max_gas_per_tx, "0.5");
  assertEquals(limits.daily_gas_cap_per_user, "10");
});

Deno.test("canonicalizeMiniAppManifest rejects non-object limits", () => {
  assertThrows(
    () =>
      canonicalizeMiniAppManifest({
        ...baseManifest,
        news_integration: false,
        limits: "not-an-object",
      }),
    Error,
    "manifest.limits must be an object",
  );
});

// ---------------------------------------------------------------------------
// canonicalizeMiniAppManifest — contract_hash
// ---------------------------------------------------------------------------

Deno.test("canonicalizeMiniAppManifest requires contract_hash by default", () => {
  assertThrows(
    () => canonicalizeMiniAppManifest({ ...baseManifest }),
    Error,
    "manifest.contract_hash required",
  );
});

Deno.test("canonicalizeMiniAppManifest allows missing contract_hash when news disabled", () => {
  const out = canonicalizeMiniAppManifest({ ...baseManifest, news_integration: false });
  assertEquals(out.news_integration, false);
  assertEquals("contract_hash" in out, false);
});

Deno.test("canonicalizeMiniAppManifest requires contract_hash when stats enabled", () => {
  assertThrows(
    () =>
      canonicalizeMiniAppManifest({
        ...baseManifest,
        news_integration: false,
        stats_display: ["total_transactions"],
      }),
    Error,
    "manifest.contract_hash required",
  );
});

Deno.test("canonicalizeMiniAppManifest normalizes contract_hash", () => {
  const out = canonicalizeMiniAppManifest({
    ...baseManifest,
    news_integration: false,
    contract_hash: sampleContractHash,
  });
  assertEquals(out.contract_hash, sampleContractHash.replace(/^0x/i, "").toLowerCase());
});

// ---------------------------------------------------------------------------
// canonicalizeMiniAppManifest — stats_display
// ---------------------------------------------------------------------------

Deno.test("canonicalizeMiniAppManifest normalizes stats_display aliases", () => {
  const out = canonicalizeMiniAppManifest({
    ...baseManifest,
    contract_hash: sampleContractHash,
    stats_display: ["tx_count", "gas_burned"],
  });
  const stats = out.stats_display as string[];
  assertEquals(stats.includes("total_transactions"), true);
  assertEquals(stats.includes("total_gas_used"), true);
});

Deno.test("canonicalizeMiniAppManifest rejects unsupported stats key", () => {
  assertThrows(
    () =>
      canonicalizeMiniAppManifest({
        ...baseManifest,
        contract_hash: sampleContractHash,
        stats_display: ["unknown_key"],
      }),
    Error,
    "unsupported key",
  );
});

// ---------------------------------------------------------------------------
// computeSHA256Hex
// ---------------------------------------------------------------------------

Deno.test("computeSHA256Hex returns consistent hash for same input", async () => {
  const hash1 = await computeSHA256Hex("hello world");
  const hash2 = await computeSHA256Hex("hello world");
  assertEquals(hash1, hash2);
});

Deno.test("computeSHA256Hex returns 64-char lowercase hex string", async () => {
  const hash = await computeSHA256Hex("test");
  assertEquals(hash.length, 64);
  assertEquals(hash, hash.toLowerCase());
  assertEquals(/^[0-9a-f]{64}$/.test(hash), true);
});

Deno.test("computeSHA256Hex returns different hashes for different inputs", async () => {
  const hash1 = await computeSHA256Hex("hello");
  const hash2 = await computeSHA256Hex("world");
  assertEquals(hash1 !== hash2, true);
});
