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

test("Soulbound Certificate ships an NFT-native credential atelier with durable exact recovery", () => {
  const playArea = read("apps/soulbound-certificate/src/PlayArea.tsx");
  const styles = read("apps/soulbound-certificate/src/PlayArea.scss");
  const logic = read("apps/soulbound-certificate/src/composables/useSoulbound.ts");
  const safety = read("apps/soulbound-certificate/src/certificate-safety.ts");
  const preview = read("apps/soulbound-certificate/src/components/CertificatePreview.tsx");
  const main = read("apps/soulbound-certificate/src/main.tsx");
  const messages = read("apps/soulbound-certificate/src/locale/messages.ts");
  const shellManifest = read("apps/soulbound-certificate/src/manifest.ts");
  const neoManifest = JSON.parse(read("apps/soulbound-certificate/neo-manifest.json"));

  assertPlayStage(playArea, "nft", "Soulbound Certificate");
  assertClasses(playArea, [
    "cert-workbench",
    "cert-workbench__artifact",
    "cert-pass-card",
    "cert-blueprint-presets",
    "cert-recipient-dossier",
    "cert-verifier-lens",
    "cert-drawer",
  ], "Soulbound Certificate");
  assertDispatches(playArea, [
    "issueCertificate",
    "createTemplate",
    "updateTemplate",
    "verifyCertificate",
    "recoverPendingOperation",
    "refreshRecoveryStorage",
  ], "Soulbound Certificate");

  assert.match(playArea, /@shared\/components-react\/v2\/PlayStage/);
  assert.doesNotMatch(playArea, /from "@shared\/components-react\/v2"/);
  assert.match(playArea, /const CERTIFICATE_PAPER_ART/);
  assert.match(playArea, /const CERTIFICATE_ATELIER_ART/);
  assert.match(playArea, /if \(hasPendingWrite\)[\s\S]*dispatch\("recoverPendingOperation"\)/);
  assert.match(playArea, /recoveryStorageAvailable/);
  assert.doesNotMatch(playArea, /<form\b|role="tab"|emoji|<svg\b/);

  assert.match(preview, /textureSrc/);
  assert.match(preview, /certificate-artifact/);
  assert.match(preview, /data-verification-state/);
  assert.match(preview, /certificate-artifact__texture/);
  assert.match(preview, /from "lucide-react"/);

  assert.match(logic, /PENDING_CERTIFICATE_STORAGE_KEY = "state\/pendingOperation"/);
  assert.match(logic, /probeRecoveryStorage/);
  assert.match(logic, /writePendingOperation/);
  assert.match(logic, /version: 2/);
  assert.match(logic, /onTransactionSent: \(txid\) => persistBroadcast/);
  assert.match(logic, /confirmPendingReadback/);
  assert.match(logic, /recipientName: next\.recipientName/);
  assert.match(logic, /achievement: next\.achievement/);
  assert.match(logic, /templateIssuerName: next\.issuerName/);
  assert.match(logic, /transactionOutcomeReader/);
  assert.doesNotMatch(logic, /=\s*app\.state\.persisted/);

  assert.match(safety, /getapplicationlog/);
  assert.match(safety, /version: 1 \| 2/);
  assert.match(safety, /NEO_TXID_PATTERN = \/\^0x\[0-9a-fA-F\]\{64\}\$\//);
  assert.match(main, /recoveryStorageAvailable: soulbound\.recoveryStorageAvailable/);

  assert.match(shellManifest, /operations:\s*\[\]/);
  assert.equal(neoManifest.category, "nft");
  assert.equal(neoManifest.features.stateless, false);
  assert.equal(neoManifest.contracts["neo-n3-mainnet"], "0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b");
  assert.equal(neoManifest.contracts["neo-n3-testnet"], "0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b");

  assertAssets([
    "apps/soulbound-certificate/public/certificate-paper.webp",
    "apps/soulbound-certificate/public/certificate-atelier.webp",
    "apps/soulbound-certificate/public/banner.webp",
    "apps/soulbound-certificate/public/logo.webp",
  ]);
  for (const document of [
    "apps/soulbound-certificate/README.md",
    "apps/soulbound-certificate/PRODUCTION_STATUS.md",
    "apps/soulbound-certificate/NETWORK_STATUS.md",
    "apps/soulbound-certificate/ASSET_PROVENANCE.md",
  ]) assert.ok(exists(document), `missing ${document}`);

  assertMessageKeys(messages, [
    "recoveryStorageUnavailable",
    "transactionPending",
    "pendingReadback",
    "pendingContextMismatch",
    "transactionFaulted",
    "certificateLoadFailedHint",
  ], "Soulbound Certificate");
  assert.match(styles, /\.certificate-artifact__texture\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(styles, /\.cert-data-trust--warning/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assertModernTypography(styles, "Soulbound Certificate");
});
