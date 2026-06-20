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

test("Oracle Price Console renders an oracle-native market station with guarded feed query", () => {
  const playArea = read("apps/oracle-price-console/src/PlayArea.tsx");
  const hook = read("apps/oracle-price-console/src/hooks/usePriceConsole.ts");
  const styles = read("apps/oracle-price-console/src/PlayArea.scss");
  const messages = read("apps/oracle-price-console/src/locale/messages.ts");
  const index = read("apps/oracle-price-console/index.html");
  const sourceManifest = JSON.parse(read("apps/oracle-price-console/neo-manifest.json"));
  const stagedManifest = JSON.parse(
    read("platform/host-app/public/miniapps/oracle-price-console/neo-manifest.json"),
  );

  assert.match(playArea, /src="\.\/oracle-market-stage\.jpg"/);
  assert.match(playArea, /className="price-hero__shade"/);
  assert.match(playArea, /className=\{`price-market-board price-market-board--\$\{boardState\}`\}/);
  assert.match(playArea, /className="price-action-panel"/);
  assert.match(playArea, /className="price-pair-grid"/);
  assert.match(playArea, /className="price-pair-card__cue"/);
  assert.match(playArea, /className="price-reference__intro"/);
  assert.match(playArea, /price-eyebrow price-eyebrow-badge/);
  assert.match(playArea, /price-status price-status-pill/);
  assert.match(playArea, /className="price-hero__timestamp-pill"/);
  assert.match(playArea, /navigator\.clipboard\?\.writeText\(datafeedHash\)/);
  assert.match(playArea, /dispatch\("updateAsset", symbol\)/);
  assert.match(playArea, /dispatch\("fetchPrice"\)/);
  assert.match(playArea, /disabled=\{!canFetchPrice \|\| isRequesting\}/);
  assert.doesNotMatch(playArea, /NeoCard/);
  assert.doesNotMatch(playArea, /StateView/);

  assert.doesNotMatch(hook, /sourceLabel[\s\S]*integration\.rpcUrl/);

  assert.match(styles, /\.price-hero__media\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(styles, /\.price-hero__shade\s*\{[^}]*rgba\(255,\s*255,\s*255,\s*0\.98\)/s);
  assert.match(styles, /\.price-play-area \.price-hero h2\s*\{[^}]*color:\s*#10231f/s);
  assert.match(styles, /\.price-market-board\s*\{[\s\S]*linear-gradient/s);
  assert.match(styles, /\.price-status--loading \.price-status__dot/);
  assert.match(styles, /\.price-reference\s*\{[\s\S]*linear-gradient\(135deg,\s*rgba\(245,\s*255,\s*249,\s*0\.98\)/s);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.price-pair-card\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/s);
  assert.doesNotMatch(styles, /rgba\(3,\s*12,\s*18/);
  assert.doesNotMatch(styles, /rgba\(7,\s*19,\s*28,\s*0\.96/);
  assert.doesNotMatch(styles, /background:\s*#06131a/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /letter-spacing:\s*-/);
  assert.doesNotMatch(styles, /letter-spacing:\s*0\.[0-9]+em/);

  assert.match(messages, /marketBoardTitle/);
  assert.match(messages, /watchlistTitle/);
  assert.match(messages, /requestPackage/);
  assert.match(messages, /feedTimePending/);

  assert.match(index, /href="\.\/logo\.jpg"/);
  assert.match(index, /content="\.\/banner\.jpg"/);
  assert.ok(exists("apps/oracle-price-console/public/oracle-market-stage.jpg"));
  assert.ok(exists("apps/oracle-price-console/public/banner.jpg"));

  for (const manifest of [sourceManifest, stagedManifest]) {
    assert.equal(manifest.default_network, "neo-n3-mainnet");
    assert.ok(manifest.supported_networks.includes("neo-n3-mainnet"));
    assert.ok(manifest.supported_networks.includes("neo-n3-testnet"));
    assert.equal(manifest.stateSource.chain, "neo-n3-mainnet");
    assert.equal(manifest.urls.banner, "/miniapps/oracle-price-console/banner.jpg");
  }
});
