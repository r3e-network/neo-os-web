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

test("Oracle Price Console renders a clean v2 market station backed by Morpheus DataFeed", () => {
  const playArea = read("apps/oracle-price-console/src/PlayArea.tsx");
  const hook = read("apps/oracle-price-console/src/hooks/usePriceConsole.ts");
  const styles = read("apps/oracle-price-console/src/PlayArea.scss");
  const messages = read("apps/oracle-price-console/src/locale/messages.ts");
  const index = read("apps/oracle-price-console/index.html");
  const sourceManifest = JSON.parse(read("apps/oracle-price-console/neo-manifest.json"));
  const stagedManifest = JSON.parse(
    read("platform/host-app/public/miniapps/oracle-price-console/neo-manifest.json"),
  );

  assert.match(playArea, /@shared\/components-react\/v2/);
  assert.match(playArea, /OpenUiProvider/);
  assert.match(playArea, /OpenUiSegmented/);
  assert.match(playArea, /OpenUiPanel/);
  assert.match(playArea, /PlayStage/);
  assert.match(playArea, /const MARKET_STAGE_IMAGE = "oracle-market-stage\.webp"/);
  assert.match(playArea, /className="oracle-price-play-area mx2 mx2-cat-tool"/);
  assert.match(playArea, /category="tool"/);
  assert.match(playArea, /className="price-stage-stack"/);
  assert.match(playArea, /className="price-station"/);
  assert.match(playArea, /className="price-ticket"/);
  assert.match(playArea, /className="price-feed-panel"/);
  assert.match(playArea, /className="price-station__market"/);
  assert.match(playArea, /src=\{MARKET_STAGE_IMAGE\}/);
  assert.match(playArea, /className="price-watchlist"/);
  assert.match(playArea, /className=\{\["price-pair-card"/);
  assert.match(playArea, /className="price-drawer"/);
  assert.match(playArea, /drawerToggleLabel=\{t\("feedTicketContract"\)\}/);
  assert.match(playArea, /dispatch\("updateAsset", sym\)/);
  assert.match(playArea, /dispatch\("fetchPrice"\)/);
  assert.match(playArea, /disabled=\{isRequesting\}/);
  assert.match(playArea, /loading: isRequesting, disabled: isRequesting/);
  assert.doesNotMatch(playArea, /NeoCard/);
  assert.doesNotMatch(playArea, /StateView/);

  assert.match(hook, /useMorpheusDataFeed/);
  assert.match(hook, /datafeed\.getPriceWithMeta\(asset\.get\(\)\)/);
  assert.match(hook, /datafeed\.listPairs\(\)/);
  assert.match(hook, /sourceLabel[\s\S]*t\("sourceOnChain", \{ network \}\)/);
  assert.doesNotMatch(hook, /sourceLabel[\s\S]*integration\.rpcUrl/);

  assert.match(styles, /\.oracle-price-play-area \.mx2-stage__scene\s*\{[\s\S]*background:\s*#ffffff/s);
  assert.match(styles, /\.price-station\s*\{[\s\S]*background:\s*#ffffff/s);
  assert.match(styles, /\.price-station__market img\s*\{[\s\S]*object-fit:\s*contain/s);
  assert.match(styles, /\.price-watchlist\s*\{/);
  assert.match(styles, /\.price-pair-card\s*\{/);
  assert.match(styles, /\.price-drawer-tabs__group\.mx2-open-segmented\.semi-radioGroup/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /rgba\(3,\s*12,\s*18/);
  assert.doesNotMatch(styles, /rgba\(7,\s*19,\s*28,\s*0\.96/);
  assert.doesNotMatch(styles, /background:\s*#06131a/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /letter-spacing:\s*-/);
  assert.doesNotMatch(styles, /letter-spacing:\s*0\.[0-9]+em/);

  assert.match(messages, /oracleStationTitle/);
  assert.match(messages, /priceRouteHint/);
  assert.match(messages, /watchlistTitle/);
  assert.match(messages, /feedTicketContract/);
  assert.match(messages, /priceSignalTitle/);
  assert.match(messages, /priceReferenceTitle/);
  assert.match(messages, /priceReferenceMethodValue/);
  assert.match(messages, /sourceOnChain/);

  assert.match(index, /href="\.\/logo\.webp"/);
  assert.match(index, /content="\.\/banner\.webp"/);
  assert.ok(exists("apps/oracle-price-console/public/oracle-market-stage.webp"));
  assert.ok(exists("apps/oracle-price-console/public/banner.webp"));

  for (const manifest of [sourceManifest, stagedManifest]) {
    assert.equal(manifest.default_network, "neo-n3-mainnet");
    assert.ok(manifest.supported_networks.includes("neo-n3-mainnet"));
    assert.ok(manifest.supported_networks.includes("neo-n3-testnet"));
    assert.equal(manifest.stateSource.chain, "neo-n3-mainnet");
    assert.equal(manifest.urls.banner, "/miniapps/oracle-price-console/banner.webp");
  }
});
