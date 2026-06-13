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

// The "Neo Soft" light redesign (commit 05ef54aab) intentionally adopts
// uppercase eyebrow labels with 0.12em tracking and negative heading tracking
// as the design language. Instead of asserting every letter-spacing is "0"
// (the obsolete pre-redesign guard), assert the new language is actually
// present: at least one positive eyebrow tracking and one negative heading
// tracking declaration must exist.
function assertNeoSoftTracking(styles) {
  const values = [...styles.matchAll(/letter-spacing:\s*([^;!]+)/g)].map(
    (match) => match[1].trim(),
  );
  assert.ok(values.length > 0, "expected at least one letter-spacing declaration");
  assert.ok(
    values.includes("0.12em"),
    "expected 0.12em eyebrow tracking (Neo Soft design language)",
  );
  assert.ok(
    values.some((value) => /^-0\.0[12]em$/.test(value)),
    "expected negative heading tracking (Neo Soft design language)",
  );
}

test("Neo Treasury renders a complete wallet-style dashboard even before live balances load", () => {
  const playArea = read("apps/neo-treasury/src/PlayArea.tsx");
  const styles = read("apps/neo-treasury/src/PlayArea.scss");
  const messages = read("apps/neo-treasury/src/locale/messages.ts");

  assert.match(playArea, /DA_HONGFEI_ADDRESSES/);
  assert.match(playArea, /ERIK_ZHANG_ADDRESSES/);
  assert.match(playArea, /className="treasury-hero"/);
  // Pre-redesign "treasury-signal-card" → the live/pending sync signal is now
  // rendered as the hero signal line driven by hasLiveData/loading state.
  assert.match(playArea, /className="treasury-hero__signal"/);
  assert.match(playArea, /className="treasury-watchlist"/);
  assert.match(playArea, /className="treasury-wallet-list"/);
  assert.match(playArea, /className="treasury-wallet-row"/);
  assert.match(playArea, /className="treasury-group-header"/);
  // Pre-redesign "treasury-route" → the read-only transparency/payout route is
  // now rendered inside the treasury-action-card (refresh + read-only note).
  assert.match(playArea, /className="treasury-action-card"/);
  assert.match(playArea, /className="treasury-readonly-note"/);
  assert.match(playArea, /const watchedAddressCount =/);
  assert.match(playArea, /const hasLiveData = Boolean\(data\)/);
  assert.match(playArea, /const isRefreshing = loading && hasLiveData/);

  assert.match(messages, /treasuryLivePending/);
  assert.match(messages, /treasuryReadOnlyRoute/);
  assert.match(messages, /treasuryWatchlist/);

  // Neo Soft light background (was a hardcoded #f7f8fb wash; now the --ns-bg token).
  assert.match(styles, /\.treasury-play-area\s*\{[^}]*background:\s*var\(--ns-bg,\s*#f4f5f7\)/s);
  assert.match(styles, /\.treasury-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(260px,\s*0\.72fr\)/s);
  // Hero radius migrated from a hardcoded 8px to the rounded --ns-radius-lg token.
  assert.match(styles, /\.treasury-hero\s*\{[^}]*border-radius:\s*var\(--ns-radius-lg,\s*20px\)/s);
  assert.match(styles, /\.treasury-wallet-list\s*\{[^}]*max-height:\s*248px/s);
  // Pre-redesign "treasury-signal-card" gradient → the live-sync signal is now a
  // brand-strong status dot toggled by the hasLiveData state.
  assert.match(styles, /\.treasury-hero__dot--live\s*\{[^}]*background:\s*var\(--ns-brand-strong,\s*#0fb174\)/s);
  assert.match(styles, /\.treasury-watchlist\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  // Pre-redesign "treasury-route" 3-col grid → the standalone "treasury-review-panel"
  // selector was dropped; the 3-up balance layout now lives on the treasury-wallet-strip
  // (tolerant to it being a standalone selector or grouped with sibling selectors).
  assert.match(styles, /\.treasury-wallet-strip\b[^{]*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.treasury-hero[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.treasury-watchlist[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.treasury-wallet-strip,[\s\S]*grid-template-columns:\s*1fr/s);

  // Neo Soft design language: uppercase eyebrows + 0.12em tracking + negative
  // heading tracking are intentional (replaces the obsolete zero-tracking /
  // no-uppercase guards from the pre-redesign dark theme).
  assertNeoSoftTracking(styles);
  assert.match(styles, /\.treasury-eyebrow\s*\{[^}]*text-transform:\s*uppercase/s);
  assert.match(styles, /\.treasury-eyebrow\s*\{[^}]*letter-spacing:\s*0\.12em/s);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /font-family:\s*[^;]*(?:Cinzel|serif)/i);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
