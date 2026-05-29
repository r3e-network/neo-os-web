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
  assert.ok(values.length > 0, "expected at least one letter-spacing declaration");
  assert.deepEqual(values, values.map(() => "0"));
}

test("Oracle Price Console exposes a wallet-style price workspace with guarded feed query", () => {
  const playArea = read("apps/oracle-price-console/src/PlayArea.tsx");
  const hook = read("apps/oracle-price-console/src/hooks/usePriceConsole.ts");
  const styles = read("apps/oracle-price-console/src/PlayArea.scss");
  const messages = read("apps/oracle-price-console/src/locale/messages.ts");
  const sourceManifest = JSON.parse(read("apps/oracle-price-console/neo-manifest.json"));
  const stagedManifest = JSON.parse(
    read("platform/host-app/public/miniapps/oracle-price-console/neo-manifest.json"),
  );

  assert.match(playArea, /className="price-hero"/);
  assert.match(playArea, /className="price-hero__metrics"/);
  assert.match(playArea, /className="price-balance-card"/);
  assert.match(playArea, /className="price-balance-card__signal"/);
  assert.match(playArea, /className="price-sparkline"/);
  assert.match(playArea, /className="price-oracle-grid"/);
  assert.match(playArea, /className="price-flow"/);
  assert.match(playArea, /className="price-action-panel"/);
  assert.match(playArea, /className="price-hint"/);
  assert.match(playArea, /const canFetchPrice =/);
  assert.match(playArea, /disabled=\{!canFetchPrice \|\| isRequesting\}/);
  assert.doesNotMatch(hook, /sourceLabel[\s\S]*integration\.rpcUrl/);
  assert.match(styles, /\.price-play-area button:disabled/);
  assert.doesNotMatch(styles, /filter:\s*saturate/);
  assert.doesNotMatch(styles, /opacity:\s*0\.55/);
  assert.doesNotMatch(styles, /radial-gradient/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /border-radius:\s*2[2-9]px/);
  assertOnlyZeroLetterSpacing(styles);
  assert.match(
    styles,
    /\.price-hero\s*\{[\s\S]*padding:\s*24px;[\s\S]*border-radius:\s*16px;/,
  );
  assert.match(
    styles,
    /\.price-hero h2\s*\{[\s\S]*font-size:\s*32px;[\s\S]*line-height:\s*1\.12;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 720px\)[\s\S]*\.price-hero\s*\{[\s\S]*padding:\s*18px;[\s\S]*border-radius:\s*14px;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 720px\)[\s\S]*\.price-hero h2\s*\{[\s\S]*font-size:\s*28px;/,
  );
  assert.match(styles, /\.price-balance-card\s*\{[^}]*linear-gradient/s);
  assert.match(styles, /\.price-balance-card__signal\s*\{/);
  assert.match(styles, /\.price-sparkline\s*\{/);
  assert.match(styles, /\.asset-token\s*\{[^}]*border-radius:\s*999px/s);
  assert.match(styles, /\.price-hint\s*\{[^}]*padding:\s*11px 13px/s);
  assert.match(styles, /\.price-hint\s*\{[^}]*border:\s*1px solid/s);
  assert.match(styles, /\.price-hint\s*\{[^}]*background:\s*#f8fafc/s);
  assert.match(
    styles,
    /@media \(max-width: 720px\)[\s\S]*\.price-oracle-grid\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );
  assert.match(messages, /priceHeroTitle/);
  assert.match(messages, /priceMetricFeed/);
  assert.match(messages, /priceFlowFetch/);
  assert.match(messages, /Mainnet/);
  assert.doesNotMatch(messages, /shared testnet feed endpoint/);

  for (const manifest of [sourceManifest, stagedManifest]) {
    assert.equal(manifest.default_network, "neo-n3-mainnet");
    assert.ok(manifest.supported_networks.includes("neo-n3-mainnet"));
    assert.ok(manifest.supported_networks.includes("neo-n3-testnet"));
    assert.equal(manifest.stateSource.chain, "neo-n3-mainnet");
  }
});
