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

test("Neo Swap renders a DeFi-native route console with real assets", () => {
  const playArea = read("apps/neo-swap/src/PlayArea.tsx");
  const styles = read("apps/neo-swap/src/PlayArea.scss");
  const hero = read("apps/neo-swap/src/components/SwapHero.tsx");
  const heroStyles = read("apps/neo-swap/src/components/SwapHero.scss");
  const popularPairs = read("apps/neo-swap/src/components/PopularPairs.tsx");
  const popularPairStyles = read("apps/neo-swap/src/components/PopularPairs.scss");
  const tokenIcon = read("apps/neo-swap/src/components/TokenIcon.tsx");
  const tokenIconStyles = read("apps/neo-swap/src/components/TokenIcon.scss");
  const main = read("apps/neo-swap/src/main.tsx");
  const messages = read("apps/neo-swap/src/locale/messages.ts");
  const indexHtml = read("apps/neo-swap/index.html");
  const manifest = read("apps/neo-swap/neo-manifest.json");

  for (const className of [
    "neo-swap-play-area",
    "neo-swap-hero-panel",
    "neo-swap-main-grid",
    "neo-swap-swap-card",
    "neo-swap-preview",
    "neo-swap-disclosure",
    "neo-swap-trade-workspace",
    "neo-swap-deal-ticket",
    "neo-swap-asset-card",
    "neo-swap-quote-metrics",
    "neo-swap-route-review",
    "neo-swap-route-facts",
    "neo-swap-side-stack",
    "neo-swap-token-button",
    "neo-swap-token-modal",
  ]) {
    assert.match(playArea, new RegExp(`className="[^"]*${className}`));
  }

  assert.match(hero, /src="\.\/swap-liquidity-stage\.jpg"/);
  assert.match(hero, /className="swap-hero-stage-image"/);
  assert.match(hero, /className="swap-hero-metrics"/);
  assert.match(playArea, /<TokenIcon symbol=\{fromSymbol\}/);
  assert.match(playArea, /<TokenIcon symbol=\{toSymbol\}/);
  assert.match(playArea, /<TokenIcon symbol=\{token\.symbol\}/);
  assert.match(tokenIcon, /import gasTokenUrl/);
  assert.match(tokenIcon, /import neoTokenUrl/);
  assert.match(tokenIcon, /TOKEN_IMAGES/);
  assert.match(popularPairs, /pair-token-stack/);
  assert.match(popularPairs, /<button[\s\S]*className=\{`pair-item/);
  assert.doesNotMatch(popularPairs, /<div[^>]*onClick=\{\(\) => handleSelectPair/);

  assert.ok(exists("apps/neo-swap/public/swap-liquidity-stage.jpg"));
  assert.ok(exists("apps/neo-swap/public/banner.jpg"));
  assert.ok(exists("apps/neo-swap/src/static/neo-token.png"));
  assert.ok(exists("apps/neo-swap/src/static/gas-token.png"));
  assert.match(indexHtml, /href="\.\/logo\.jpg"/);
  assert.match(indexHtml, /content="\.\/banner\.jpg"/);
  assert.match(manifest, /"banner": "\/miniapps\/neo-swap\/banner\.jpg"/);

  assert.match(playArea, /dispatch\("refreshRate"\)/);
  assert.match(
    playArea,
    /const routeHealth =\s*rateLoading[\s\S]*?!routerAvailable[\s\S]*?rateStale[\s\S]*?exchangeRate/s,
  );
  assert.match(
    playArea,
    /const formattedMinReceived = rateLoading[\s\S]*?hasQuote && minReceived[\s\S]*?ratePlaceholder/s,
  );
  assert.match(main, /ctx\.registerAction\("refreshRate"/);
  assert.match(main, /ctx\.registerAction\("selectPair"/);
  assert.match(main, /swap\.loadExchangeRate\(\)/);

  for (const key of [
    "swapRouteStatus",
    "swapRouteReady",
    "swapRouteSyncing",
    "swapRouteUnavailable",
    "marketPairs",
    "quoteHealth",
    "pricePreviewTitle",
    "setupTradeSummary",
  ]) {
    assert.match(messages, new RegExp(`${key}:`));
  }

  assert.match(styles, /\.neo-swap-play-area\s*\{[^}]*display:\s*grid/s);
  assert.match(styles, /\.neo-swap-main-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.05fr\) minmax\(300px,\s*0\.45fr\)/s);
  assert.match(styles, /\.neo-swap-hero-panel\s*\{[^}]*background:\s*transparent/s);
  assert.match(styles, /\.neo-swap-quote-metrics\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /\.neo-swap-route-facts\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /\.neo-swap-token-button \.neo-swap-token-icon\s*\{/);
  assert.match(styles, /\.neo-swap-token-modal\s*\{/);
  assert.match(heroStyles, /\.swap-hero-content\s*\{[^}]*position:\s*relative/s);
  assert.match(heroStyles, /\.swap-hero-stage-image\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(heroStyles, /\.swap-hero-trade-strip\s*\{/);
  assert.match(popularPairStyles, /\.pair-item\s*\{[^}]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/s);
  assert.match(tokenIconStyles, /\.neo-swap-token-icon img\s*\{/);
  assert.match(styles, /@media \(max-width: 980px\)[\s\S]*\.neo-swap-main-grid[\s\S]*grid-template-columns:\s*1fr/s);

  const combinedStyles = `${styles}\n${heroStyles}\n${popularPairStyles}\n${tokenIconStyles}`;
  assert.doesNotMatch(combinedStyles, /letter-spacing:\s*-/);
  assert.doesNotMatch(combinedStyles, /letter-spacing:\s*0\.1[2-9]em/);
  assert.doesNotMatch(combinedStyles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(combinedStyles, /radial-gradient/i);
  assert.doesNotMatch(combinedStyles, /border-radius:\s*(?:2[1-9]|[3-9][0-9])px/);
});
