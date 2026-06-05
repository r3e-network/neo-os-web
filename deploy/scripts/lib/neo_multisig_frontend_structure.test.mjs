import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("Neo Multisig renders a complete light wallet-style approval workspace", () => {
  const playArea = read("apps/neo-multisig/src/PlayArea.tsx");
  const styles = read("apps/neo-multisig/src/PlayArea.scss");
  const messages = read("apps/neo-multisig/src/locale/messages.ts");
  const manifest = JSON.parse(read("apps/neo-multisig/neo-manifest.json"));
  const viteConfig = read("apps/neo-multisig/vite.config.ts");

  // Structural regions of the Neo Soft custody workspace: the two-column shell,
  // the hero with its accent + eyebrow + stat tiles, the request workspace and
  // the sticky aside (signer / route / activity panels).
  for (const className of [
    "multisig-shell",
    "multisig-main",
    "multisig-hero",
    "multisig-hero-accent",
    "multisig-hero-eyebrow",
    "multisig-hero-facts",
    "multisig-hero-tile",
    "multisig-workspace",
    "multisig-request-panel",
    "multisig-section-heading",
    "multisig-form-grid",
    "multisig-signer-grid",
    "multisig-form-row",
    "multisig-primary-actions",
    "multisig-aside",
    "multisig-signer-panel",
    "multisig-route-panel",
    "multisig-activity-panel",
  ]) {
    assert.match(playArea, new RegExp(`className="[^"]*${className}`), className);
  }

  // State/dispatch wiring: the create-vault, propose-spend and load-request
  // flows must remain wired to their on-chain actions with trimmed inputs.
  assert.match(playArea, /useState\(""\)/);
  assert.match(playArea, /dispatch\("createVault",\s*\{/);
  assert.match(playArea, /signers:\s*normalizedSigners/);
  assert.match(playArea, /threshold:\s*thresholdNumber/);
  assert.match(playArea, /dispatch\("proposeRequest",\s*\{/);
  assert.match(playArea, /recipient:\s*recipient\.trim\(\)/);
  assert.match(playArea, /amount:\s*spendAmount\.trim\(\)/);
  assert.match(playArea, /dispatch\("loadRequest",\s*loadRequestId\.trim\(\)\)/);
  assert.match(playArea, /disabled=\{!canCreateVault\}/);
  assert.match(playArea, /disabled=\{!canPropose\}/);
  assert.match(playArea, /disabled=\{!loadRequestId\.trim\(\)\}/);
  assert.match(playArea, /activeRequest/);
  assert.match(playArea, /multisig-receipt/);
  assert.match(playArea, /multisig-request-details/);
  assert.match(playArea, /normalizedSigners\.length/);
  assert.match(playArea, /t\("multisigSignerList"\)/);
  // Quorum denominator is the larger of the entered signers and MIN_SIGNERS (2),
  // surfaced through heroQuorumLabel.
  assert.match(
    playArea,
    /signerDenominator\s*=\s*Math\.max\(normalizedSigners\.length,\s*MIN_SIGNERS\)/,
  );
  assert.match(playArea, /heroQuorumLabel/);
  // Network surfacing: the route panel reports the Neo N3 execution network.
  assert.match(playArea, /t\("multisigNetworkValue"\)/);
  assert.match(playArea, /history\.map/);
  assert.match(playArea, /history\.length === 0/);
  assert.match(playArea, /statusLabel\(item\.status \?\? "pending"\)/);
  assert.match(playArea, /formatDate\(item\.createdAt\)/);
  assert.ok(
    manifest.supported_networks.includes("neo-n3-mainnet"),
    "Neo Multisig must remain available on mainnet",
  );
  assert.ok(
    manifest.supported_networks.includes("neo-n3-testnet"),
    "Neo Multisig must be available on testnet for browser validation",
  );
  assert.match(viteConfig, /nodePolyfills/);
  assert.match(viteConfig, /Buffer:\s*true/);
  assert.match(viteConfig, /@r3e\/neo-js-sdk\/browser/);

  for (const key of [
    "multisigHeroTitle",
    "multisigHeroSubtitle",
    "multisigHeroEyebrow",
    "statPending",
    "statCompleted",
    "sidebarTotalTxs",
    "multisigRequestStatusTitle",
    "multisigRouteTitle",
    "multisigSignerTitle",
    "multisigSignerList",
    "multisigQuorumTitle",
    "multisigNetworkValue",
    "multisigRouteBroadcast",
    "multisigNeedSigners",
    "multisigCreateReady",
    "multisigVaultReceiptCopy",
    "toastRequestCreated",
    "toastRequestLoaded",
  ]) {
    assert.match(messages, new RegExp(`${key}:`), key);
  }

  // Light Neo Soft surfaces + responsive layout.
  assert.match(styles, /\.multisig-play-area\s*\{[^}]*#f5f7fa/s);
  // The custody shell is a centred single column; its two-column split lives in
  // the workspace grid below.
  assert.match(styles, /\.multisig-shell\s*\{[^}]*width:\s*min\(100%,\s*960px\)/s);
  assert.match(styles, /\.multisig-main\s*\{[^}]*display:\s*grid/s);
  // The hero is a vertical flex column (accent » eyebrow » title » facts).
  assert.match(styles, /\.multisig-hero\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(styles, /\.multisig-hero\s*\{[^}]*#ffffff/s);
  assert.match(styles, /\.multisig-hero\s*\{[^}]*var\(--ns-brand-soft,\s*#e4f8f0\)/s);
  assert.match(
    styles,
    /\.multisig-hero-facts\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    styles,
    /\.multisig-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.35fr\)\s+minmax\(280px,\s*0\.65fr\)/s,
  );
  // The aside column is sticky on wide layouts.
  assert.match(styles, /\.multisig-aside\s*\{[^}]*position:\s*sticky/s);
  assert.match(
    styles,
    /@media \(max-width: 1080px\)[\s\S]*\.multisig-aside[\s\S]*position:\s*static/s,
  );
  assert.match(
    styles,
    /@media \(max-width: 1080px\)[\s\S]*\.multisig-workspace[\s\S]*grid-template-columns:\s*1fr/s,
  );
  assert.match(
    styles,
    /\.multisig-primary-actions\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );
  assert.match(
    styles,
    /\.multisig-primary-actions \.neo-btn,[\s\S]*?white-space:\s*nowrap/s,
  );
  assert.match(styles, /\.multisig-signal-row\s*\{[^}]*padding:\s*9px 0/s);
  assert.match(
    styles,
    /@media \(max-width: 640px\)[\s\S]*\.multisig-hero-facts[\s\S]*grid-template-columns:\s*1fr/s,
  );
  assert.match(
    styles,
    /@media \(max-width: 640px\)[\s\S]*\.multisig-form-row[\s\S]*grid-template-columns:\s*1fr/s,
  );

  // Neo Soft design language: uppercase eyebrow labels with letter-spacing
  // tracking are the INTENTIONAL typographic system (this deliberately replaces
  // the former zero-letter-spacing / no-uppercase guards).
  assert.match(styles, /\.multisig-hero-eyebrow\s*\{[^}]*text-transform:\s*uppercase/s);
  assert.match(styles, /\.multisig-hero-eyebrow\s*\{[^}]*letter-spacing:\s*0\.12em/s);
  assert.match(styles, /\.multisig-hero-tile small\s*\{[^}]*text-transform:\s*uppercase/s);

  // Design-system constraints that still hold: no fluid font clamps, no radial
  // gradients, and no unbounded literal corner radii (tokens carry the radius).
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
