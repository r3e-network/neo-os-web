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

test("AA Account Lab exposes a scene-led AA registration workspace", () => {
  const playArea = read("apps/aa-account-lab/src/PlayArea.tsx");
  const styles = read("apps/aa-account-lab/src/PlayArea.scss");
  const messages = read("apps/aa-account-lab/src/locale/messages.ts");

  assert.match(playArea, /from "@shared\/components-react\/v2"/);
  assert.match(playArea, /OpenUiProvider/);
  assert.match(playArea, /PlayStage/);
  assert.match(playArea, /OpenUiPanel/);
  assert.match(playArea, /OpenUiTextField/);
  assert.match(playArea, /OpenUiNotice/);
  assert.match(playArea, /const ACCOUNT_ART = "account-control-center\.webp"/);
  assert.ok(
    fs.existsSync(path.join(ROOT, "apps/aa-account-lab/public/account-control-center.webp")),
    "AA account scene art must ship with the miniapp",
  );

  assert.match(playArea, /className="aa-play-area mx2 mx2-cat-tool"/);
  assert.match(playArea, /scene=\{<div className="aa-workspace">\{scene\}\{controls\}<\/div>\}/);
  assert.match(playArea, /className="aa-scene"/);
  assert.match(playArea, /className="aa-scene__diagram"/);
  assert.match(playArea, /className="aa-scene__segments"/);
  assert.match(playArea, /className="aa-controls"/);
  assert.match(playArea, /className="aa-visual-card"/);
  assert.match(playArea, /className="aa-plan-grid"/);
  assert.match(playArea, /className="aa-drawer"/);

  assert.match(playArea, /void dispatch\("inspect", draftAccountId\)/);
  assert.match(playArea, /void dispatch\(\s*"register"/s);
  assert.match(playArea, /void dispatch\("connect"\)/);
  assert.match(playArea, /if \(!shellReady\) return/);
  assert.match(playArea, /disabled: Boolean\(connectedWallet\) && !shellReady/);
  assert.match(playArea, /secondary: \[\{ label: t\("inspect"\), onClick: handleInspect, disabled: !draftAccountId\.trim\(\) \|\| busy \}\]/);
  assert.match(playArea, /drawerToggleLabel=\{t\("registerTitle"\)\}/);
  assert.match(playArea, /drawer=\{\{ title: t\("registerTitle"\), children: drawer \}\}/);
  assert.match(styles, /\.aa-play-area \.mx2-action-rail__row \.mx2-btn--primary:disabled/);
  assert.match(styles, /\.aa-workspace\s*\{[^}]*grid-template-columns/s);
  assert.match(styles, /\.aa-scene\s*\{[^}]*background:\s*#ffffff/s);
  assert.match(styles, /\.aa-drawer\s*\{/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);

  assert.doesNotMatch(styles, /radial-gradient/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);

  assert.match(messages, /accountHeroTitle/);
  assert.match(messages, /accountStageCopy/);
  assert.match(messages, /accountShellProgress/);
  assert.match(messages, /accountPlanDaily/);
  assert.match(messages, /registerBlocked/);
});
