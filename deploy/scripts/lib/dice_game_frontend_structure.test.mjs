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

function assertOnlyZeroLetterSpacing(styles) {
  const values = [...styles.matchAll(/letter-spacing:\s*([^;]+);/g)].map(
    (match) => match[1].trim(),
  );
  assert.ok(values.length > 0, "expected explicit letter-spacing declarations");
  assert.deepEqual(values, values.map(() => "0"));
}

test("Dice Game renders a modern wallet-style VRF roll desk", () => {
  const playArea = read("apps/dice-game/src/PlayArea.tsx");
  const styles = read("apps/dice-game/src/PlayArea.scss");
  const messages = read("apps/dice-game/src/locale/messages.ts");

  for (const className of [
    "dice-shell",
    "dice-stage",
    "dice-stage__visual",
    "dice-stage__details",
    "dice-metric-grid",
    "dice-bet-panel",
    "dice-face-grid",
    "dice-route-panel",
    "dice-history-panel",
    "dice-status-bar",
  ]) {
    assert.match(playArea, new RegExp(`className="[^"]*${className}`), className);
  }

  assert.match(playArea, /const history = \[/);
  assert.match(playArea, /history\.map/);
  assert.match(playArea, /FACES\.map/);
  assert.match(playArea, /aria-pressed=\{face === selectedFace\}/);
  assert.match(playArea, /formatHash\(lastTxid,\s*10,\s*8\)/);
  assert.match(playArea, /isSubmitting \? t\("pendingTitle"\) : t\("readyTitle"\)/);

  for (const key of [
    "diceHeroTitle",
    "diceHeroSubtitle",
    "diceWalletLabel",
    "diceStakeDeskTitle",
    "dicePayoutLabel",
    "diceVrfRouteTitle",
    "diceVrfRouteCopy",
    "diceHistoryTitle",
    "diceHistoryEmpty",
    "diceCommitStep",
    "diceOracleStep",
    "diceSettleStep",
  ]) {
    assert.match(messages, new RegExp(`${key}:`), key);
  }

  assert.match(styles, /\.dice-playarea\s*\{[^}]*#f5f7fa/s);
  assert.match(
    styles,
    /\.dice-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.68fr\)\s+minmax\(320px,\s*0\.4fr\)/s,
  );
  assert.match(
    styles,
    /\.dice-stage\s*\{[^}]*grid-template-columns:\s*minmax\(260px,\s*0\.54fr\)\s+minmax\(0,\s*0\.46fr\)/s,
  );
  assert.match(styles, /\.dice-stage\s*\{[^}]*#ffffff/s);
  assert.match(styles, /\.dice-stage\s*\{[^}]*#fff7ed/s);
  assert.match(
    styles,
    /\.dice-metric-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    styles,
    /\.dice-face-grid\s*\{[^}]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(styles, /\.dice-status-bar\s*\{[^}]*min-height:\s*52px/s);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.dice-shell[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.dice-stage[\s\S]*grid-template-columns:\s*1fr/s);

  assertOnlyZeroLetterSpacing(styles);
  assert.doesNotMatch(styles, /text-transform:\s*uppercase/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
