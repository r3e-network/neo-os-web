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

test("On-Chain Tarot renders a complete wallet-style oracle reading workspace", () => {
  const playArea = read("apps/on-chain-tarot/src/PlayArea.tsx");
  const styles = read("apps/on-chain-tarot/src/PlayArea.scss");
  const messages = read("apps/on-chain-tarot/src/locale/messages.ts");

  for (const className of [
    "tarot-shell",
    "tarot-main",
    "tarot-hero",
    "tarot-oracle-stats",
    "tarot-question-panel",
    "tarot-spread-panel",
    "tarot-flow-strip",
    "tarot-verification-panel",
    "tarot-deck-panel",
    "tarot-reading-summary",
  ]) {
    assert.match(playArea, new RegExp(`className="[^"]*${className}`));
  }

  assert.match(playArea, /dispatch\("setQuestion",\s*event\.currentTarget\.value\)/);
  assert.match(playArea, /dispatch\("draw"\)/);
  assert.match(playArea, /dispatch\("reset"\)/);
  assert.match(playArea, /dispatch\("flipCard",\s*index\)/);
  assert.match(playArea, /readingMode === "oracle"/);
  assert.match(playArea, /allFlipped/);
  assert.match(playArea, /TAROT_CARD_BACK/);

  for (const key of [
    "tarotHeroTitle",
    "tarotHeroSubtitle",
    "oracleRequestTitle",
    "readingFlowTitle",
    "readingStepOne",
    "readingStepTwo",
    "readingStepThree",
    "verificationPanelTitle",
    "contractRouteLabel",
    "tarotContractRoute",
    "deckPanelTitle",
    "spreadPanelTitle",
  ]) {
    assert.match(messages, new RegExp(`${key}:`), key);
  }

  assert.match(styles, /\.tarot-play-area\s*\{[^}]*#f7f8fb/s);
  assert.match(
    styles,
    /\.tarot-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.72fr\)\s+minmax\(320px,\s*0\.44fr\)/s,
  );
  assert.match(
    styles,
    /\.tarot-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(280px,\s*0\.52fr\)/s,
  );
  assert.match(
    styles,
    /\.tarot-hero-copy\s*\{[\s\S]*>\s*h2\s*\{[^}]*color:\s*#ffffff/s,
  );
  assert.match(
    styles,
    /\.tarot-hero \.tarot-hero-copy\s*>\s*h2\s*\{[^}]*color:\s*#ffffff/s,
  );
  assert.match(
    styles,
    /\.tarot-flow-strip\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    styles,
    /\.tarot-reading-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(styles, /\.tarot-deck-fan\s*\{[^}]*height:\s*270px/s);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.tarot-shell[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.tarot-flow-strip[\s\S]*grid-template-columns:\s*1fr/s);

  assertOnlyZeroLetterSpacing(styles);
  assert.doesNotMatch(styles, /text-transform:\s*uppercase/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
