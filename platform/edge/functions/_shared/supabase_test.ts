import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { hasAdminClaims } from "./supabase.ts";

// ---------------------------------------------------------------------------
// hasAdminClaims — audit H3: only app_metadata is a trusted role source.
// Supabase user_metadata is self-service editable by the user, so a
// user_metadata role claim must NEVER satisfy the admin gate.
// ---------------------------------------------------------------------------

Deno.test("hasAdminClaims accepts app_metadata role admin", () => {
  assertEquals(hasAdminClaims({ app_metadata: { role: "admin" } }), true);
});

Deno.test("hasAdminClaims accepts app_metadata roles array with super_admin and wildcard", () => {
  assertEquals(hasAdminClaims({ app_metadata: { roles: ["super_admin"] } }), true);
  assertEquals(hasAdminClaims({ app_metadata: { roles: ["*"] } }), true);
});

Deno.test("hasAdminClaims normalizes case and whitespace", () => {
  assertEquals(hasAdminClaims({ app_metadata: { role: "  Admin " } }), true);
});

Deno.test("hasAdminClaims rejects user_metadata role claims (self-service editable)", () => {
  // The H3 exploit shape: a user sets their own user_metadata.role = "admin".
  assertEquals(hasAdminClaims({ user_metadata: { role: "admin" } }), false);
  assertEquals(hasAdminClaims({ user_metadata: { roles: ["admin", "super_admin"] } }), false);
  assertEquals(hasAdminClaims({ user_metadata: { role: "*" } }), false);
});

Deno.test("hasAdminClaims rejects non-admin and missing metadata", () => {
  assertEquals(hasAdminClaims({ app_metadata: { role: "user" } }), false);
  assertEquals(hasAdminClaims({}), false);
  assertEquals(hasAdminClaims({ app_metadata: null, user_metadata: null }), false);
});
