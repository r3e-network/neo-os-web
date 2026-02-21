import { assertEquals, assertThrows } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { canonicalizeMiniAppManifest } from "./manifest.ts";

const baseManifest = {
  app_id: "demo-app",
  entry_url: "https://example.com/app",
  developer_pubkey: "0x11",
};

const sampleContractHash = "0x1111111111111111111111111111111111111111";

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
