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

test("On-Chain Tarot renders the selected Phaser reading-table experience", () => {
  const playArea = read("apps/on-chain-tarot/src/PhaserPlayArea.tsx");
  const scene = read("apps/on-chain-tarot/src/scenes/TarotScene.ts");
  const styles = read("apps/on-chain-tarot/src/PlayArea.scss");
  const messages = read("apps/on-chain-tarot/src/locale/messages.ts");
  const main = read("apps/on-chain-tarot/src/main.tsx");

  assert.match(main, /import PhaserPlayArea from "\.\/PhaserPlayArea"/);
  assert.match(main, /playArea: PhaserPlayArea/);
  assert.match(playArea, /LazyPhaserGameComponent as PhaserGameComponent/);
  assert.match(playArea, /import\("\.\/scenes\/TarotScene"\)/);
  assert.match(playArea, /<PlayStage/);
  assert.match(playArea, /category="game"/);
  assert.match(playArea, /className="tarot-play-area mx2 mx2-cat-game"/);
  assert.match(playArea, /className="tarot-stage-shell"/);
  assert.match(playArea, /className="tarot-phaser-canvas"/);
  assert.match(playArea, /className="tarot-a11y-layer"/);
  assert.match(playArea, /className="tarot-ingame-drawer"/);
  assert.match(playArea, /role="radiogroup"/);
  assert.match(playArea, /runAction\("setIntent", option\.id\)/);
  assert.match(playArea, /runAction\("flipCard", index\)/);
  assert.match(playArea, /runAction\("draw"\)/);
  assert.match(playArea, /runAction\("reset"\)/);
  assert.match(playArea, /runAction\("recoverExpiredReading"\)/);
  assert.match(playArea, /runAction\("retryTarotAssets"\)/);

  assert.match(scene, /import \* as Phaser from "phaser"/);
  assert.match(scene, /extends BaseScene/);
  assert.match(scene, /CRITICAL_ASSET_RETRIES = 2/);
  assert.match(scene, /this\.load\.image\(TAROT_ASSETS\.ritual/);
  assert.match(scene, /this\.load\.image\(TAROT_ASSETS\.back/);
  assert.match(scene, /this\.load\.image\(TAROT_ASSETS\.clarity/);
  assert.match(scene, /this\.load\.image\(TAROT_ASSETS\.choice/);
  assert.match(scene, /this\.load\.image\(TAROT_ASSETS\.momentum/);
  assert.match(scene, /private playDealMotion\(\)/);
  assert.match(scene, /delay: index \* 150/);
  assert.match(scene, /private flipCardView\(view: CardView\)/);
  assert.match(scene, /scaleX: 0/);
  assert.match(scene, /this\.dispatch\("flipTarotReading"\)/);
  assert.match(scene, /private playReadingCelebration\(\)/);
  assert.match(scene, /if \(this\.reducedMotion\) return/);
  assert.match(scene, /buildCriticalAssetRecovery\(\)/);
  assert.doesNotMatch(scene, /generateTexture\(/);

  const publicRoot = path.join(ROOT, "apps/on-chain-tarot/public");
  for (const asset of [
    "ritual/ritual-table.webp",
    "logo.webp",
    "intentions/clarity-token.webp",
    "intentions/choice-token.webp",
    "intentions/momentum-token.webp",
    "cards/back.webp",
    "cards/index.json",
    "cards/ATTRIBUTION.md",
  ]) {
    assert.ok(fs.existsSync(path.join(publicRoot, asset)), `missing tarot asset: ${asset}`);
  }
  const cardImages = fs
    .readdirSync(path.join(publicRoot, "cards"))
    .filter((name) => /^\d{2}-.+\.webp$/.test(name));
  assert.equal(cardImages.length, 78, "tarot deck must ship all 78 card faces");

  for (const key of [
    "readingIntentTitle",
    "ritualActionConfirm",
    "dealingCards",
    "revealAllCards",
    "verificationPanelTitle",
    "assetErrorTitle",
    "assetRetry",
    "gameFiMaintenanceShort",
  ]) {
    assert.match(messages, new RegExp(`${key}:`), key);
  }

  assert.match(styles, /\.tarot-stage-shell\s*\{/);
  assert.match(styles, /\.tarot-stage-shell \.phaser-game-host/);
  assert.match(styles, /\.tarot-a11y-layer\s*\{/);
  assert.match(styles, /\.tarot-ingame-drawer\s*\{/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient|backdrop-filter/);
  const tracking = [...styles.matchAll(/letter-spacing:\s*([^;]+);/g)]
    .map((match) => match[1].trim());
  assert.ok(tracking.length > 0, "tarot styles should pin readable tracking");
  assert.deepEqual(tracking.filter((value) => value !== "0"), []);
});
