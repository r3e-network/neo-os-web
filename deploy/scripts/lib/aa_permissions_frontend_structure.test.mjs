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

test("AA Permissions Lab exposes a guarded wallet-style permissions workspace", () => {
  const playArea = read("apps/aa-permissions-lab/src/PlayArea.tsx");
  const styles = read("apps/aa-permissions-lab/src/PlayArea.scss");
  const messages = read("apps/aa-permissions-lab/src/locale/messages.ts");

  assert.match(playArea, /from "@shared\/components-react\/v2"/);
  assert.match(playArea, /OpenUiProvider/);
  assert.match(playArea, /PlayStage/);
  assert.match(playArea, /OpenUiPanel/);
  assert.match(playArea, /OpenUiTextField/);
  assert.match(playArea, /OpenUiNotice/);
  assert.match(playArea, /const PERMISSION_CONSOLE_ART = "permission-console\.webp"/);
  assert.ok(
    fs.existsSync(path.join(ROOT, "apps/aa-permissions-lab/public/permission-console.webp")),
    "AA permissions scene art must ship with the miniapp",
  );

  assert.match(playArea, /className="perms-play-area mx2 mx2-cat-tool"/);
  assert.match(playArea, /className="perms-scene"/);
  assert.match(playArea, /className="perms-boundary"/);
  assert.match(playArea, /className="perms-boundary__target-bar"/);
  assert.match(playArea, /className="perms-boundary__map"/);
  assert.match(playArea, /className="perms-boundary__route"/);
  assert.match(playArea, /className="perms-boundary__guard"/);
  assert.match(playArea, /className="perms-drawer"/);
  assert.match(playArea, /drawerToggleLabel=\{t\("permissionsCommandTitle"\)\}/);
  assert.match(playArea, /drawer=\{\{ title: t\("permissionsCommandTitle"\), children: drawer \}\}/);

  assert.match(playArea, /void dispatch\("refresh", draftAccount\)/);
  assert.match(playArea, /void dispatch\("connect"\)/);
  assert.match(playArea, /void dispatch\("submitVerifier", draftAccount, draftVerifier, ""\)/);
  assert.match(playArea, /void dispatch\("submitHook", draftAccount, draftHook\)/);
  assert.match(playArea, /void dispatch\("confirmVerifier", draftAccount\)/);
  assert.match(playArea, /void dispatch\("cancelHook", draftAccount\)/);
  assert.match(playArea, /primary: \{ label: t\("inspect"\), onClick: handleRefresh, loading: busy, disabled: !accountReady \}/);
  assert.match(playArea, /disabled=\{!draftAccount \|\| !draftVerifier\}/);
  assert.match(playArea, /disabled=\{!draftAccount \|\| !draftHook\}/);
  assert.match(styles, /\.perms-play-area \.mx2-action-rail__row \.mx2-btn--primary:disabled/);
  assert.match(styles, /\.perms-scene\s*\{[^}]*background:\s*#ffffff/s);
  assert.match(styles, /\.perms-boundary__map\s*\{[^}]*grid-template-columns/s);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /filter:\s*saturate/);
  assert.doesNotMatch(styles, /opacity:\s*0\.55/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/);

  assert.match(messages, /permissionsHeroTitle/);
  assert.match(messages, /permissionsHeroChip/);
  assert.match(messages, /permissionsRiskCopy/);
  assert.match(messages, /twoPhaseExplainer/);
  assert.match(messages, /permissionsRouteStatusReady/);
});
