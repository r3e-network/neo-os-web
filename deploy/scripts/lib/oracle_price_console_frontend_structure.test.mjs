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
  // Re-pinned to the committed fleet landing (0dd7c4af1): the drawer became a
  // segmented "Oracle details" workspace (feedDetails) with feed/contract/
  // reference tabs inside, and actions now route through the error-safe
  // dispatchSafely wrapper. Intent is unchanged: contract and reference
  // details stay in the drawer, fetch/updateAsset stay wired and guarded
  // while a request is in flight.
  assert.match(playArea, /drawerToggleLabel=\{t\("feedDetails"\)\}/);
  assert.match(playArea, /dispatchSafely\("updateAsset", sym\)/);
  assert.match(playArea, /dispatchSafely\("fetchPrice"\)/);
  assert.match(playArea, /loading: isRequesting, disabled: isRequesting/);
  assert.doesNotMatch(playArea, /NeoCard/);
  assert.doesNotMatch(playArea, /StateView/);

  // Re-pinned to the committed hook (0dd7c4af1): the pair is resolved to
  // explicit datafeed keys (feedKeys -> aggregate/provider) before the
  // meta-read. Intent unchanged: quotes come from the framework's Morpheus
  // DataFeed surface with metadata, never from a raw RPC url.
  assert.match(hook, /const keys = feedKeys\(requestedAsset\)/);
  assert.match(hook, /app\.oracle\.dataFeed\.price\(keys\.aggregate, \{ meta: true \}\)/);
  assert.match(hook, /app\.oracle\.dataFeed\.price\(keys\.provider, \{ meta: true \}\)/);
  assert.match(hook, /app\.oracle\.dataFeed\.listPairs\(\)/);
  // Re-pinned to the committed hook (0dd7c4af1): the source label is now
  // route-aware ("sourceResolved" with aggregate/provider route + network).
  // Intent unchanged: the label names the on-chain route, never the raw RPC
  // url (rpcEndpoint is a separate drawer-only observable), so the
  // no-rpcUrl rule is scoped to the sourceLabel derivation itself.
  const sourceLabelBlock = hook.match(
    /const sourceLabel: Observable<string> = \{[\s\S]*?\n {2}\};/,
  )?.[0];
  assert.ok(sourceLabelBlock, "hook should derive a sourceLabel observable");
  assert.match(sourceLabelBlock, /t\("sourceResolved", \{ route: routeLabel, network \}\)/);
  assert.doesNotMatch(sourceLabelBlock, /integration\.rpcUrl/);

  assert.match(styles, /\.oracle-price-play-area \.mx2-stage__scene\s*\{[\s\S]*background:\s*#ffffff/s);
  assert.match(styles, /\.price-station\s*\{[\s\S]*background:\s*#ffffff/s);
  // Re-pinned to the committed market-stage art treatment (0dd7c4af1): the
  // clipped full-bleed stage uses cover + center inside an overflow-hidden
  // white panel. Intent unchanged: the stage image fills its panel cleanly.
  assert.match(styles, /\.price-station__market img\s*\{[\s\S]*object-fit:\s*cover/s);
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
  // Re-pinned to the committed share card (0dd7c4af1): og:image now points at
  // the market-stage art. Intent unchanged: a relative, shipped webp asset.
  assert.match(index, /content="\.\/oracle-market-stage\.webp"/);
  assert.ok(exists("apps/oracle-price-console/public/oracle-market-stage.webp"));
  assert.ok(exists("apps/oracle-price-console/public/banner.webp"));

  // Re-pinned to the committed manifests (0dd7c4af1): the console retired its
  // stateSource block (reads route through the framework oracle surface per
  // selected network) and the catalog banner is the market-stage art. Intent
  // unchanged: mainnet-first with testnet supported, banner served from the
  // staged miniapp path.
  for (const manifest of [sourceManifest, stagedManifest]) {
    assert.equal(manifest.default_network, "neo-n3-mainnet");
    assert.ok(manifest.supported_networks.includes("neo-n3-mainnet"));
    assert.ok(manifest.supported_networks.includes("neo-n3-testnet"));
    assert.equal(manifest.urls.banner, "/miniapps/oracle-price-console/oracle-market-stage.webp");
  }
});
