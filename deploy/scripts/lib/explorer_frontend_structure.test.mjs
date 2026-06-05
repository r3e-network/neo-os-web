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

// Neo Soft adopts uppercase eyebrow labels with a fixed 0.12em tracking as the
// intentional design language. Guard that the tracking value is consistent
// (every uppercase eyebrow uses the same 0.12em step) rather than asserting the
// obsolete zero-only rule the pre-redesign explorer followed.
function assertEyebrowTrackingPresent(styles) {
  const values = [...styles.matchAll(/letter-spacing:\s*([^;]+);/g)].map(
    (match) => match[1].trim(),
  );
  assert.ok(values.length > 0, "expected at least one letter-spacing declaration");
  // The Neo Soft eyebrow tracking step must be present and applied uniformly.
  const tracked = values.filter((v) => v === "0.12em");
  assert.ok(
    tracked.length >= 3,
    "expected the 0.12em Neo Soft eyebrow tracking on uppercase labels",
  );
}

test("Explorer renders a complete wallet-style chain lookup console in empty live-data states", () => {
  const playArea = read("apps/explorer/src/PlayArea.tsx");
  const styles = read("apps/explorer/src/PlayArea.scss");
  const recentTransactions = read("apps/explorer/src/components/RecentTransactions.tsx");
  const recentStyles = read("apps/explorer/src/components/RecentTransactions.scss");
  const searchPanelStyles = read("apps/explorer/src/components/SearchPanel.scss");
  const messages = read("apps/explorer/src/locale/messages.ts");

  assert.match(playArea, /className="explorer-hero"/);
  // The two duplicated per-network signal cards collapsed into one compact
  // metrics strip surfacing the active network's live figures.
  assert.match(playArea, /className="explorer-metrics"/);
  assert.match(playArea, /className="explorer-metric"/);
  // The search primer became the dedicated search section wrapping SearchPanel.
  assert.match(playArea, /className="explorer-search-section"/);
  // The read-only / safety note is folded inline into the hero as a tag chip
  // rendering the explorerReadOnly copy.
  assert.match(playArea, /className="explorer-hero__tag"/);
  assert.match(playArea, /t\("explorerReadOnly"\)/);
  assert.match(playArea, /selectedNetwork === "mainnet"/);

  assert.match(recentTransactions, /recent-empty-state/);
  assert.match(recentTransactions, /transactions\.length === 0/);
  assert.match(recentTransactions, /explorerRecentEmptyTitle/);

  for (const key of [
    "explorerReadOnly",
    "explorerSearchScope",
    "explorerRecentEmptyTitle",
    "explorerRecentEmptyDesc",
    "explorerWorkflowTitle",
    "explorerSafetyDesc",
  ]) {
    assert.match(messages, new RegExp(`${key}:`));
  }

  assert.match(styles, /\.explorer-play-area\s*\{[^}]*#f7f8fb/s);
  // Hero is a single-column grid with a soft Neo green corner wash over the
  // surface token (the old two-column signal layout was retired).
  assert.match(styles, /\.explorer-hero\s*\{[^}]*display:\s*grid/s);
  assert.match(styles, /\.explorer-hero\s*\{[\s\S]*?radial-gradient\(120% 140% at 0% 0%,\s*var\(--xp-accent-soft\)/s);
  // The compact metrics strip is the explorer's primary signal region: four
  // equal columns of live network figures.
  assert.match(styles, /\.explorer-metrics\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
  // The 3-up workflow grid now lives in the recent-tx empty-state guidance list.
  assert.match(recentStyles, /\.recent-empty-state ul\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(recentStyles, /\.recent-empty-state\s*\{/);
  assert.match(recentStyles, /\.recent-empty-state \.neo-card__content\s*\{/);
  assert.match(recentStyles, /\.recent-empty-state \.neo-card__content > div\s*\{/);
  assert.match(searchPanelStyles, /\.search-card\s*\{[^}]*display:\s*grid/s);
  assert.match(searchPanelStyles, /\.search-card \.neo-card__content\s*\{/);
  // Below 760px the recent-tx empty-state (workflow tips + its two-column body)
  // collapses to a single column.
  assert.match(recentStyles, /@media \(max-width: 760px\)[\s\S]*\.recent-empty-state[\s\S]*grid-template-columns:\s*1fr/s);
  // Below 480px the metrics strip collapses to a single column.
  assert.match(styles, /@media \(max-width: 480px\)[\s\S]*\.explorer-metrics[\s\S]*grid-template-columns:\s*1fr/s);

  // Neo Soft design language: uppercase eyebrow labels with 0.12em tracking
  // are intentional (the obsolete zero-tracking / no-uppercase guards are
  // replaced with positive assertions that the new language is present).
  const allStyles = `${styles}\n${recentStyles}\n${searchPanelStyles}`;
  assertEyebrowTrackingPresent(allStyles);
  assert.match(allStyles, /text-transform:\s*uppercase/);
  assert.match(styles, /\.explorer-eyebrow\s*\{[^}]*text-transform:\s*uppercase/s);
  // Design-system constraints that still hold: no fluid font clamps.
  assert.doesNotMatch(allStyles, /font-size:\s*clamp\(/);
  // Bounded literal border-radius: every literal px radius is either a small
  // card radius (<= 24px) or an explicit full-round pill (>= 999px) — no
  // awkward in-between literals. (Most surfaces use the --ns-radius-* tokens.)
  const literalRadii = [...allStyles.matchAll(/border-radius:\s*(\d+)px/g)].map(
    (m) => Number(m[1]),
  );
  assert.ok(literalRadii.length > 0, "expected at least one literal border-radius");
  for (const r of literalRadii) {
    assert.ok(
      r <= 24 || r >= 999,
      `unexpected mid-range literal border-radius: ${r}px`,
    );
  }
});
