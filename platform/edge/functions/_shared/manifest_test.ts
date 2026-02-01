import { assertEquals, assertThrows } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { canonicalizeMiniAppManifest } from "./manifest.ts";

const baseManifest = {
  app_id: "demo-app",
  entry_url: "https://example.com/app",
  developer_pubkey: "0x11",
  supported_chains: ["neo-n3-mainnet"],
};

const sampleContractAddress = "0x1111111111111111111111111111111111111111";

Deno.test("canonicalizeMiniAppManifest requires supported_chains", () => {
  assertThrows(
    () => canonicalizeMiniAppManifest({ ...baseManifest, supported_chains: [] }),
    Error,
    "manifest.supported_chains required",
  );
});

Deno.test("canonicalizeMiniAppManifest allows missing contract address when news disabled", () => {
  const out = canonicalizeMiniAppManifest({
    ...baseManifest,
    news_integration: false,
    contracts: { "neo-n3-mainnet": { address: null } },
  });
  assertEquals(out.news_integration, false);
  assertEquals("contracts" in out, true);
});

Deno.test("canonicalizeMiniAppManifest requires contract address when stats enabled", () => {
  assertThrows(
    () =>
      canonicalizeMiniAppManifest({
        ...baseManifest,
        news_integration: false,
        stats_display: ["total_transactions"],
        contracts: { "neo-n3-mainnet": { address: null } },
      }),
    Error,
    "manifest.contracts address required",
  );
});

Deno.test("canonicalizeMiniAppManifest normalizes contract address", () => {
  const out = canonicalizeMiniAppManifest({
    ...baseManifest,
    news_integration: false,
    contracts: { "neo-n3-mainnet": { address: sampleContractAddress } },
  });
  const contracts = out.contracts as Record<string, { address: string }>;
  assertEquals(contracts["neo-n3-mainnet"].address, sampleContractAddress.replace(/^0x/i, "").toLowerCase());
});
