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

test("Neo Swap renders a polished wallet-style route console", () => {
  const playArea = read("apps/neo-swap/src/PlayArea.tsx");
  const styles = read("apps/neo-swap/src/PlayArea.scss");
  const heroStyles = read("apps/neo-swap/src/components/SwapHero.scss");
  const popularPairs = read("apps/neo-swap/src/components/PopularPairs.tsx");
  const popularPairStyles = read("apps/neo-swap/src/components/PopularPairs.scss");
  const main = read("apps/neo-swap/src/main.tsx");
  const messages = read("apps/neo-swap/src/locale/messages.ts");

  for (const className of [
    "neo-swap-play-area",
    "neo-swap-hero-panel",
    "neo-swap-main-grid",
    "neo-swap-swap-card",
    "neo-swap-token-field",
    "neo-swap-detail-panel",
    "neo-swap-side-stack",
    "neo-swap-wallet-empty",
    "neo-swap-token-button",
    "neo-swap-token-modal",
  ]) {
    assert.match(playArea, new RegExp(`className="[^"]*${className}`));
  }

  assert.match(playArea, /dispatch\("refreshRate"\)/);
  assert.match(playArea, /const routeHealth = rateLoading/);
  assert.match(playArea, /const formattedMinReceived = minReceived \|\| "0\.0000"/);
  assert.match(popularPairs, /<button[\s\S]*className=\{`pair-item/);
  assert.doesNotMatch(popularPairs, /<div[^>]*onClick=\{\(\) => handleSelectPair/);

  assert.match(main, /ctx\.registerAction\("refreshRate"/);
  assert.match(main, /swap\.loadExchangeRate\(\)/);

  for (const key of [
    "swapPortfolioLabel",
    "swapRouteStatus",
    "swapRouteReady",
    "swapRouteSyncing",
    "swapRouteUnavailable",
    "swapSafetyTitle",
    "swapSafetyCopy",
    "marketPairs",
    "quoteHealth",
  ]) {
    assert.match(messages, new RegExp(`${key}:`));
  }

  assert.match(styles, /\.neo-swap-play-area\s*\{[^}]*display:\s*grid/s);
  assert.match(styles, /\.neo-swap-play-area\s*\{[^}]*#f7f8fb/s);
  assert.match(styles, /\.neo-swap-main-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.66fr\) minmax\(310px,\s*0\.34fr\)/s);
  assert.match(styles, /\.neo-swap-swap-card \.neo-card__content\s*[,{]/);
  assert.match(styles, /\.neo-swap-detail-panel\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /\.neo-swap-token-button\s*\{/);
  assert.match(styles, /\.neo-swap-token-modal\s*\{/);
  assert.match(styles, /@media \(max-width: 980px\)[\s\S]*\.neo-swap-main-grid[\s\S]*grid-template-columns:\s*1fr/s);

  // Neo Soft design language: uppercase eyebrow labels with 0.12em tracking and
  // negative-tracked display headings are the intended idiom (not a regression).
  const combinedStyles = `${styles}\n${heroStyles}\n${popularPairStyles}`;
  assert.match(heroStyles, /\.swap-hero-eyebrow\s*\{[^}]*letter-spacing:\s*0\.12em;[^}]*text-transform:\s*uppercase/s);
  assert.match(combinedStyles, /text-transform:\s*uppercase/);
  assert.match(combinedStyles, /letter-spacing:\s*0\.12em/);
  assert.match(heroStyles, /\.swap-hero-title\s*\{[^}]*letter-spacing:\s*-0\.02em/s);

  // Design-system constraints that still hold: no fluid font clamps, no radial
  // gradients, and no oversized literal radii (20px card + 999px pill are tokens).
  assert.doesNotMatch(combinedStyles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(combinedStyles, /radial-gradient/i);
  assert.doesNotMatch(combinedStyles, /border-radius:\s*(?:2[1-9]|[3-9][0-9])px/);
});
