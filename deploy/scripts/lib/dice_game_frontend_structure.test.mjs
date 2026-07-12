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

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

test("Dice Game routes its visible play surface through Phaser 3", () => {
  const entry = read("apps/dice-game/src/PlayArea.tsx").trim();
  const wrapper = read("apps/dice-game/src/PhaserPlayArea.tsx");

  assert.equal(entry, 'export { default } from "./PhaserPlayArea";');
  assert.match(wrapper, /LazyPhaserGameComponent as PhaserGameComponent/);
  assert.match(wrapper, /const loadDiceScene = \(\) =>\s*\n\s*import\("\.\/scenes\/DiceScene"\)/);
  assert.match(wrapper, /<div className="dice-stage-shell">/);
  assert.match(wrapper, /<div className="dice-stage-status" aria-live="polite">/);
  assert.match(wrapper, /<div className="dice-stage-hud" aria-label=\{t\("rollSummary"\)\}>/);
  assert.match(wrapper, /className="dice-ingame-drawer"/);
  assert.match(wrapper, /role="dialog"/);
  assert.match(wrapper, /aria-controls=\{RULES_DRAWER_ID\}/);
  assert.match(wrapper, /role="radiogroup"/);
  assert.match(wrapper, /role="radio"/);
  assert.match(wrapper, /dispatch\("setSelectedFace"/);
  assert.match(wrapper, /dispatch\("setStakeAmount"/);
  assert.match(wrapper, /dispatch\("placeDiceBet"/);
  assert.match(wrapper, /errorLabel=\{t\("gameActionFailed"\)\}/);
  assert.match(wrapper, /retryLabel=\{t\("retry"\)\}/);
  assert.match(wrapper, /enableSoundLabel=\{t\("enableGameSound"\)\}/);
  assert.match(wrapper, /muteSoundLabel=\{t\("muteGameSound"\)\}/);
  assert.match(wrapper, /lastPayout:\s+str\("lastPayout"/);
  assert.match(wrapper, /formatHash\(row\.txid, 6, 4\)/);

  // The Phaser scene owns the game actions; the React layer is only its HUD,
  // history/rules drawer, and keyboard/screen-reader mirror.
  assert.match(wrapper, /actions=\{\{\}\}/);
  assert.doesNotMatch(wrapper, /OpenUiForm|OpenUiSegmented|<form\b|type="number"/);
  assert.doesNotMatch(wrapper, /FACES\.map|dice-scene__die-anchor|mx2-roll/);
});

test("DiceScene uses real dice and chip resources as the playable controls", () => {
  const scene = read("apps/dice-game/src/scenes/DiceScene.ts");

  assert.match(scene, /const DIE_SIZE\s+=\s+112;/);
  assert.match(scene, /const DIE_FACE_FILES = \[/);
  for (let face = 1; face <= 6; face += 1) {
    assert.match(scene, new RegExp(`\\./art/die-white-${face}\\.webp`));
  }
  for (const fileName of [
    "chip-green.webp",
    "chip-blue.webp",
    "chip-red.webp",
    "chip-black.webp",
  ]) {
    assert.match(scene, new RegExp(`\\./art/${fileName.replace(".", "\\.")}`));
  }
  assert.match(scene, /officialGasTokenPhaserUrl/);
  assert.match(scene, /this\.load\.image\(ASSET_GAS_ICON, officialGasTokenPhaserUrl\)/);
  assert.match(scene, /private buildDice\(/);
  assert.match(scene, /private buildFaceButton\(/);
  assert.match(scene, /private buildChip\(/);
  assert.match(scene, /private buildRollButton\(/);
  assert.match(scene, /this\.dispatch\("placeDiceBet"/);
  assert.match(scene, /private startRoll\(\)/);
  assert.match(scene, /this\.shuffleTimer = this\.time\.addEvent/);
  assert.match(scene, /targets: this\.dieShadow/);
  assert.match(scene, /private stopRoll\(face: number\)/);
  assert.match(scene, /ease: "Bounce\.easeOut"/);
  assert.match(scene, /onComplete: \(\) => this\.emitLandingRipple\(\)/);

  // Reduced-motion users get a stable die instead of hidden looping motion;
  // changing the preference while rolling also tears active loops down.
  assert.match(scene, /if \(this\.reducedMotion\) \{[\s\S]*?this\.dieShadow\.setScale\(1\)/);
  assert.match(scene, /protected onReducedMotionChange\(enabled: boolean\)/);
  assert.match(scene, /this\.shuffleTimer\?\.remove\(false\)/);
  assert.match(scene, /this\.tweens\.killTweensOf\(this\.diceGroup\)/);

  // Practice wins throw actual chip textures. Official GAS artwork is reserved
  // for GameFi, and the settled banner reads the immutable settled payout.
  assert.match(scene, /const isGuest = this\.str\("mode", "guest"\) === "guest"/);
  assert.match(scene, /isGuest\s*\n\s*\? CHIP_PRESETS\[i % CHIP_PRESETS\.length\]!\.asset\s*\n\s*: ASSET_GAS_ICON/);
  assert.match(scene, /"lastPayout"/);
  assert.doesNotMatch(scene, /Math\.random|Runtime\.GetRandom/);
  assert.doesNotMatch(scene, /[🎲🎰🪙💰✨]/u);
});

test("Dice practice RNG fails closed and avoids modulo bias", () => {
  const guestEngine = read("apps/dice-game/src/logic/guest-engine.ts");

  assert.match(guestEngine, /export function rollLocalDie/);
  assert.match(guestEngine, /cryptoSource\?\.getRandomValues/);
  assert.match(guestEngine, /if \(value < 252\) return \(value % 6\) \+ 1/);
  assert.match(guestEngine, /for \(let attempt = 0; attempt < 128; attempt \+= 1\)/);
  assert.match(guestEngine, /if \(rolled === null\)/);
  assert.match(guestEngine, /t\("guestRandomUnavailable"\)/);
  assert.match(guestEngine, /reduceMotion \? REDUCED_MOTION_REVEAL_MS : REVEAL_MS/);
  assert.doesNotMatch(guestEngine, /Math\.random/);
});

test("Dice GameFi settlement requires exact canonical contract readback", () => {
  const main = read("apps/dice-game/src/main.tsx");

  assert.match(main, /const SETTLE_INITIAL_WAIT_MS = 62_000;/);
  assert.match(main, /const SETTLE_MAX_ATTEMPTS = 1;/);
  assert.match(main, /readRaw\("getPendingBet"/);
  assert.match(main, /parseBetId\(mapField\(raw, "id"\)\) !== record\.betId/);
  assert.match(main, /!addrEq\(mapField\(raw, "player"\), record\.player\)/);
  assert.match(main, /mapField\(raw, "face"\)/);
  assert.match(main, /mapField\(raw, "wager"\)/);
  assert.match(main, /mapField\(raw, "settled"\)/);
  assert.match(main, /rolled < 1 \|\|\s*\n\s*rolled > 6/);
  assert.match(main, /won !== expectedWon/);
  assert.match(main, /const expectedPayout = expectedWon \? \(wager \* 57n\) \/ 10n : 0n/);
  assert.match(main, /payout !== expectedPayout/);
  assert.match(main, /only the exact persisted record can[\s\S]*confirm the result/i);
  assert.doesNotMatch(main, /revealFromSettledEvent/);
});

test("Dice Game ships attributed art and a responsive warm game shell", () => {
  const styles = read("apps/dice-game/src/PlayArea.scss");
  const messages = read("apps/dice-game/src/locale/messages.ts");

  assert.ok(exists("apps/dice-game/public/art/ATTRIBUTION.md"));
  assert.ok(exists("apps/dice-game/public/art/hero-die.webp"));
  for (const fileName of [
    "chip-green.webp",
    "chip-blue.webp",
    "chip-red.webp",
    "chip-black.webp",
  ]) {
    assert.ok(exists(`apps/dice-game/public/art/${fileName}`), fileName);
  }
  for (let face = 1; face <= 6; face += 1) {
    assert.ok(exists(`apps/dice-game/public/art/die-white-${face}.webp`));
  }

  assert.match(styles, /\.dice-playarea \.mx2-stage\s*\{[\s\S]*min-height: 100dvh/);
  assert.match(styles, /\.dice-stage-shell\s*\{[\s\S]*#fffaf0/);
  assert.match(styles, /\.dice-stage-hud\s*\{/);
  assert.match(styles, /\.dice-ingame-drawer\s*\{/);
  assert.match(styles, /\.dice-a11y-controls:focus-within\s*\{/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);

  for (const key of [
    "enableGameSound",
    "muteGameSound",
    "gameActionFailed",
    "guestRandomUnavailable",
    "guestFairnessShort",
    "guestRangeValue",
    "diceVrfRouteTitle",
    "vrfTrustLine",
  ]) {
    assert.match(messages, new RegExp(`\\b${key}:`), key);
  }
  assert.match(messages, /fixed three-block beacon/i);
  assert.match(messages, /not presented as proof-carrying VRF/i);
});
