import assert from "node:assert/strict";
import test from "node:test";
import {
  assertClasses,
  assertDispatches,
  assertMessageKeys,
  assertModernTypography,
  assertPlayStage,
  read,
} from "./frontend_structure_helpers.mjs";

test("Explorer renders a v2 chain lookup console with no signing path", () => {
  const playArea = read("apps/explorer/src/PlayArea.tsx");
  const styles = read("apps/explorer/src/PlayArea.scss");
  const messages = read("apps/explorer/src/locale/messages.ts");

  assertPlayStage(playArea, "tool", "Explorer");
  assertClasses(playArea, [
    "explorer-play-area",
    "explorer-scene",
    "explorer-network-card",
    "explorer-scanner",
    "explorer-result-card",
    "explorer-controls",
    "explorer-search-shell",
    "explorer-drawer-section",
    "explorer-tx-list",
  ], "Explorer");
  assertDispatches(playArea, ["search", "viewTx"], "Explorer");
  assert.match(playArea, /selectedNetwork === "mainnet"/);
  assert.match(playArea, /OpenUiSegmented/);
  assert.match(playArea, /OpenUiTextField/);
  assert.doesNotMatch(playArea, /dispatch\("(?:sign|sendTransaction|invoke)/i);
  assertMessageKeys(messages, [
    "explorerReadOnly",
    "explorerSearchScope",
    "explorerWorkflowTitle",
    "explorerSafetyDesc",
    "recentTransactions",
  ], "Explorer");
  assert.match(styles, /\.explorer-scene\s*\{[\s\S]*grid-template-columns:/);
  assert.match(styles, /@media \(max-width:/);
  assertModernTypography(styles, "Explorer");
});
