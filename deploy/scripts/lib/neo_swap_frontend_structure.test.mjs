import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAssets,
  assertClasses,
  assertDispatches,
  assertMessageKeys,
  assertModernTypography,
  assertPlayStage,
  exists,
  read,
} from "./frontend_structure_helpers.mjs";

test("Neo Swap renders a v2 DeFi route desk with official shared token assets", () => {
  const playArea = read("apps/neo-swap/src/PlayArea.tsx");
  const styles = read("apps/neo-swap/src/PlayArea.scss");
  const tokenIcon = read("apps/neo-swap/src/components/TokenIcon.tsx");
  const tokenIconStyles = read("apps/neo-swap/src/components/TokenIcon.scss");
  const main = read("apps/neo-swap/src/main.tsx");
  const messages = read("apps/neo-swap/src/locale/messages.ts");
  const manifest = read("apps/neo-swap/neo-manifest.json");

  assertPlayStage(playArea, "defi", "Neo Swap");
  assertClasses(playArea, [
    "neo-swap-play-area",
    "swap-scene",
    "swap-terminal",
    "swap-station",
    "swap-leg",
    "swap-token-btn",
    "swap-switch-btn",
    "swap-selector",
    "swap-drawer",
    "swap-route-steps",
    "swap-token-list",
  ], "Neo Swap");
  assertDispatches(playArea, [
    "connectWallet",
    "executeSwap",
    "setFromAmount",
    "setSlippage",
    "setMaxAmount",
    "swapTokens",
    "selectToken",
    "refreshRate",
  ], "Neo Swap");
  assert.match(playArea, /normalizeAmountForToken/);
  assert.match(playArea, /token\.decimals === 0/);
  assert.match(tokenIcon, /import \{ CoinArt \} from "@shared\/art"/);
  assert.match(tokenIcon, /normalized === "NEO" \? "neo" : normalized === "GAS" \? "gas"/);
  assert.match(tokenIcon, /<CoinArt className=\{classes\} size=\{size\} variant=\{variant\}/);
  assert.ok(!exists("apps/neo-swap/src/static/neo-token.png"));
  assert.ok(!exists("apps/neo-swap/src/static/gas-token.png"));
  assertAssets([
    "apps/neo-swap/public/swap-liquidity-stage.webp",
    "apps/shared/assets/tokens/neo-icon.svg",
    "apps/shared/assets/tokens/gas-icon.svg",
  ]);
  assert.match(main, /ctx\.framework\.actions\.register\("refreshRate"/);
  assert.match(main, /ctx\.framework\.actions\.register\("selectPair"/);
  assert.match(main, /swap\.loadExchangeRate\(\)/);
  assertMessageKeys(messages, [
    "swapRouteReady",
    "swapRouteSyncing",
    "swapRouteUnavailable",
    "marketPairs",
    "routeReview",
    "slippage",
  ], "Neo Swap");
  assert.match(manifest, /"banner": "\/miniapps\/neo-swap\/banner\.webp"/);
  assert.match(styles, /\.swap-terminal\s*\{/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assertModernTypography(`${styles}\n${tokenIconStyles}`, "Neo Swap");
});
