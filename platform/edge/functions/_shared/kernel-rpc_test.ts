import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  buildKernelStateBatchWrite,
  buildKernelStateDelete,
  buildKernelStateRead,
  buildKernelStateWrite,
  getKernelHash,
  requireKernelHash,
} from "./kernel-rpc.ts";

const KERNEL_HASH = "0x1234567890abcdef1234567890abcdef12345678";

function clearKernelEnv() {
  Deno.env.delete("CONTRACT_MORPHEUS_ORACLE_HASH");
  Deno.env.delete("MORPHEUS_ORACLE_HASH");
}

function setProd(on: boolean) {
  if (on) {
    Deno.env.set("EDGE_ENV", "production");
  } else {
    Deno.env.delete("EDGE_ENV");
    Deno.env.delete("DENO_ENV");
    Deno.env.delete("ENV");
    Deno.env.delete("NODE_ENV");
    Deno.env.delete("SUPABASE_ENV");
  }
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

Deno.test("getKernelHash returns configured canonical hash", () => {
  clearKernelEnv();
  Deno.env.set("CONTRACT_MORPHEUS_ORACLE_HASH", KERNEL_HASH);
  assertEquals(getKernelHash(), KERNEL_HASH);
  clearKernelEnv();
});

Deno.test("getKernelHash falls back to legacy alias", () => {
  clearKernelEnv();
  Deno.env.set("MORPHEUS_ORACLE_HASH", KERNEL_HASH);
  assertEquals(getKernelHash(), KERNEL_HASH);
  clearKernelEnv();
});

Deno.test("getKernelHash returns empty string when unset (lenient)", () => {
  clearKernelEnv();
  assertEquals(getKernelHash(), "");
});

Deno.test("requireKernelHash throws in production when unset", () => {
  clearKernelEnv();
  setProd(true);
  assertThrows(
    () => requireKernelHash(),
    Error,
    "kernel contract hash not configured",
  );
  setProd(false);
});

Deno.test("requireKernelHash returns hash when configured (production)", () => {
  clearKernelEnv();
  setProd(true);
  Deno.env.set("CONTRACT_MORPHEUS_ORACLE_HASH", KERNEL_HASH);
  assertEquals(requireKernelHash(), KERNEL_HASH);
  clearKernelEnv();
  setProd(false);
});

// ---------------------------------------------------------------------------
// Write builders fail-fast (the security fix)
// ---------------------------------------------------------------------------

Deno.test("buildKernelStateWrite throws in production when kernel hash unset", () => {
  clearKernelEnv();
  setProd(true);
  assertThrows(
    () => buildKernelStateWrite("app1", "k", "v"),
    Error,
    "kernel contract hash not configured",
  );
  setProd(false);
});

Deno.test("buildKernelStateDelete throws in production when kernel hash unset", () => {
  clearKernelEnv();
  setProd(true);
  assertThrows(
    () => buildKernelStateDelete("app1", "k"),
    Error,
    "kernel contract hash not configured",
  );
  setProd(false);
});

Deno.test("buildKernelStateBatchWrite throws in production when kernel hash unset", () => {
  clearKernelEnv();
  setProd(true);
  assertThrows(
    () => buildKernelStateBatchWrite("app1", ["k"], ["v"]),
    Error,
    "kernel contract hash not configured",
  );
  setProd(false);
});

Deno.test("write builders embed the configured kernel hash (no empty contract)", () => {
  clearKernelEnv();
  setProd(true);
  Deno.env.set("CONTRACT_MORPHEUS_ORACLE_HASH", KERNEL_HASH);

  const write = buildKernelStateWrite("app1", "k", "v");
  assertEquals(write.contract, KERNEL_HASH);
  assertEquals(write.operation, "putMiniAppState");

  const del = buildKernelStateDelete("app1", "k");
  assertEquals(del.contract, KERNEL_HASH);
  assertEquals(del.operation, "deleteMiniAppState");

  const batch = buildKernelStateBatchWrite("app1", ["k"], ["v"]);
  assertEquals(batch.contract, KERNEL_HASH);
  assertEquals(batch.operation, "putMiniAppStateBatch");

  clearKernelEnv();
  setProd(false);
});

// ---------------------------------------------------------------------------
// Read intents stay lenient (intentional)
// ---------------------------------------------------------------------------

Deno.test("buildKernelStateRead stays lenient with empty hash (read intent)", () => {
  clearKernelEnv();
  setProd(true);
  const read = buildKernelStateRead("app1", "k");
  assertEquals(read.contract, "");
  assertEquals(read.operation, "getMiniAppState");
  setProd(false);
});
