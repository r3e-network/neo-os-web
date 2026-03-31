import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { permissionEnabled } from "./apps.ts";

// ---------------------------------------------------------------------------
// permissionEnabled
// ---------------------------------------------------------------------------

Deno.test("permissionEnabled returns true for boolean true", () => {
  assertEquals(permissionEnabled({ payments: true }, "payments"), true);
});

Deno.test("permissionEnabled returns false for boolean false", () => {
  assertEquals(permissionEnabled({ payments: false }, "payments"), false);
});

Deno.test("permissionEnabled returns true for non-empty array", () => {
  assertEquals(
    permissionEnabled({ wallet: ["read-address"] }, "wallet"),
    true,
  );
});

Deno.test("permissionEnabled returns false for empty array", () => {
  assertEquals(permissionEnabled({ wallet: [] }, "wallet"), false);
});

Deno.test("permissionEnabled returns false for undefined permissions object", () => {
  assertEquals(permissionEnabled(undefined, "payments"), false);
});

Deno.test("permissionEnabled returns false for missing key", () => {
  assertEquals(permissionEnabled({ storage: true }, "payments"), false);
});

Deno.test("permissionEnabled returns false for string value (non-boolean, non-array)", () => {
  assertEquals(permissionEnabled({ payments: "yes" as unknown }, "payments"), false);
});

Deno.test("permissionEnabled returns false for numeric value", () => {
  assertEquals(permissionEnabled({ payments: 1 as unknown }, "payments"), false);
});

Deno.test("permissionEnabled returns false for null value", () => {
  assertEquals(permissionEnabled({ payments: null as unknown }, "payments"), false);
});

Deno.test("permissionEnabled handles multiple permissions correctly", () => {
  const perms = { payments: true, wallet: ["read-address"], storage: false, rng: true };
  assertEquals(permissionEnabled(perms, "payments"), true);
  assertEquals(permissionEnabled(perms, "wallet"), true);
  assertEquals(permissionEnabled(perms, "storage"), false);
  assertEquals(permissionEnabled(perms, "rng"), true);
  assertEquals(permissionEnabled(perms, "oracle"), false);
});
