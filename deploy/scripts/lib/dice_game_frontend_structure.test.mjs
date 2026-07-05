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

test("Dice Game renders a resource-led v2 roll table", () => {
  const playArea = read("apps/dice-game/src/PlayArea.tsx");
  const styles = read("apps/dice-game/src/PlayArea.scss");
  const messages = read("apps/dice-game/src/locale/messages.ts");

  for (const className of [
    "dice-playarea",
    "dice-scene",
    "dice-scene__felt",
    "dice-scene__hud",
    "dice-scene__live-zone",
    "dice-scene__die-anchor",
    "dice-scene__die",
    "dice-scene__side-die",
    "dice-scene__throw-path",
    "dice-scene__landing-ring",
    "dice-scene__stake-chip",
    "dice-scene__play-table",
    "dice-bet-spots",
    "dice-bet-spot",
    "dice-bet-spot__die",
    "dice-controls",
    "dice-chip-tray",
    "dice-chip-btn",
  ]) {
    assert.ok(playArea.includes(className), className);
  }

  // History list is driven by the rollHistory state binding and mapped to rows.
  assert.match(playArea, /val<RollHistoryItem\[\]>\("rollHistory",\s*\[\]\)/);
  assert.match(playArea, /rollHistory\.map/);
  assert.match(playArea, /FACES\.map/);
  assert.match(playArea, /CHIP_PRESETS\.map/);
  assert.doesNotMatch(playArea, /OpenUiSegmented/);
  assert.match(playArea, /aria-pressed=\{active\}/);
  assert.match(playArea, /onClick=\{\(\) => chooseFace\(face\)\}/);
  assert.match(playArea, /onClick=\{\(\) => chooseStake\(chip\.amount\)\}/);
  assert.match(playArea, /formatHash\(row\.txid,\s*6,\s*4\)/);
  // Hero title is state-driven across the game workflow: rolling -> result -> ready.
  assert.match(playArea, /isRolling\s*\n?\s*\?\s*t\("throwingTitle"\)/);
  assert.match(playArea, /t\("readyTitle"\)/);
  assert.match(playArea, /diceFaceUrl\(faceNum\)/);
  assert.match(playArea, /diceFaceUrl\(face\)/);
  assert.match(playArea, /chipAssetUrl\(selectedStakePreset \|\| normalizedAmount\)/);
  assert.doesNotMatch(playArea, /dice-chip-rack\.jpg/);
  assert.ok(fs.existsSync(path.join(ROOT, "apps/dice-game/public/art/ATTRIBUTION.md")));
  for (const fileName of [
    "chip-green.webp",
    "chip-blue.webp",
    "chip-red.webp",
    "chip-black.webp",
    "hero-die.webp",
  ]) {
    assert.ok(
      fs.existsSync(path.join(ROOT, "apps/dice-game/public/art", fileName)),
      `${fileName} must ship with the miniapp`,
    );
  }
  for (const face of [1, 2, 3, 4, 5, 6]) {
    assert.ok(
      fs.existsSync(path.join(ROOT, `apps/dice-game/public/art/die-white-${face}.webp`)),
      `dice face ${face} art must ship with the miniapp`,
    );
  }
  assert.match(playArea, /mx2-roll/);
  assert.match(playArea, /mx2-land/);
  assert.match(playArea, /ParticleBurst/);
  assert.doesNotMatch(playArea, /ChipArt/);
  assert.doesNotMatch(playArea, /dice-stage\.(?:avif|webp|jpg)/);
  assert.doesNotMatch(playArea, /dice-scene-art\.jpg/);
  // Bet placement is wired through the platform dispatch contract.
  assert.match(playArea, /dispatch\("placeDiceBet"/);

  for (const key of [
    "readyTitle",
    "throwingTitle",
    "pickYourFace",
    "stakeRackTitle",
    "customStakeHint",
    "rollAction",
    "selectedFace",
    "stakeAmount",
    "payoutPreview",
    "diceVrfRouteTitle",
    "diceHistoryTitle",
    "diceHistoryEmpty",
    "diceRiskTitle",
    "diceRiskCopy",
  ]) {
    assert.match(messages, new RegExp(`${key}:`), key);
  }

  // Light game table: real dice/chip resources, foreground controls, clean foundations.
  assert.match(styles, /\.dice-playarea\s*\{[^}]*--mx2-stage-floor:\s*#ffffff/s);
  assert.match(styles, /\.dice-scene\s*\{[^}]*background:\s*#fff9ec/s);
  assert.match(styles, /\.dice-scene__felt\s*\{[^}]*#fff8e8/s);
  assert.match(styles, /\.dice-scene__felt-track\s*\{[^}]*display:\s*none/s);
  assert.match(styles, /\.dice-scene__felt-track\s*\{[^}]*background:\s*transparent/s);
  assert.match(styles, /\.dice-scene__play-table\s*\{[^}]*min-height:\s*318px/s);
  assert.match(styles, /\.dice-bet-spots\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(styles, /\.dice-bet-spot\s*\{[^}]*position:\s*absolute/s);
  assert.match(styles, /\.dice-bet-spot--active\s*\{[^}]*background:\s*#f2fff8/s);
  assert.match(styles, /\.dice-scene__live-zone\s*\{[^}]*grid-template-columns:\s*88px minmax\(188px,\s*230px\) 88px/s);
  assert.match(styles, /\.dice-scene__die,\s*\n\.dice-scene__side-die\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(styles, /\.dice-scene__side-die\s*\{[^}]*opacity:\s*0\.36/s);
  assert.match(styles, /\.dice-scene\[data-state="rolling"\] \.dice-scene__table-mat\s*\{[^}]*opacity:\s*0\.48/s);
  assert.match(styles, /\.dice-scene\[data-state="rolling"\] \.dice-scene__throw-path\s*\{[^}]*opacity:\s*0\.12/s);
  assert.match(styles, /\.dice-scene__die-anchor\.mx2-roll\s*\{[^}]*animation:\s*dice-clean-tumble/s);
  assert.match(styles, /\.dice-controls\s*\{[^}]*max-width:\s*620px/s);
  assert.match(styles, /\.dice-chip-tray\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.94\)/s);
  assert.match(styles, /\.dice-chip-btn img\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(styles, /\.dice-playarea \.mx2-action-rail__row \.mx2-btn--primary\s*\{[^}]*flex:\s*0 0 154px/s);
  assert.match(styles, /@keyframes dice-trail-sweep/);
  assert.match(styles, /@keyframes dice-clean-tumble/);
  assert.match(styles, /@keyframes dice-landing-ready/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.dice-scene__play-table[\s\S]*min-height:\s*278px/s);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.dice-bet-spot[\s\S]*width:\s*64px/s);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.dice-chip-btn[\s\S]*min-width:\s*48px/s);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.dice-scene__die-anchor\.mx2-roll/s);

  assert.doesNotMatch(styles, /backdrop-filter/);
  assert.doesNotMatch(styles, /dice-stage|dice-scene-art|dice-cube|dice-winburst|dice-confetti|dice-sheen/);
  assert.doesNotMatch(styles, /\.dice-scene__felt::after/);
  assert.doesNotMatch(styles, /\.dice-controls__rail::after/);
  assert.doesNotMatch(styles, /dice-controls__rail|dice-face-btn|semi-radioGroup/);
  assert.doesNotMatch(styles, /opacity:\s*0\.06;/);
});
