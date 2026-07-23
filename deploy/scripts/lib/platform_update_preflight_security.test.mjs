import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..", "..");
const source = fs.readFileSync(
  path.join(repoRoot, "deploy/scripts/update_platform_contracts.go"),
  "utf8",
);

test("platform update dry-run accepts only a public identity when no WIF is configured", () => {
  assert.match(source, /PLATFORM_UPDATE_DRY_RUN_SIGNER/);
  assert.match(source, /create watch-only dry-run actor/);
  assert.match(source, /SignerInput:\s+signerInput/);
  assert.match(source, /DryRun:\s+dryRun/);
});

test("platform updater covers Registry and Factory without routing Registry to direct update", () => {
  assert.match(source, /Name:\s+"PlatformRegistry"/);
  assert.match(source, /Name:\s+"MiniAppFactory"/);
  assert.match(source, /Route:\s+"timelocked"/);
  assert.match(source, /PreflightMethod = "scheduleUpdate"/);
  assert.match(source, /schedule_platform_registry_update\.go/);
});

test("platform update preflight pins local and on-chain checksums", () => {
  assert.match(source, /OnChainNEFChecksum:\s+state\.NEF\.Checksum/);
  assert.match(source, /nef\.FileFromBytes/);
  assert.match(source, /ArtifactMatches/);
  assert.match(source, /checksum mismatch after update/);
});

test("testnet live target discovery cannot leak into mainnet updates", () => {
  assert.match(
    source,
    /if network == "testnet" \{\s+if data, err := os\.ReadFile\("docs\/reports\/platform-contract-testnet-live-latest\.json"\)/,
  );
  assert.match(source, /if network == "testnet" && deployed\.PlatformAnchor == ""/);
});
