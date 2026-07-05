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

test("AA Session Key Lab exposes a wallet-style session workspace with guarded configure flow", () => {
  const playArea = read("apps/aa-session-key-lab/src/PlayArea.tsx");
  const styles = read("apps/aa-session-key-lab/src/PlayArea.scss");
  const composable = read(
    "apps/aa-session-key-lab/src/composables/useAASessionKeyLab.ts",
  );
  const messages = read("apps/aa-session-key-lab/src/locale/messages.ts");

  assert.match(playArea, /from "@shared\/components-react\/v2"/);
  assert.match(playArea, /OpenUiProvider/);
  assert.match(playArea, /PlayStage/);
  assert.match(playArea, /OpenUiPanel/);
  assert.match(playArea, /OpenUiTextField/);
  assert.match(playArea, /OpenUiNotice/);
  assert.match(playArea, /const SESSION_ART = "session-key-control\.jpg"/);
  assert.ok(
    fs.existsSync(path.join(ROOT, "apps/aa-session-key-lab/public/session-key-control.webp")),
    "AA session scene art must ship with the miniapp",
  );

  assert.match(playArea, /className="sess-play-area mx2 mx2-cat-tool"/);
  assert.match(playArea, /scene=\{<div className="sess-workspace">\{scene\}\{controls\}<\/div>\}/);
  assert.match(playArea, /className="sess-scene"/);
  assert.match(playArea, /"sess-scene__pass"/);
  assert.match(playArea, /className="sess-scene__scope"/);
  assert.match(playArea, /className="sess-controls"/);
  assert.match(playArea, /className="sess-visual-card"/);
  assert.match(playArea, /className="sess-preset-grid"/);
  assert.match(playArea, /className="sess-drawer"/);
  assert.match(playArea, /drawerToggleLabel=\{t\("sessionCommandTitle"\)\}/);
  assert.match(playArea, /drawer=\{\{ title: t\("sessionCommandTitle"\), children: drawer \}\}/);

  assert.match(playArea, /void dispatch\("generateKey"\)/);
  assert.match(playArea, /void dispatch\("inspectSession", draftAccount\)/);
  assert.match(playArea, /void dispatch\("revokeSession", draftAccount\)/);
  assert.match(playArea, /void dispatch\(\s*"configureSessionKey"/s);
  assert.match(playArea, /void dispatch\("checkSponsor", draftAccount, ""\)/);
  assert.match(playArea, /void dispatch\("requestSponsor", draftAccount, "", draftSpendLimit\)/);
  assert.match(playArea, /const needsKey = !seg\.key/);
  assert.match(playArea, /disabled: !needsKey && !scopeReady/);
  assert.match(playArea, /hint: !needsKey && !scopeReady \? t\("configureSessionBlocked"\) : undefined/);
  assert.match(styles, /\.sess-play-area \.mx2-action-rail__row \.mx2-btn--primary:disabled/);
  assert.match(styles, /\.sess-workspace\s*\{[^}]*grid-template-columns/s);
  assert.match(styles, /\.sess-scene\s*\{[^}]*background:\s*var\(--mx2-surface-2\)/s);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /filter:\s*saturate/);
  assert.doesNotMatch(styles, /opacity:\s*0\.55/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/);
  assert.match(composable, /aa\.isCheckingSponsorship\.get\(\)/);
  assert.doesNotMatch(
    composable,
    /get:\s*\(\)\s*=>\s*aa\.isCheckingSponsorship,/,
  );
  assert.match(messages, /sessionHeroTitle/);
  assert.match(messages, /sessionPassReady/);
  assert.match(messages, /sessionScopeTitle/);
  assert.match(messages, /configureSessionBlocked/);
  assert.match(messages, /sessionCommandTitle/);
});
