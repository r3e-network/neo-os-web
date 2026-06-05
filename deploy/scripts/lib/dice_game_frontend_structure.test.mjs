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
    // dice-status-bar is applied via a conditional template literal
    // (className={`dice-status-bar${error ? " dice-status-bar--error" : ""}`}).
    "dice-status-bar",
  ]) {
    // Match the class in either a plain string literal (className="...")
    // or a template-literal className ({`...`}); both apply a real class.
    assert.match(
      playArea,
      new RegExp(`className=(?:"|\\{\`)[^"\`]*${className}`),
      className,
    );
  }

  // History list is driven by the rollHistory state binding and mapped to rows.
  assert.match(playArea, /val<RollHistoryItem\[\]>\("rollHistory",\s*\[\]\)/);
  assert.match(playArea, /rollHistory\.map/);
  assert.match(playArea, /FACES\.map/);
  // Active face is reflected via aria-pressed against the local faceInput state.
  assert.match(playArea, /aria-pressed=\{face === faceInput\}/);
  assert.match(playArea, /formatHash\(lastTxid,\s*10,\s*8\)/);
  assert.match(playArea, /isSubmitting \? t\("pendingTitle"\) : t\("readyTitle"\)/);
  // Bet placement is wired through the platform dispatch contract.
  assert.match(playArea, /dispatch\("placeDiceBet"/);

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

  // Neo Soft light page surface driven by the --ns-bg token.
  assert.match(styles, /\.dice-playarea\s*\{[^}]*var\(--ns-bg,\s*#f4f5f7\)/s);
  // Asymmetric two-column desk: wide stage + bet rail.
  assert.match(
    styles,
    /\.dice-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.62fr\)\s+minmax\(340px,\s*0\.44fr\)/s,
  );
  // Stage splits into a visual half and a details half.
  assert.match(
    styles,
    /\.dice-stage\s*\{[^}]*grid-template-columns:\s*minmax\(240px,\s*0\.5fr\)\s+minmax\(0,\s*0\.5fr\)/s,
  );
  // Stage and the other panels share a white surface token + soft shadow.
  assert.match(
    styles,
    /\.dice-stage,[\s\S]*?\.dice-history-panel\s*\{[^}]*background:\s*var\(--dice-surface\)/s,
  );
  // The signature green accent halo lives in the contained visual stage.
  assert.match(
    styles,
    /\.dice-stage__visual\s*\{[^}]*var\(--dice-accent-tint\)/s,
  );
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

  // Neo Soft design language: uppercase eyebrow labels with 0.12em tracking are
  // the intentional new style (the eyebrow + panel headings opt into it).
  assert.match(
    styles,
    /\.dice-eyebrow\s*\{[^}]*text-transform:\s*uppercase/s,
  );
  assert.match(
    styles,
    /\.dice-panel-heading\s*\{[^}]*text-transform:\s*uppercase/s,
  );
  assert.match(styles, /\.dice-eyebrow\s*\{[^}]*letter-spacing:\s*0\.12em/s);
  // Type stays at fixed sizes (no fluid clamp), radii stay within the soft scale.
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
  // The accent halo is intentionally contained to the visual stage only; the
  // flat soft surfaces (metric tiles, bet summary, status bar) never use a wash.
  assert.doesNotMatch(
    styles,
    /\.dice-metric-grid span\s*\{[^}]*radial-gradient/s,
  );
  assert.doesNotMatch(
    styles,
    /\.dice-status-bar\s*\{[^}]*radial-gradient/s,
  );
});
