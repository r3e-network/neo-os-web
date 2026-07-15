import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAssets,
  assertClasses,
  assertDispatches,
  assertMessageKeys,
  assertModernTypography,
  assertPlayStage,
  exists,
  read,
} from "./frontend_structure_helpers.mjs";

test("Unbreakable Vault ships a resource-led DeFi challenge with honest recovery", () => {
  const playArea = read("apps/unbreakable-vault/src/PlayArea.tsx");
  const styles = read("apps/unbreakable-vault/src/PlayArea.scss");
  const breaker = read("apps/unbreakable-vault/src/composables/useVaultBreaker.ts");
  const creator = read("apps/unbreakable-vault/src/composables/useVaultCreator.ts");
  const safety = read("apps/unbreakable-vault/src/composables/vaultSafety.ts");
  const chain = read("apps/unbreakable-vault/src/composables/vaultChain.ts");
  const messages = read("apps/unbreakable-vault/src/locale/messages.ts");
  const manifest = read("apps/unbreakable-vault/neo-manifest.json");
  const indexHtml = read("apps/unbreakable-vault/index.html");

  assertPlayStage(playArea, "defi", "Unbreakable Vault");
  assertClasses(playArea, [
    "vault-brk-scene",
    "vault-brk-scene__artwork",
    "vault-brk-scene__asset-caption",
    "vault-asset-journey",
    "vault-risk-summary",
    "vault-target-rail",
    "vault-target-lock",
    "vault-secret-console",
    "vault-operation-notice",
  ], "Unbreakable Vault");
  assertDispatches(playArea, [
    "loadVault",
    "attemptBreak",
    "createVault",
    "increaseBounty",
    "settleVault",
  ], "Unbreakable Vault");
  assert.match(playArea, /recoveryStorageHealthy \? "recoverPendingVault" : "refreshVaultRecoveryStorage"/);
  assert.match(playArea, /const VAULT_IMAGE = "vault-challenge\.webp"/);
  assert.match(playArea, /<CoinArt[\s\S]*variant="gas"/);
  assert.match(playArea, /recoveryStorageHealthy/);
  assert.doesNotMatch(playArea, /<svg|dangerouslySetInnerHTML|OpenUiSegmented/);
  assert.doesNotMatch(playArea, /[🔒🎮🪙🛡🎲🏆]/u);

  assert.match(safety, /const beginOperation = \(\) =>/);
  assert.match(safety, /const refreshRecoveryStorage = \(\) =>/);
  assert.match(safety, /if \(result\.txid\) persistAction\(draft, result\.txid\)/);
  assert.match(safety, /readVaultTransactionOutcome/);
  assert.match(safety, /result\.verified === true && result\.event/);
  assert.match(safety, /recoveryStorageHealthy\.set\(false\)/);
  assert.match(breaker, /assertAttemptSnapshot/);
  assert.match(breaker, /BigInt\(before\.bounty\) <= 0n/);
  assert.match(creator, /\^\[0-9a-f\]\{64\}\$/);
  assert.match(creator, /myVaultsReadError/);
  assert.match(chain, /Vault catalog read incomplete/);
  assert.doesNotMatch(`${breaker}\n${creator}\n${safety}`, /Math\.random\(/);

  assert.match(styles, /vault-brk-scene\s*\{[\s\S]*background:\s*#fffdf8/);
  assert.match(styles, /vault-brk-scene__artwork\s*\{[\s\S]*object-fit:\s*cover/);
  assert.match(styles, /\.unbreakable-vault-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 172px/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assertModernTypography(styles, "Unbreakable Vault");

  assertMessageKeys(messages, [
    "vaultHeroImageAlt",
    "riskSummaryTitle",
    "paymentRecoveryReady",
    "retryRecoveryStorage",
    "operationContextChanged",
    "transactionIdUnavailable",
    "catalogReadFailed",
  ], "Unbreakable Vault messages");
  assert.match(manifest, /"version": "1\.3\.0"/);
  assert.match(manifest, /"category": "defi"/);
  assert.match(manifest, /"icon": "\/miniapps\/unbreakable-vault\/logo\.webp"/);
  assert.match(manifest, /"banner": "\/miniapps\/unbreakable-vault\/banner\.webp"/);
  assert.match(indexHtml, /type="image\/webp" href="\.\/logo\.webp"/);
  assertAssets([
    "apps/unbreakable-vault/public/vault-challenge.webp",
    "apps/unbreakable-vault/public/banner.webp",
    "apps/unbreakable-vault/public/logo.webp",
  ]);
  assert.ok(exists("apps/unbreakable-vault/PRODUCTION_STATUS.md"));
  assert.ok(exists("apps/unbreakable-vault/NETWORK_STATUS.md"));
  assert.ok(exists("apps/unbreakable-vault/ASSET_PROVENANCE.md"));
});
