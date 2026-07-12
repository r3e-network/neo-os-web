import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAssets,
  assertClasses,
  assertDispatches,
  assertMessageKeys,
  assertModernTypography,
  assertPlayStage,
  read,
} from "./frontend_structure_helpers.mjs";

test("Neo Multisig renders a v2 approval vault workspace", () => {
  const playArea = read("apps/neo-multisig/src/PlayArea.tsx");
  const styles = read("apps/neo-multisig/src/PlayArea.scss");
  const messages = read("apps/neo-multisig/src/locale/messages.ts");
  const manifest = JSON.parse(read("apps/neo-multisig/neo-manifest.json"));
  const viteConfig = read("apps/neo-multisig/vite.config.ts");

  assertPlayStage(playArea, "tool", "Neo Multisig");
  assertClasses(playArea, [
    "neo-multisig-play-area",
    "multisig-workbench",
    "multisig-vault-card",
    "multisig-signer-board",
    "multisig-approval-card",
    "multisig-approval-meter",
    "multisig-route",
    "multisig-load-panel",
  ], "Neo Multisig");
  assertDispatches(playArea, [
    "loadVault",
    "approveRequest",
    "createVault",
    "proposeRequest",
    "cancelRequest",
  ], "Neo Multisig");
  assertAssets(["apps/neo-multisig/public/multisig-vault-stage.webp"]);
  assertMessageKeys(messages, [
    "appTitle",
    "appSubtitle",
    "buttonApprove",
    "buttonCreateVault",
    "buttonPropose",
    "buttonCancel",
    "multisigNeedSigners",
    "multisigRouteBroadcast",
  ], "Neo Multisig");
  assert.ok(manifest.supported_networks.includes("neo-n3-mainnet"));
  assert.ok(manifest.supported_networks.includes("neo-n3-testnet"));
  assert.match(viteConfig, /nodePolyfills/);
  assert.match(styles, /\.multisig-workbench\s*\{/);
  assert.match(styles, /@media \(max-width:/);
  assertModernTypography(styles, "Neo Multisig");
});
