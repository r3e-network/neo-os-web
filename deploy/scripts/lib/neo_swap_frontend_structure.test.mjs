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

test("Neo Swap renders a polished wallet-style route console", () => {
  const playArea = read("apps/neo-swap/src/PlayArea.tsx");
  const styles = read("apps/neo-swap/src/PlayArea.scss");
  const heroStyles = read("apps/neo-swap/src/components/SwapHero.scss");
  const popularPairs = read("apps/neo-swap/src/components/PopularPairs.tsx");
  const popularPairStyles = read("apps/neo-swap/src/components/PopularPairs.scss");
  const main = read("apps/neo-swap/src/main.tsx");
  const messages = read("apps/neo-swap/src/locale/messages.ts");

  for (const className of [
    "neo-swap-shell",
    "neo-swap-hero-panel",
    "neo-swap-balance-card",
    "neo-swap-swap-card",
    "neo-swap-route-card",
    "neo-swap-trust-strip",
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
  assert.match(styles, /\.neo-swap-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.72fr\) minmax\(320px,\s*0\.38fr\)/s);
  assert.match(styles, /\.neo-swap-swap-card \.neo-card__content\s*\{/);
  assert.match(styles, /\.neo-swap-route-steps\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /\.neo-swap-token-button\s*\{/);
  assert.match(styles, /\.neo-swap-token-modal\s*\{/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.neo-swap-shell[\s\S]*grid-template-columns:\s*1fr/s);

  assertOnlyZeroLetterSpacing(`${styles}\n${heroStyles}\n${popularPairStyles}`);
  assert.doesNotMatch(`${styles}\n${heroStyles}\n${popularPairStyles}`, /text-transform:\s*uppercase/);
  assert.doesNotMatch(`${styles}\n${heroStyles}\n${popularPairStyles}`, /font-size:\s*clamp\(/);
  assert.doesNotMatch(`${styles}\n${heroStyles}\n${popularPairStyles}`, /radial-gradient/i);
  assert.doesNotMatch(`${styles}\n${heroStyles}\n${popularPairStyles}`, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
