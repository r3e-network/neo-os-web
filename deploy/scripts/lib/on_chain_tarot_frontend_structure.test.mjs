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

function assertZeroLetterSpacing(styles) {
  const values = [...styles.matchAll(/letter-spacing:\s*([^;]+);/g)].map(
    (match) => match[1].trim(),
  );
  assert.ok(values.length > 0, "expected explicit letter-spacing declarations");
  for (const value of values) {
    assert.equal(value, "0", `unexpected letter-spacing value: ${value}`);
  }
}

test("On-Chain Tarot renders a clean v2 card-reading table", () => {
  const playArea = read("apps/on-chain-tarot/src/PlayArea.tsx");
  const styles = read("apps/on-chain-tarot/src/PlayArea.scss");
  const messages = read("apps/on-chain-tarot/src/locale/messages.ts");

  for (const className of [
    "tarot-play-area",
    "tarot-scene",
    "tarot-scene__cloth",
    "tarot-scene__deck",
    "tarot-scene__slip",
    "tarot-scene__deal-paths",
    "tarot-scene__dealing",
    "tarot-scene__spread",
    "tarot-scene__slot",
    "tarot-scene__card-flip",
    "tarot-scene__card-face",
    "tarot-drawer__intent-grid",
    "tarot-drawer__question-card",
    "tarot-drawer__flow",
    "tarot-drawer__safety",
  ]) {
    assert.ok(playArea.includes(className), className);
  }

  assert.match(playArea, /<PlayStage/);
  assert.match(playArea, /category="game"/);
  assert.match(playArea, /dispatch\("draw"\)/);
  assert.match(playArea, /dispatch\("reset"\)/);
  assert.match(playArea, /dispatch\("flipCard",\s*index\)/);
  assert.match(playArea, /dispatch\("setQuestion"/);
  assert.match(playArea, /TAROT_CARD_BACK/);
  assert.match(playArea, /src=\{card\.image \|\| TAROT_CARD_BACK\}/);
  assert.ok(fs.existsSync(path.join(ROOT, "apps/on-chain-tarot/public/cards/back.webp")));
  assert.ok(fs.existsSync(path.join(ROOT, "apps/on-chain-tarot/public/cards/index.json")));
  const cardImages = fs
    .readdirSync(path.join(ROOT, "apps/on-chain-tarot/public/cards"))
    .filter((name) => /^\d{2}-.+\.webp$/.test(name));
  assert.equal(cardImages.length, 78, "tarot deck must ship all 78 card faces");
  assert.match(playArea, /mx2-deal/);
  assert.match(playArea, /tarot-reading-table\.webp/);
  assert.match(playArea, /tarot-scene__table-art/);

  for (const key of [
    "neoTarot",
    "tarotHeroSubtitle",
    "tarotFee",
    "drawCards",
    "dealingCards",
    "revealAllCards",
    "readingIntentTitle",
    "questionLabel",
    "verificationPanelTitle",
    "contractRouteLabel",
    "tarotContractRoute",
    "cardsDrawnCount",
  ]) {
    assert.match(messages, new RegExp(`${key}:`), key);
  }

  assert.match(styles, /\.tarot-play-area\s*\{[^}]*--mx2-stage-floor:\s*#ffffff/s);
  assert.match(styles, /--mx2-scene-art-opacity:\s*0\.16/);
  assert.match(styles, /\.tarot-scene__cloth\s*\{[^}]*background:\s*#fffaf3/s);
  assert.match(styles, /\.tarot-scene__spread\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(var\(--tarot-card-w\),\s*150px\)\)/s);
  assert.match(styles, /\.tarot-scene__spread::before\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.72\)/s);
  assert.match(styles, /\.tarot-scene__card-flip\s*\{[^}]*transform-style:\s*preserve-3d/s);
  assert.match(styles, /\.tarot-scene__slot--revealed \.tarot-scene__card-flip\s*\{[^}]*rotateY\(180deg\)/s);
  assert.match(styles, /\.tarot-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(styles, /@keyframes tarot-card-deal/);
  assert.match(styles, /@keyframes tarot-path-light/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.tarot-scene__spread[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(96px,\s*1fr\)\)/s);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.001ms/s);

  assertZeroLetterSpacing(styles);
  assert.match(styles, /text-transform:\s*uppercase/);
  assert.doesNotMatch(styles, /radial-gradient|backdrop-filter/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[9]|[3-9][0-9])px/);
});
