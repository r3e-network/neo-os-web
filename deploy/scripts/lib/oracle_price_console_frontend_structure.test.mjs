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

// Neo Soft redesign (commit 6a983eed6) intentionally adopted uppercase
// eyebrow labels with 0.12em tracking as the design language. The old
// "every letter-spacing must be 0" guard is obsolete; instead we positively
// assert the eyebrow uses uppercase + the canonical 0.12em tracking.
function assertNeoSoftEyebrow(styles) {
  assert.match(
    styles,
    /\.price-eyebrow\s*\{[^}]*letter-spacing:\s*0\.12em;[^}]*text-transform:\s*uppercase;/s,
    "expected .price-eyebrow to use uppercase + 0.12em tracking",
  );
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
  // Neo Soft density pass moved the Feed/Network/Source readouts into the hero
  // metrics column; each is rendered as a labelled price-metric row.
  assert.match(playArea, /className="price-metric"/);
  assert.match(playArea, /className="price-balance-card"/);
  // The former price-balance-card__signal + price-sparkline pair was
  // consolidated into a single live status badge (price-status / --live with
  // a price-status__dot indicator).
  assert.match(playArea, /className=\{`price-status\$\{priceLoaded \? " price-status--live" : ""\}`\}/);
  assert.match(playArea, /className="price-status__dot"/);
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
  assertNeoSoftEyebrow(styles);
  assert.match(
    styles,
    /\.price-hero\s*\{[\s\S]*padding:\s*28px;[\s\S]*border-radius:\s*var\(--ns-radius-xl\);/,
  );
  assert.match(
    styles,
    /\.price-hero h2\s*\{[\s\S]*font-size:\s*32px;[\s\S]*line-height:\s*1\.12;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 720px\)[\s\S]*\.price-hero\s*\{[\s\S]*padding:\s*20px;[\s\S]*border-radius:\s*var\(--ns-radius-lg\);/,
  );
  assert.match(
    styles,
    /@media \(max-width: 720px\)[\s\S]*\.price-hero h2\s*\{[\s\S]*font-size:\s*28px;/,
  );
  assert.match(styles, /\.price-balance-card\s*\{[^}]*linear-gradient/s);
  // The signal badge replaces the old sparkline block; its live variant and
  // dot indicator carry the "feed is fresh" affordance.
  assert.match(styles, /\.price-status\s*\{/);
  assert.match(styles, /\.price-status--live\s*\{/);
  assert.match(styles, /\.price-status__dot\s*\{/);
  assert.match(styles, /\.asset-token\s*\{[^}]*border-radius:\s*999px/s);
  assert.match(styles, /\.price-hint\s*\{[^}]*padding:\s*13px 15px/s);
  // Neo Soft uses an inset box-shadow hairline (not a literal border) on the
  // subtle surface background.
  assert.match(styles, /\.price-hint\s*\{[^}]*box-shadow:\s*inset 0 0 0 1px var\(--ns-border\)/s);
  assert.match(styles, /\.price-hint\s*\{[^}]*background:\s*var\(--ns-surface-subtle\)/s);
  // The Feed/Network/Source rows collapse to a single column at narrow widths.
  assert.match(
    styles,
    /@media \(max-width: 720px\)[\s\S]*\.price-hero\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );
  assert.match(messages, /priceHeroTitle/);
  assert.match(messages, /priceMetricFeed/);
  // The Asset>Fetch>Verify stepper (priceFlow*) was dropped in the density
  // pass; the live status badge text is what is now rendered.
  assert.match(messages, /priceStatusLive/);
  assert.match(messages, /Mainnet/);
  assert.doesNotMatch(messages, /shared testnet feed endpoint/);

  for (const manifest of [sourceManifest, stagedManifest]) {
    assert.equal(manifest.default_network, "neo-n3-mainnet");
    assert.ok(manifest.supported_networks.includes("neo-n3-mainnet"));
    assert.ok(manifest.supported_networks.includes("neo-n3-testnet"));
    assert.equal(manifest.stateSource.chain, "neo-n3-mainnet");
  }
});
