import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAssets,
  assertClasses,
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
  const engine = read("apps/neo-swap/src/hooks/useSwapEngine.ts");
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
  for (const action of [
    "connectWallet",
    "executeSwap",
    "setFromAmount",
    "setSlippage",
    "setMaxAmount",
    "swapTokens",
    "selectToken",
    "refreshRate",
  ]) {
    assert.match(playArea, new RegExp(`dispatchSafely\\("${action}"`), `Neo Swap missing safe dispatch for ${action}`);
  }
  assert.match(playArea, /inputMode=\{fromToken\.decimals === 0 \? "numeric" : "decimal"\}/);
  assert.match(engine, /token\.decimals === 0 && fraction\.length > 0/);
  assert.match(engine, /GAS_FEE_HEADROOM_UNITS = 10_000_000n/);
  assert.match(engine, /fromAmount\.set\(formatUnits\(maxUnits, ft\.decimals\)\)/);
  assert.match(tokenIcon, /import \{ CoinArt \} from "@shared\/art"/);
  assert.match(tokenIcon, /normalized === "NEO" \? "neo" : normalized === "GAS" \? "gas"/);
  assert.match(tokenIcon, /<CoinArt className=\{classes\} size=\{size\} variant=\{variant\}/);
  assert.ok(!exists("apps/neo-swap/src/static/neo-token.png"));
  assert.ok(!exists("apps/neo-swap/src/static/gas-token.png"));
  assertAssets([
    "apps/neo-swap/public/liquidity-route-v2.webp",
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
  assert.doesNotMatch(`${playArea}\n${styles}`, /swap-route-core__(?:bead|line)|swap-flow-bead-y/);
  assert.match(engine, /app\.wallet\.raw\("NEO"\)/);
  assert.match(engine, /quoteOutputUnits\(/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assertModernTypography(`${styles}\n${tokenIconStyles}`, "Neo Swap");
});
