import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("AA Permissions exposes a resource-led, state-bound rotation workspace", () => {
  const playArea = read("apps/aa-permissions-lab/src/PlayArea.tsx");
  const styles = read("apps/aa-permissions-lab/src/PlayArea.scss");
  const messages = read("apps/aa-permissions-lab/src/locale/messages.ts");
  const logic = read("apps/aa-permissions-lab/src/permissions.ts");
  const composable = read("apps/aa-permissions-lab/src/composables/useAAPermissionsLab.ts");
  const main = read("apps/aa-permissions-lab/src/main.tsx");
  const manifest = JSON.parse(read("apps/aa-permissions-lab/neo-manifest.json"));

  assert.match(playArea, /from "@shared\/components-react\/v2\/OpenUiLite"/);
  assert.match(playArea, /from "@shared\/components-react\/v2\/PlayStage"/);
  assert.match(playArea, /OpenUiProvider/);
  assert.match(playArea, /OpenUiPanel/);
  assert.match(playArea, /OpenUiTextField/);
  assert.match(playArea, /OpenUiSegmented/);
  assert.match(playArea, /new URL\(\s*"\.\.\/public\/permission-console\.webp"/s);
  assert.ok(
    fs.existsSync(path.join(ROOT, "apps/aa-permissions-lab/public/permission-console.webp")),
    "permission console art must ship with the miniapp",
  );

  assert.match(playArea, /className="perms-console"/);
  assert.match(playArea, /className="perms-passport"/);
  assert.match(playArea, /className="perms-lifecycle"/);
  assert.match(playArea, /className="perms-drawer"/);
  assert.match(playArea, /let primary: ActionRailAction/);
  assert.match(playArea, /pendingTransaction[\s\S]*checkTransaction/);
  assert.match(playArea, /!bindingCurrent[\s\S]*inspectAccount/);
  assert.match(playArea, /firstInstall \? t\("installBindingNow"\) : t\("proposeRotation"\)/);
  assert.match(playArea, /selectedPending[\s\S]*confirmRotation/);
  assert.match(playArea, /cancelProposal/);
  assert.match(playArea, /drawerToggleLabel=\{t\("permissionSettings"\)\}/);
  assert.doesNotMatch(playArea, /eyebrow:/);
  assert.doesNotMatch(playArea, /<input/);
  assert.doesNotMatch(playArea, /🔒|⏳|✓|✕/u);

  assert.match(main, /normalizePermissionNetwork\(ctx\.launchContext\.network\)/);
  assert.match(main, /result\.value\.confirmed/);
  assert.match(main, /transactionAwaitingConfirmation/);
  assert.match(composable, /authorizeFreshBinding/);
  assert.match(composable, /getBackupOwner/);
  assert.match(composable, /detectExactWalletNetwork/);
  assert.match(composable, /onTransactionSent/);
  assert.match(composable, /reconcilePendingTransaction/);
  assert.match(logic, /permissionContractOperation/);
  assert.match(logic, /permissionTransactionSatisfied/);
  assert.match(logic, /restorePendingPermissionTransaction/);

  assert.match(styles, /\.perms-workspace\s*\{[\s\S]*background:\s*#ffffff/);
  assert.match(styles, /\.perms-console\s*\{[\s\S]*background:\s*#ead6b9/);
  assert.match(styles, /\.perms-passport\s*\{[\s\S]*background:\s*rgba\(255, 254, 250, 0\.97\)/);
  assert.match(styles, /\.perms-console__art\s*\{[\s\S]*object-fit:\s*cover/);
  assert.match(styles, /@media \(max-width:\s*720px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /border-radius:\s*2[2-9]px/);
  assert.doesNotMatch(styles, /:disabled\s*\{[^}]*opacity:\s*0\.[0-6]/s);

  assert.match(messages, /firstInstallIsImmediate/);
  assert.match(messages, /replacementUsesTimelock/);
  assert.match(messages, /transactionRecoveryCopy/);
  assert.match(messages, /wrongBackupOwner/);
  assert.equal(manifest.version, "2.0.0");
  assert.equal(manifest.features.stateless, false);
  assert.equal("stateSource" in manifest, false);
});
